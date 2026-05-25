-- ============================================
-- MIGRATION: Ujian Ulang (Remedial Exam)
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Expand jadwal_ujian.tipe to allow 'ULANG'
ALTER TABLE jadwal_ujian DROP CONSTRAINT IF EXISTS jadwal_ujian_tipe_check;
ALTER TABLE jadwal_ujian ADD CONSTRAINT jadwal_ujian_tipe_check 
  CHECK (tipe IN ('UTS', 'UAS', 'ULANG'));

-- 2. Add parent_jadwal_id — links remedial exam to the original exam
ALTER TABLE jadwal_ujian ADD COLUMN IF NOT EXISTS parent_jadwal_id UUID REFERENCES jadwal_ujian(id) ON DELETE SET NULL;

-- 3. Add ulang_ke — which remedial attempt (0 = original, 1 = first retry, 2 = second retry)
ALTER TABLE jadwal_ujian ADD COLUMN IF NOT EXISTS ulang_ke INTEGER DEFAULT 0;

-- 4. Add nilai_final to hasil_ujian — the capped score (max 70 for remedial)
ALTER TABLE hasil_ujian ADD COLUMN IF NOT EXISTS nilai_final DECIMAL(5,2);

-- 5. Add is_ulang flag to hasil_ujian
ALTER TABLE hasil_ujian ADD COLUMN IF NOT EXISTS is_ulang BOOLEAN DEFAULT false;

-- 6. Index for efficient lookup of remedial exams
CREATE INDEX IF NOT EXISTS idx_jadwal_parent ON jadwal_ujian(parent_jadwal_id);
CREATE INDEX IF NOT EXISTS idx_hasil_is_ulang ON hasil_ujian(is_ulang);

-- ============================================
-- BACKFILL: Set nilai_final = nilai_total for all existing records
-- ============================================
UPDATE hasil_ujian SET nilai_final = nilai_total WHERE nilai_final IS NULL;

COMMIT;
