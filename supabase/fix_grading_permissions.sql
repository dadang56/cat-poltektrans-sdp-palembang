-- =============================================================================
-- FIX IZIN KOREKSI (GRADING PERMISSIONS)
-- =============================================================================
-- Masalah: Dosen tidak bisa menyimpan nilai karena tidak punya izin UPDATE di tabel hasil_ujian.
-- Solusi: Tambahkan policy UPDATE untuk role Dosen, Pengawas, dan Admin.
-- =============================================================================

-- 1. Berikan hak akses UPDATE ke tabel hasil_ujian untuk Staff (Dosen/Pengawas/Admin)
DROP POLICY IF EXISTS "Staff can update results" ON public.hasil_ujian;

CREATE POLICY "Staff can update results"
ON public.hasil_ujian
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role IN ('dosen', 'pengawas', 'superadmin', 'admin_prodi')
  )
);

-- 2. Berikan hak akses UPDATE ke tabel jawaban_mahasiswa (jika scoring per soal)
DROP POLICY IF EXISTS "Staff can update jawaban" ON public.jawaban_mahasiswa;

CREATE POLICY "Staff can update jawaban"
ON public.jawaban_mahasiswa
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role IN ('dosen', 'pengawas', 'superadmin', 'admin_prodi')
  )
);

-- Catatan:
-- Policy "Staff can view all results" (SELECT) diasumsikan sudah ada dari script sebelumnya.
-- Jika belum, script ini aman dijalankan bersamaan dengan fix_monitor_rls_v2.sql
