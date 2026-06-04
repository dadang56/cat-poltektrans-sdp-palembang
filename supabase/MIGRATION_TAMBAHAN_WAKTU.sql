-- ============================================
-- MIGRATION: Add tambahan_waktu column to hasil_ujian
-- Purpose: Allow pengawas/admin prodi to add extra time for students
--          who lost time due to technical issues (network, device crashes)
-- ============================================

-- Add tambahan_waktu column (in minutes, default 0)
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS tambahan_waktu INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN hasil_ujian.tambahan_waktu IS 'Extra time in minutes added by pengawas/admin prodi for students with technical issues';
