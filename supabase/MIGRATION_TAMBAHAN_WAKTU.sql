-- ============================================
-- MIGRATION: Add missing columns to hasil_ujian
-- Run this in Supabase SQL Editor
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

-- 5. Relax status CHECK constraint to support new statuses
-- First drop the existing constraint, then add new one
ALTER TABLE hasil_ujian DROP CONSTRAINT IF EXISTS hasil_ujian_status_check;
ALTER TABLE hasil_ujian ADD CONSTRAINT hasil_ujian_status_check 
CHECK (status IN ('pending', 'in_progress', 'submitted', 'graded', 'kicked', 'cheating_submitted', 'needs_approval'));

-- Done! All columns now exist.
SELECT 'Migration completed successfully!' AS result;
