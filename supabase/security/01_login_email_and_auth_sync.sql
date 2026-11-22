-- =============================================================================
-- SECURITY FIX TAHAP 1a — fondasi login lewat Supabase Auth
-- Dipakai bersama oleh CAT, SIAKAD, dan LMS (satu database).
--
-- Aman dijalankan kapan saja: TIDAK mengubah perilaku aplikasi yang sedang
-- jalan. Belum ada akun yang dipindahkan di file ini.
--
-- Isi:
--   1. private.auth_email_for()  – email login unik per user
--   2. private.ensure_auth_user() – buat / perbarui akun Supabase Auth dari
--      baris public.users (password SAMA, hanya disimpan ter-hash bcrypt)
--   3. public.login_email()       – RPC untuk halaman login: NIM/NIP/username
--      -> email Supabase Auth. Tidak pernah mengembalikan password.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- 1. Email login ---------------------------------------------------------------
-- Pakai NIM/NIP (huruf kecil) bila aman dipakai sebagai email, supaya kode
-- lama yang membentuk email dari NIM tetap cocok. Selain itu pakai id user.
create or replace function private.auth_email_for(p_user public.users)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when lower(p_user.nim_nip) ~ '^[a-z0-9._-]+$'
     and (select count(*) from public.users u
          where lower(u.nim_nip) = lower(p_user.nim_nip)) = 1
      then lower(p_user.nim_nip) || '@cat.poltektrans.local'
    else 'u' || replace(p_user.id::text, '-', '') || '@cat.poltektrans.local'
  end
$$;

-- 2. Buat / sinkronkan akun Supabase Auth --------------------------------------
create or replace function private.ensure_auth_user(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  u        public.users;
  v_email  text;
  v_auth   uuid;
  v_hash   text;
  v_banned timestamptz;
begin
  select * into u from public.users where id = p_user_id;
  if not found or u.password is null or u.password = '' then
    return null;
  end if;

  v_email  := private.auth_email_for(u);
  v_hash   := extensions.crypt(u.password, extensions.gen_salt('bf', 10));
  v_banned := case when coalesce(u.status, 'active') = 'active'
                   then null else 'infinity'::timestamptz end;

  if u.auth_id is not null
     and exists (select 1 from auth.users a where a.id = u.auth_id) then
    -- Sudah punya akun: samakan password, email, dan status aktif
    update auth.users
       set encrypted_password = v_hash,
           email              = v_email,
           banned_until       = v_banned,
           updated_at         = now()
     where id = u.auth_id;
    update auth.identities
       set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_email)),
           updated_at    = now()
     where user_id = u.auth_id and provider = 'email';
    return u.auth_id;
  end if;

  -- Email sudah dipakai akun lain? Pakai email berbasis id.
  if exists (select 1 from auth.users a where a.email = v_email) then
    v_email := 'u' || replace(u.id::text, '-', '') || '@cat.poltektrans.local';
  end if;

  v_auth := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, banned_until,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_auth, 'authenticated', 'authenticated',
    v_email, v_hash, now(), v_banned,
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'),
                       'users_id', u.id, 'app_role', u.role),
    jsonb_build_object('nama_lengkap', u.nama),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_auth, v_auth::text, 'email',
    jsonb_build_object('sub', v_auth::text, 'email', v_email, 'email_verified', true),
    null, now(), now()
  );

  -- Tandai tanpa memicu trigger sinkron lagi
  update public.users set auth_id = v_auth where id = u.id;
  return v_auth;
end;
$$;

revoke all on function private.ensure_auth_user(uuid) from public, anon, authenticated;

-- 3. RPC untuk halaman login ---------------------------------------------------
-- Input: NIM/NIP atau username. Output: email Supabase Auth, atau NULL bila
-- akun belum dipindahkan / tidak aktif (aplikasi lalu memakai jalur lama).
create or replace function public.login_email(p_identifier text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select a.email
    from public.users u
    join auth.users a on a.id = u.auth_id
   where (lower(u.nim_nip) = lower(trim(p_identifier))
          or lower(u.username) = lower(trim(p_identifier)))
     and coalesce(u.status, 'active') = 'active'
   order by (lower(u.nim_nip) = lower(trim(p_identifier))) desc
   limit 1
$$;

revoke all on function public.login_email(text) from public;
grant execute on function public.login_email(text) to anon, authenticated;
