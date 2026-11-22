-- =============================================================================
-- SECURITY FIX TAHAP 2b — brankas password + kunci tabel users
--
-- 1. Password tidak lagi disimpan polos. Kolom public.users.password menjadi
--    "tulis saja": aplikasi tetap boleh mengisinya (buat user / reset
--    password), trigger langsung memindahkannya ke Supabase Auth (bcrypt) dan
--    ke brankas terenkripsi, lalu mengosongkan kolomnya.
-- 2. Brankas (private.password_vault) dienkripsi dengan kunci di Supabase
--    Vault. Hanya SUPERADMIN yang bisa membukanya lewat RPC
--    admin_view_passwords(), dan setiap pembukaan tercatat di audit_logs.
-- 3. RLS tabel users: tanpa login tidak bisa apa-apa; user hanya bisa
--    mengubah data profilnya sendiri (bukan peran/status/NIM); admin
--    mengelola user; pusbangkatar mengisi nilai kondite/semapta; hanya
--    superadmin yang bisa mengubah akun superadmin.
-- 4. staff_accounts (tidak dipakai, password polos) dikunci total.
-- 5. audit_logs: semua user login boleh mencatat, hanya admin yang membaca,
--    tidak ada yang bisa mengubah/menghapus.
--
-- Password user TIDAK berubah.
-- =============================================================================

-- 1. Kunci brankas di Supabase Vault ---------------------------------------------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'password_vault_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'password_vault_key',
      'Kunci enkripsi brankas password user (CAT/SIAKAD/LMS)');
  end if;
end $$;

create or replace function private.vault_key()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'password_vault_key' limit 1
$$;
revoke all on function private.vault_key() from public, anon, authenticated;

create table if not exists private.password_vault (
  user_id    uuid primary key,
  enc        bytea not null,
  updated_at timestamptz not null default now()
);
revoke all on private.password_vault from public, anon, authenticated;

-- 2. Email login unik (benar juga untuk baris yang belum tersimpan) ------------
create or replace function private.auth_email_for(p_user public.users)
returns text language sql stable set search_path = '' as $$
  select case
    when lower(p_user.nim_nip) ~ '^[a-z0-9._-]+$'
     and not exists (select 1 from public.users u
                      where lower(u.nim_nip) = lower(p_user.nim_nip) and u.id <> p_user.id)
      then lower(p_user.nim_nip) || '@cat.poltektrans.local'
    else 'u' || replace(p_user.id::text, '-', '') || '@cat.poltektrans.local'
  end
$$;

-- 3. Sinkron satu user ke Supabase Auth + brankas -------------------------------
-- p_password NULL = password tidak berubah.
create or replace function private.sync_auth(p_user public.users, p_password text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_email  text := private.auth_email_for(p_user);
  v_auth   uuid := p_user.auth_id;
  v_banned timestamptz := case when coalesce(p_user.status, 'active') = 'active'
                               then null else 'infinity'::timestamptz end;
begin
  if v_auth is not null and not exists (select 1 from auth.users a where a.id = v_auth) then
    v_auth := null;
  end if;

  if exists (select 1 from auth.users a where a.email = v_email
              and (v_auth is null or a.id <> v_auth)) then
    v_email := 'u' || replace(p_user.id::text, '-', '') || '@cat.poltektrans.local';
  end if;

  if v_auth is not null then
    update auth.users
       set email = v_email,
           banned_until = v_banned,
           encrypted_password = case when p_password is not null
             then extensions.crypt(p_password, extensions.gen_salt('bf', 10))
             else encrypted_password end,
           updated_at = now()
     where id = v_auth;
    update auth.identities
       set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_email)),
           updated_at = now()
     where user_id = v_auth and provider = 'email';
  elsif p_password is not null then
    v_auth := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, banned_until, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_auth, 'authenticated', 'authenticated',
      v_email, extensions.crypt(p_password, extensions.gen_salt('bf', 10)), now(), v_banned,
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'),
                         'users_id', p_user.id, 'app_role', p_user.role),
      jsonb_build_object('nama_lengkap', p_user.nama), now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_auth, v_auth::text, 'email',
      jsonb_build_object('sub', v_auth::text, 'email', v_email, 'email_verified', true),
      null, now(), now());
  end if;

  if p_password is not null then
    insert into private.password_vault (user_id, enc, updated_at)
    values (p_user.id, extensions.pgp_sym_encrypt(p_password, private.vault_key()), now())
    on conflict (user_id) do update set enc = excluded.enc, updated_at = now();
  end if;

  return v_auth;
