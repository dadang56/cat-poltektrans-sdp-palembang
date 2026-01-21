-- ============================================
-- Migration: Add tahun_akademik to exam-related tables
-- CAT POLTEKTRANS EXAM
-- Run this in Supabase SQL Editor
-- ============================================

BEGIN;

-- 1. Ensure jadwal_ujian has tahun_akademik (already exists but make sure it's properly set up)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jadwal_ujian' AND column_name = 'tahun_akademik'
    ) THEN
        ALTER TABLE jadwal_ujian ADD COLUMN tahun_akademik VARCHAR(30);
    END IF;
END $$;

-- 2. Add tahun_akademik to hasil_ujian
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'hasil_ujian' AND column_name = 'tahun_akademik'
    ) THEN
        ALTER TABLE hasil_ujian ADD COLUMN tahun_akademik VARCHAR(30);
    END IF;
END $$;

-- 3. Add tahun_akademik to kehadiran
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'kehadiran' AND column_name = 'tahun_akademik'
    ) THEN
        ALTER TABLE kehadiran ADD COLUMN tahun_akademik VARCHAR(30);
    END IF;
END $$;

-- 4. Add tahun_akademik to soal (for question bank versioning)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'soal' AND column_name = 'tahun_akademik'
    ) THEN
        ALTER TABLE soal ADD COLUMN tahun_akademik VARCHAR(30);
    END IF;
END $$;

-- 5. Add tahun_akademik to jawaban_mahasiswa
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jawaban_mahasiswa' AND column_name = 'tahun_akademik'
    ) THEN
        ALTER TABLE jawaban_mahasiswa ADD COLUMN tahun_akademik VARCHAR(30);
    END IF;
END $$;

-- 6. Add tahun_akademik to berita_acara
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'berita_acara' AND column_name = 'tahun_akademik'
    ) THEN
        ALTER TABLE berita_acara ADD COLUMN tahun_akademik VARCHAR(30);
    END IF;
END $$;

-- 7. Create indexes for faster queries per academic year
CREATE INDEX IF NOT EXISTS idx_jadwal_tahun_akademik ON jadwal_ujian(tahun_akademik);
CREATE INDEX IF NOT EXISTS idx_hasil_tahun_akademik ON hasil_ujian(tahun_akademik);
CREATE INDEX IF NOT EXISTS idx_kehadiran_tahun_akademik ON kehadiran(tahun_akademik);
CREATE INDEX IF NOT EXISTS idx_soal_tahun_akademik ON soal(tahun_akademik);
CREATE INDEX IF NOT EXISTS idx_jawaban_tahun_akademik ON jawaban_mahasiswa(tahun_akademik);
CREATE INDEX IF NOT EXISTS idx_berita_acara_tahun_akademik ON berita_acara(tahun_akademik);

-- 8. Optional: Update existing jadwal_ujian records to have current academic year if null
-- Uncomment the following if you want to set default values for existing records
-- UPDATE jadwal_ujian SET tahun_akademik = '2025/2026 Ganjil' WHERE tahun_akademik IS NULL;

COMMIT;

-- ============================================
-- Notes:
-- - This migration adds tahun_akademik field to all exam-related tables
-- - Data is NOT deleted when changing academic year
-- - Data can be filtered by tahun_akademik for reports and exports
-- - Run this script once in Supabase SQL Editor
-- ============================================
