-- ============================================
-- GRADE CALCULATION: DATABASE SCHEMA UPDATES
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. UPDATE MATA_KULIAH TABLE - Add SKS Teori & Praktek
-- ============================================
ALTER TABLE mata_kuliah 
  ADD COLUMN IF NOT EXISTS sks_teori INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS sks_praktek INTEGER DEFAULT 0;

-- Update existing rows: set sks_teori = sks, sks_praktek = 0
UPDATE mata_kuliah 
SET sks_teori = COALESCE(sks, 2), sks_praktek = 0 
WHERE sks_teori IS NULL OR sks_teori = 0;

-- ============================================
-- 2. UPDATE HASIL_UJIAN TABLE - Add Grade Components
-- ============================================
ALTER TABLE hasil_ujian 
  ADD COLUMN IF NOT EXISTS nilai_tugas DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nilai_praktek DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nilai_uts DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nilai_uas DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nilai_akhir DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nilai_huruf VARCHAR(2) DEFAULT 'E',
  ADD COLUMN IF NOT EXISTS bobot DECIMAL(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS predikat VARCHAR(20) DEFAULT 'Sangat Kurang';

-- ============================================
-- 3. CREATE GRADE CALCULATION FUNCTION (Optional)
-- ============================================
-- This function can be used to calculate grades in PostgreSQL
CREATE OR REPLACE FUNCTION calculate_grade(
  nt DECIMAL,
  np DECIMAL,
  nuts DECIMAL,
  nuas DECIMAL,
  has_praktek BOOLEAN
) RETURNS TABLE(
  nak DECIMAL,
  huruf VARCHAR,
  bobot DECIMAL,
  predikat VARCHAR
) AS $$
DECLARE
  final_grade DECIMAL;
  letter_grade VARCHAR;
  grade_bobot DECIMAL;
  grade_predikat VARCHAR;
BEGIN
  -- Calculate NAK based on formula
  IF has_praktek THEN
    -- With Praktek: (NT*10%) + (NP*20%) + (NUTS*20%) + (NUAS*50%)
    final_grade := (COALESCE(nt, 0) * 0.10) + 
                   (COALESCE(np, 0) * 0.20) + 
                   (COALESCE(nuts, 0) * 0.20) + 
                   (COALESCE(nuas, 0) * 0.50);
  ELSE
    -- Without Praktek: (NT*10%) + (NUTS*30%) + (NUAS*60%)
    final_grade := (COALESCE(nt, 0) * 0.10) + 
                   (COALESCE(nuts, 0) * 0.30) + 
                   (COALESCE(nuas, 0) * 0.60);
  END IF;

  -- Convert to letter grade
  IF final_grade > 80 THEN
    letter_grade := 'A';
    grade_bobot := 4.00;
    grade_predikat := 'Sangat Baik';
  ELSIF final_grade > 75 THEN
    letter_grade := 'AB';
    grade_bobot := 3.50;
    grade_predikat := 'Lebih Dari Baik';
  ELSIF final_grade > 69 THEN
    letter_grade := 'B';
    grade_bobot := 3.00;
    grade_predikat := 'Baik';
  ELSIF final_grade > 60 THEN
    letter_grade := 'BC';
    grade_bobot := 2.50;
    grade_predikat := 'Lebih Dari Cukup';
  ELSIF final_grade > 55 THEN
    letter_grade := 'C';
    grade_bobot := 2.00;
    grade_predikat := 'Cukup';
  ELSIF final_grade > 44 THEN
    letter_grade := 'D';
    grade_bobot := 1.00;
    grade_predikat := 'Kurang';
  ELSE
    letter_grade := 'E';
    grade_bobot := 0.00;
    grade_predikat := 'Sangat Kurang';
  END IF;

  RETURN QUERY SELECT final_grade, letter_grade, grade_bobot, grade_predikat;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. VERIFY CHANGES
-- ============================================
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'mata_kuliah'
ORDER BY ordinal_position;

SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'hasil_ujian'
ORDER BY ordinal_position;
