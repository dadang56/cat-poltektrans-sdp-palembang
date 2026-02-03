-- ============================================
-- MIGRATION SCRIPT - ADD MISSING COLUMNS
-- ============================================
-- Script ini TIDAK akan menghapus data yang sudah ada
-- Hanya menambahkan kolom-kolom yang hilang
-- Jalankan di Supabase SQL Editor
-- ============================================

-- 1. Add missing columns to USERS table (for dosen)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS nip VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS prodi_ids TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kelas_ids TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS matkul_ids TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT;

-- 2. Add missing columns to MATA_KULIAH table
ALTER TABLE mata_kuliah ADD COLUMN IF NOT EXISTS semester INTEGER DEFAULT 1;
ALTER TABLE mata_kuliah ADD COLUMN IF NOT EXISTS sks_teori INTEGER DEFAULT 2;

-- 3. Make sure KELAS has angkatan column
ALTER TABLE kelas ADD COLUMN IF NOT EXISTS angkatan INTEGER;

-- 4. Fix SOAL table - drop and recreate constraint to allow more tipe_soal values
-- First, drop the old constraint
ALTER TABLE soal DROP CONSTRAINT IF EXISTS soal_tipe_soal_check;

-- Then create new constraint with all allowed values
ALTER TABLE soal ADD CONSTRAINT soal_tipe_soal_check 
    CHECK (tipe_soal IN ('pilihan_ganda', 'pilihan_ganda_kompleks', 'benar_salah', 'menjodohkan', 'uraian', 'essay'));

-- 5. Make sure gambar column exists in soal table
ALTER TABLE soal ADD COLUMN IF NOT EXISTS gambar TEXT;

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'Migration completed!' as status;

-- Show users columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('username', 'nip', 'prodi_ids', 'kelas_ids', 'matkul_ids', 'photo');

-- Show mata_kuliah columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'mata_kuliah' 
AND column_name IN ('semester', 'sks_teori');

-- Show soal constraints
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'soal' AND constraint_type = 'CHECK';
