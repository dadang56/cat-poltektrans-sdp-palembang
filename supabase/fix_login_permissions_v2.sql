-- =============================================================================
-- FIX LOGIN PERMISSIONS (SOLUSI MASALAH LOGIN)
-- =============================================================================
-- Masalah: Aplikasi tidak bisa menemukan User (NIM/NIP) karena diblokir keamanan.
-- Solusi: Izinkan publik membaca tabel `users` agar bisa verifikasi login.
-- =============================================================================

-- 1. Reset Policy untuk Tabel Users
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Public can view users" ON public.users;
DROP POLICY IF EXISTS "Staff can view all users" ON public.users; -- Reset yang lama

-- 2. Buat Policy BARU yang Mengizinkan LOGIN
-- Ini mengizinkan SIAPAPUN (termasuk saat belum login) untuk membaca data user.
-- Diperlukan agar aplikasi bisa mengecek apakah user ada atau tidak.
DROP POLICY IF EXISTS "Allow Public Read for Login" ON public.users;
CREATE POLICY "Allow Public Read for Login"
ON public.users
FOR SELECT
USING (true);

-- 3. Pastikan Policy Update Login juga ada (Untuk Session Token)
DROP POLICY IF EXISTS "Users can update own login session" ON public.users;

CREATE POLICY "Users can update own login session"
ON public.users
FOR UPDATE
USING (true)  -- Mengizinkan update (aplikasi membatasi via logika login)
WITH CHECK (true);
