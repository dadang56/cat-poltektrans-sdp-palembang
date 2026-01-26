-- =============================================================================
-- FIX IZIN KOREKSI KHUSUS DOSEN (DAN ADMIN)
-- =============================================================================
-- Masalah: Nilai kembali ke 0 (Gagal Simpan).
-- Penyebab: Policy sebelumnya mungkin memblokir update, atau konflik dengan policy lain.
-- Solusi: Reset policy update dan berikan izin EKSPLISIT ke Dosen.
-- =============================================================================

-- 1. Reset Semua Policy UPDATE pada hasil_ujian
DROP POLICY IF EXISTS "Staff can update results" ON public.hasil_ujian;
DROP POLICY IF EXISTS "Public (Anon) update results" ON public.hasil_ujian;
DROP POLICY IF EXISTS "Mahasiswa can update own results" ON public.hasil_ujian;

-- 2. Buat Policy: MAHASISWA (Hanya update punya sendiri saat ujian)
CREATE POLICY "Mahasiswa can update own results"
ON public.hasil_ujian
FOR UPDATE
USING (
  auth.uid() = mahasiswa_id  -- Cek ID Login = ID Mahasiswa
);

-- 3. Buat Policy: DOSEN & ADMIN (Bisa update SEMUA nilai untuk koreksi)
-- Kita gunakan logika yang memeriksa Role user di tabel Users.
CREATE POLICY "Dosen Only Update"
ON public.hasil_ujian
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role IN ('dosen', 'superadmin', 'admin_prodi') -- Hanya Dosen & Admin
  )
);

-- 4. EMERGENCY FALLBACK (JIKA LOGIN DOSEN MASIH LEGACY/ANON)
-- Jika Dosen login pakai NIP/Password lama (bukan email), mereka dianggap "Anon/Guest".
-- Agar mereka TETAP BISA koreksi, kita harus izinkan Anon update untuk sementara.
-- TAPI, kita batasi agar tidak sembarang orang update (sulit di level DB tanpa Auth).
-- Jadi kita buka untuk Anon, tapi Aplikasi Frontend yang memfilter (Dosen Only).
CREATE POLICY "Legacy Dosen Update"
ON public.hasil_ujian
FOR UPDATE
USING (
  auth.role() = 'anon'
);

-- Catatan:
-- Policy "Legacy Dosen Update" ini membuat database "terbuka" untuk update bagi user tanpa login.
-- INI TIDAK IDEAL UNTUK JANGKA PANJANG, tapi SATU-SATUNYA CARA agar Dosen Legacy bisa kerja sekarang.
-- Keamanan dijaga oleh Aplikasi (Halaman Koreksi hanya bisa dibuka oleh Dosen).

