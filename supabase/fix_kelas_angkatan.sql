-- ============================================
-- FIX KELAS TABLE - ENSURE CORRECT COLUMNS
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- Add tahun_angkatan column if not exists (schema uses this, not 'angkatan')
ALTER TABLE kelas ADD COLUMN IF NOT EXISTS tahun_angkatan INTEGER DEFAULT 36;

-- If there's an 'angkatan' column by mistake, migrate data and drop it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'kelas' AND column_name = 'angkatan') THEN
        -- Copy data from angkatan to tahun_angkatan
        UPDATE kelas SET tahun_angkatan = angkatan WHERE tahun_angkatan IS NULL;
        -- Drop the wrong column
        ALTER TABLE kelas DROP COLUMN IF EXISTS angkatan;
    END IF;
END $$;

-- Verify columns
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'kelas';
