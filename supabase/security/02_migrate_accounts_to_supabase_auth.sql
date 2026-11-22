-- =============================================================================
-- SECURITY FIX TAHAP 1b — pindahkan semua akun ke Supabase Auth
--
-- JALANKAN HANYA SETELAH versi baru CAT, LMS, dan SIAKAD (yang login lewat
-- RPC login_email) sudah ter-deploy di Vercel. Versi lama CAT/LMS membentuk
-- email dari teks yang diketik user, jadi user yang login pakai username
-- akan gagal kalau file ini dijalankan lebih dulu.
--
-- Password user TIDAK berubah: hash bcrypt dibuat dari password yang sama.
-- Kolom public.users.password belum dihapus di tahap ini; trigger di bawah
-- menjaga Supabase Auth tetap sama setiap kali admin mengubah password,
-- NIM/NIP, atau status lewat aplikasi mana pun.
-- =============================================================================

-- Sinkron otomatis: insert / ubah password, NIM/NIP, status -> Supabase Auth
create or replace function private.trg_users_sync_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.ensure_auth_user(new.id);
  return new;
end;
$$;

drop trigger if exists on_users_sync_auth on public.users;
create trigger on_users_sync_auth
  after insert or update of password, nim_nip, status on public.users
  for each row execute function private.trg_users_sync_auth();

-- Hapus user -> hapus juga akun Supabase Auth-nya
create or replace function private.trg_users_delete_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.auth_id is not null then
    delete from auth.users where id = old.auth_id;
  end if;
  return old;
end;
$$;

drop trigger if exists on_users_delete_auth on public.users;
create trigger on_users_delete_auth
  after delete on public.users
  for each row execute function private.trg_users_delete_auth();

-- Pindahkan semua akun yang belum punya auth_id
select count(private.ensure_auth_user(id)) as dipindahkan
  from public.users
 where auth_id is null;

-- Cek: harus 0
select count(*) as belum_pindah from public.users where auth_id is null;
