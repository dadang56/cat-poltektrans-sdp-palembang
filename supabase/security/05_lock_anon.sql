-- =============================================================================
-- SECURITY FIX TAHAP 3a — tutup semua tabel untuk pengunjung tanpa login
--
-- Pengguna yang SUDAH LOGIN tidak merasakan perubahan apa pun: hak akses
-- mereka sama seperti sebelumnya. Yang ditutup hanya akses tanpa login
-- (anon key yang ada di browser).
--
-- Pengecualian: app_settings tetap boleh DIBACA tanpa login (logo, nama
-- kampus, pengaturan halaman login, file SEB), tapi hanya admin yang bisa
-- mengubahnya.
-- =============================================================================

-- 1. Cabut semua hak anon di schema public, kecuali baca app_settings
do $$
declare r record;
begin
  for r in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
       and c.relname <> 'app_settings'
  loop
    execute format('revoke all on public.%I from anon', r.relname);
  end loop;
end $$;

revoke insert, update, delete, truncate on public.app_settings from anon;
grant select on public.app_settings to anon;

-- Tabel baru nanti juga tidak otomatis terbuka untuk anon
alter default privileges in schema public revoke all on tables from anon;

-- 2. app_settings: semua boleh baca, hanya admin yang mengubah
alter table public.app_settings enable row level security;
drop policy if exists "Allow all access" on public.app_settings;
drop policy if exists "Authenticated can manage app_settings" on public.app_settings;
drop policy if exists "Anyone can read app_settings" on public.app_settings;
drop policy if exists app_settings_read on public.app_settings;
drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_read on public.app_settings
  for select to anon, authenticated using (true);
create policy app_settings_admin_write on public.app_settings
  for all to authenticated
  using (private.is_user_admin()) with check (private.is_user_admin());

-- 3. Fungsi lama SECURITY DEFINER tidak boleh dipanggil tanpa login
do $$
declare f text;
begin
  foreach f in array array[
    'public.is_admin()', 'public.sync_user_claims()', 'public.handle_new_user()',
    'public.delete_auth_user_on_public_delete()', 'public.avoid_duplicate_matakuliah_id()']
  loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon', f);
      execute format('grant execute on function %s to authenticated', f);
    end if;
  end loop;
end $$;