end;
$$;
revoke all on function private.sync_auth(public.users, text) from public, anon, authenticated;

-- Trigger: kolom password jadi "tulis saja"
create or replace function private.trg_users_password()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_pw text := nullif(new.password, '');
begin
  if tg_op = 'UPDATE' and v_pw is null
     and new.nim_nip is not distinct from old.nim_nip
     and new.status is not distinct from old.status then
    new.password := null;
    return new;
  end if;
  new.auth_id := coalesce(private.sync_auth(new, v_pw), new.auth_id);
  new.password := null;
  return new;
end;
$$;

drop trigger if exists on_users_sync_auth on public.users;
drop function if exists private.trg_users_sync_auth();
drop function if exists private.ensure_auth_user(uuid);
drop trigger if exists b_users_password on public.users;
create trigger b_users_password
  before insert or update of password, nim_nip, status on public.users
  for each row execute function private.trg_users_password();

-- Hapus user -> hapus akun Supabase Auth dan isi brankasnya
create or replace function private.trg_users_delete_auth()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.auth_id is not null then
    delete from auth.users where id = old.auth_id;
  end if;
  delete from private.password_vault where user_id = old.id;
  return old;
end;
$$;
drop trigger if exists on_users_delete_auth on public.users;
create trigger on_users_delete_auth
  after delete on public.users
  for each row execute function private.trg_users_delete_auth();

-- 4. Pindahkan password lama ke brankas, kosongkan kolomnya -------------------
insert into private.password_vault (user_id, enc)
select id, extensions.pgp_sym_encrypt(password, private.vault_key())
  from public.users
 where password is not null and password <> ''
on conflict (user_id) do update set enc = excluded.enc, updated_at = now();

update public.users set password = null where password is not null;

-- Salinan backup juga tidak boleh menyimpan password polos
do $$
begin
  if to_regclass('backup_20261122.users') is not null then
    update backup_20261122.users set password = null;
  end if;
end $$;

-- 5. RPC: lihat password (SUPERADMIN saja, tercatat) ---------------------------
create or replace function public.admin_view_passwords(p_user_ids uuid[])
returns table (user_id uuid, password text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if private.app_role() is distinct from 'superadmin' then
    raise exception 'Hanya superadmin yang bisa melihat password' using errcode = '42501';
  end if;

  insert into public.audit_logs (user_id, action, table_name, extra_data, created_at)
  values (auth.uid(), 'VIEW_PASSWORD', 'users',
          jsonb_build_object('jumlah', coalesce(array_length(p_user_ids, 1), 0),
                             'user_ids', to_jsonb(p_user_ids),
                             'oleh', private.app_user_id()),
          now());

  return query
    select v.user_id, extensions.pgp_sym_decrypt(v.enc, private.vault_key())
      from private.password_vault v
     where v.user_id = any(p_user_ids);
end;
$$;
revoke all on function public.admin_view_passwords(uuid[]) from public;
grant execute on function public.admin_view_passwords(uuid[]) to authenticated;

-- 6. RLS tabel users ------------------------------------------------------------
create or replace function private.is_user_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.app_role() in ('superadmin', 'admin', 'admin_prodi'), false)
$$;
revoke all on function private.is_user_admin() from public;
grant execute on function private.is_user_admin() to anon, authenticated;

