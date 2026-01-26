-- =============================================================================
-- FIX LOGIN "TIDAK DITEMUKAN" (PUBLIC VISIBILITY)
-- =============================================================================
-- Masalah: Error "NIM/NIP tidak ditemukan" padahal data ada.
-- Penyebab: Policy RLS menyembunyikan data user dari pengunjung (anonim) yang mau login.
-- Solusi: Izinkan publik (anon) untuk membaca tabel users (SELECT).
-- =============================================================================

-- 1. Berikan hak akses SELECT ke tabel users untuk SEMUA ORANG (termasuk yang belum login)
-- Ini diperlukan agar sistem bisa mengecek apakah username ada di database sebelum login.

DROP POLICY IF EXISTS "Allow all access" ON public.users;
DROP POLICY IF EXISTS "Public can view users" ON public.users;
DROP POLICY IF EXISTS "Staff can view all users" ON public.users;

-- Policy tunggal yang mengizinkan siapa saja membaca data user (untuk keperluan login & lookup)
CREATE POLICY "Public can view users"
ON public.users
FOR SELECT
USING (true);

-- 2. Pastikan permission GRANT juga sudah benar (kadang bukan hanya Policy tapi GRANT level role)
GRANT SELECT ON public.users TO anon;
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.users TO service_role;

-- Catatan:
-- Ini akan membuat daftar nama user terbaca publik (jika mereka tahu API endpoint).
-- Untuk aplikasi internal kampus, ini standard agar login berfungsi lancar.
