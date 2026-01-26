-- =============================================================================
-- FIX IZIN KEHADIRAN (ATTENDANCE PERMISSIONS)
-- =============================================================================
-- Masalah: Daftar hadir tidak update (Pengawas mungkin tidak bisa baca hasil_ujian).
-- Solusi: Berikan akses SELECT eksplisit untuk Pengawas ke tabel users dan hasil_ujian.
-- =============================================================================

-- 1. Izin Baca USERS (Untuk melihat daftar nama mahasiswa)
DROP POLICY IF EXISTS "Staff can view all users" ON public.users;
CREATE POLICY "Staff can view all users"
ON public.users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role IN ('dosen', 'pengawas', 'superadmin', 'admin_prodi')
  )
);

-- 2. Izin Baca HASIL UJIAN (Untuk update status kehadiran otomatis)
DROP POLICY IF EXISTS "Staff can view all results" ON public.hasil_ujian;
CREATE POLICY "Staff can view all results"
ON public.hasil_ujian
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid()
    AND users.role IN ('dosen', 'pengawas', 'superadmin', 'admin_prodi')
  )
);

-- 3. Izin Baca JADWAL & MATKUL (Backup, biasanya sudah ada public access)
ALTER TABLE jadwal_ujian FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON jadwal_ujian; -- Reset jika perlu, atau gunakan policy di bawah

CREATE POLICY "Staff view jadwal"
ON public.jadwal_ujian
FOR SELECT
USING (true); -- Public read OK untuk jadwal, atau batasi ke staff

-- Note: Kita gunakan true untuk SELECT jadwal agar aman dari side-effect,
-- karena mahasiswa juga perlu lihat jadwal.

