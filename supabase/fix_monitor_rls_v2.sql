-- =============================================================================
-- FIX AKSES DATA (REVISI FINAL)
-- =============================================================================
-- Masalah sebelumnya: ID User di database (mahasiswa_id) BERBEDA dengan ID Login (auth.uid()).
-- Ini menyebabkan siswa gagal menyimpan data ujian karena izin ditolak.
-- Solusi: Policy harus mengecek tabel `users` untuk mencocokkan ID Login dengan ID Mahasiswa.
-- =============================================================================

-- Hapus policy yang salah sebelumnya (jika ada)
DROP POLICY IF EXISTS "Mahasiswa can insert own results" ON public.hasil_ujian;
DROP POLICY IF EXISTS "Mahasiswa can update own results" ON public.hasil_ujian;
DROP POLICY IF EXISTS "Mahasiswa can view own results" ON public.hasil_ujian;

-- 1. UTAMA: Izinkan Mahasiswa INSERT (Mulai Ujian)
-- Cek apakah mahasiswa_id yang dikirim sesuai dengan User ID milik akun yang login.
CREATE POLICY "Mahasiswa can insert own results"
ON public.hasil_ujian
FOR INSERT
WITH CHECK (
  mahasiswa_id IN (
    SELECT id FROM public.users WHERE auth_id = auth.uid()
  )
);

-- 2. UTAMA: Izinkan Mahasiswa UPDATE (Jawab/Submit Ujian)
CREATE POLICY "Mahasiswa can update own results"
ON public.hasil_ujian
FOR UPDATE
USING (
  mahasiswa_id IN (
    SELECT id FROM public.users WHERE auth_id = auth.uid()
  )
);

-- 3. UTAMA: Izinkan Mahasiswa SELECT (Lihat Hasil Sendiri)
CREATE POLICY "Mahasiswa can view own results"
ON public.hasil_ujian
FOR SELECT
USING (
  mahasiswa_id IN (
    SELECT id FROM public.users WHERE auth_id = auth.uid()
  )
);

-- 4. Pastikan Pengawas & Dosen Bisa Melihat Semua (Backup/Re-apply)
DROP POLICY IF EXISTS "Staff can view all results" ON public.hasil_ujian;
CREATE POLICY "Staff can view all results"
ON public.hasil_ujian
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role IN ('pengawas', 'dosen', 'superadmin', 'admin_prodi')
  )
);

-- 5. PENTING: Fix Tabel JAWABAN MAHASISWA (Detail Jawaban)
-- Ini sering lupa di-set, menyebabkan detail jawaban gagal tersimpan.
ALTER TABLE public.jawaban_mahasiswa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mahasiswa insert jawaban" ON public.jawaban_mahasiswa;
CREATE POLICY "Mahasiswa insert jawaban"
ON public.jawaban_mahasiswa
FOR INSERT
WITH CHECK (
  mahasiswa_id IN (
    SELECT id FROM public.users WHERE auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Mahasiswa select jawaban" ON public.jawaban_mahasiswa;
CREATE POLICY "Mahasiswa select jawaban"
ON public.jawaban_mahasiswa
FOR SELECT
USING (
  mahasiswa_id IN (
    SELECT id FROM public.users WHERE auth_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Staff view jawaban" ON public.jawaban_mahasiswa;
CREATE POLICY "Staff view jawaban"
ON public.jawaban_mahasiswa
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role IN ('pengawas', 'dosen', 'superadmin', 'admin_prodi')
  )
);
