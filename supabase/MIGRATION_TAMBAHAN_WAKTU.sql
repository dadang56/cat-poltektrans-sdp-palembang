-- ============================================
-- MIGRATION: Add missing columns to hasil_ujian
-- Run this ENTIRE SCRIPT in Supabase SQL Editor
-- ============================================

-- 1. tambahan_waktu: Extra time in minutes added by pengawas
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS tambahan_waktu INTEGER DEFAULT 0;

-- 2. jumlah_pelanggaran: Number of anti-cheat violations
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS jumlah_pelanggaran INTEGER DEFAULT 0;

-- 3. violation_log: JSON log of violation details
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS violation_log TEXT;

-- 4. answers_detail: JSON snapshot of all student answers
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS answers_detail JSONB;

-- 5. nilai_tugas: Task/assignment score for final grade
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS nilai_tugas DECIMAL(5,2);

-- 6. nilai_praktek: Practical score for final grade
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS nilai_praktek DECIMAL(5,2);

-- 7. nilai_uts: Manual UTS override score for final grade
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS nilai_uts DECIMAL(5,2);

-- 8. nilai_uas: Manual UAS override score for final grade
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS nilai_uas DECIMAL(5,2);

-- 9. nilai_final: Final score after remedial/retake
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS nilai_final DECIMAL(5,2);

-- 10. is_ulang: Flag for retake exam
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS is_ulang BOOLEAN DEFAULT false;

-- 11. Relax status CHECK constraint to support new statuses
ALTER TABLE hasil_ujian DROP CONSTRAINT IF EXISTS hasil_ujian_status_check;
ALTER TABLE hasil_ujian ADD CONSTRAINT hasil_ujian_status_check 
CHECK (status IN ('pending', 'in_progress', 'submitted', 'graded', 'kicked', 'cheating_submitted', 'needs_approval'));

-- Done!
SELECT 'Migration completed successfully! All columns added.' AS result;
