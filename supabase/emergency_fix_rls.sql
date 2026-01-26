-- =============================================================================
-- EMERGENCY FIX: IZINKAN AKSES PUBLIC (LEGACY/GUEST MODE)
-- =============================================================================
-- PENTING: Gunakan script ini JIKA DAN HANYA JIKA mahasiswa login menggunakan 
-- akun lama (Legacy) yang belum terdaftar di menu "Authentication" Supabase.
--
-- Masalah: Akun Legacy login sebagai "Tamu" (Anon), sehingga diblokir RLS.
-- Solusi: Membuka kunci tabel hasil_ujian dan jawaban_mahasiswa untuk role 'anon'.
-- =============================================================================

-- 1. BUKA TABEL HASIL UJIAN (Untuk Monitor & Nilai)
DROP POLICY IF EXISTS "Public (Anon) insert results" ON public.hasil_ujian;
CREATE POLICY "Public (Anon) insert results"
ON public.hasil_ujian
FOR INSERT
WITH CHECK (
  auth.role() = 'anon' OR auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Public (Anon) update results" ON public.hasil_ujian;
CREATE POLICY "Public (Anon) update results"
ON public.hasil_ujian
FOR UPDATE
USING (
  auth.role() = 'anon' OR auth.role() = 'authenticated'
);

-- Lihat hasil sendiri (Kita pakai logika sederhana: boleh lihat punya siapa saja 
-- ATAU filter di frontend. Karena anon tidak punya ID pasti di database level)
DROP POLICY IF EXISTS "Public (Anon) select results" ON public.hasil_ujian;
CREATE POLICY "Public (Anon) select results"
ON public.hasil_ujian
FOR SELECT
USING (true);


-- 2. BUKA TABEL JAWABAN MAHASISWA (Untuk Detail Jawaban Essay/PG)
DROP POLICY IF EXISTS "Public (Anon) insert jawaban" ON public.jawaban_mahasiswa;
CREATE POLICY "Public (Anon) insert jawaban"
ON public.jawaban_mahasiswa
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Public (Anon) update jawaban" ON public.jawaban_mahasiswa;
CREATE POLICY "Public (Anon) update jawaban"
ON public.jawaban_mahasiswa
FOR UPDATE
USING (true);

DROP POLICY IF EXISTS "Public (Anon) select jawaban" ON public.jawaban_mahasiswa;
CREATE POLICY "Public (Anon) select jawaban"
ON public.jawaban_mahasiswa
FOR SELECT
USING (true);

-- Catatan:
-- Ini membuat database "Trust Client". Artinya aplikasi Frontend bertanggung jawab
-- memvalidasi siapa user itu (yang sudah ditangani oleh authService.js).
-- Ini solusi tercepat agar sistem berjalan SEKARANG.