-- Penjaga kolom (SECURITY INVOKER: current_user = peran pemanggil)
create or replace function private.trg_users_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_role text;
  v_self_cols text[] := array['nama', 'email', 'password', 'photo', 'no_hp', 'avatar_url',
                              'session_token', 'ttd_qr_enabled', 'nip', 'updated_at'];
  v_pusb_cols text[] := array['nilai_kondite', 'nilai_semapta', 'updated_at'];
begin
  if current_user not in ('anon', 'authenticated') then
    return coalesce(new, old);   -- fungsi server / SQL Editor
  end if;
  v_role := private.app_role();
  if v_role is null then
    raise exception 'Silakan login ulang' using errcode = '42501';
  end if;

  -- Akun superadmin hanya bisa dibuat/diubah/dihapus oleh superadmin
  if v_role <> 'superadmin'
     and ((tg_op <> 'INSERT' and old.role = 'superadmin')
          or (tg_op <> 'DELETE' and new.role = 'superadmin')) then
    raise exception 'Hanya superadmin yang bisa mengelola akun superadmin' using errcode = '42501';
  end if;

  if v_role in ('superadmin', 'admin', 'admin_prodi') then
    return coalesce(new, old);
  end if;

  if tg_op <> 'UPDATE' then
    raise exception 'Hanya admin yang bisa menambah/menghapus user' using errcode = '42501';
  end if;

  if new.id = private.app_user_id() then
    if (to_jsonb(new) - v_self_cols) is distinct from (to_jsonb(old) - v_self_cols) then
      raise exception 'Peran, status, dan NIM/NIP hanya bisa diubah admin' using errcode = '42501';
    end if;
    return new;
  end if;

  if v_role = 'pusbangkatar' then
    if (to_jsonb(new) - v_pusb_cols) is distinct from (to_jsonb(old) - v_pusb_cols) then
      raise exception 'Pusbangkatar hanya bisa mengubah nilai kondite/semapta' using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'Tidak boleh mengubah data user lain' using errcode = '42501';
end;
$$;

drop trigger if exists a_users_guard on public.users;
create trigger a_users_guard
  before insert or update or delete on public.users
  for each row execute function private.trg_users_guard();

alter table public.users enable row level security;
drop policy if exists "Allow all access" on public.users;
drop policy if exists users_select on public.users;
drop policy if exists users_admin_all on public.users;
drop policy if exists users_self_update on public.users;
drop policy if exists users_pusbangkatar_update on public.users;
create policy users_select on public.users
  for select to authenticated using (true);
create policy users_admin_all on public.users
  for all to authenticated using (private.is_user_admin()) with check (private.is_user_admin());
create policy users_self_update on public.users
  for update to authenticated
  using (id = private.app_user_id()) with check (id = private.app_user_id());
create policy users_pusbangkatar_update on public.users
  for update to authenticated
  using (private.app_role() = 'pusbangkatar') with check (private.app_role() = 'pusbangkatar');
revoke all on public.users from anon;

-- 7. staff_accounts: tidak dipakai aplikasi mana pun -> kunci total ----------
alter table public.staff_accounts enable row level security;
drop policy if exists "Staff accounts can be accessed by everyone" on public.staff_accounts;
revoke all on public.staff_accounts from anon, authenticated;

-- 8. audit_logs: catat boleh, baca admin, ubah/hapus tidak ---------------------
alter table public.audit_logs enable row level security;
drop policy if exists audit_all_access on public.audit_logs;
drop policy if exists audit_insert on public.audit_logs;
drop policy if exists audit_admin_select on public.audit_logs;
create policy audit_insert on public.audit_logs
  for insert to authenticated with check (true);
create policy audit_admin_select on public.audit_logs
  for select to authenticated using (private.is_user_admin());
revoke all on public.audit_logs from anon;
revoke update, delete, truncate on public.audit_logs from authenticated;
