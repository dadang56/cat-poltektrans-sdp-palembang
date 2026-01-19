-- ============================================
-- FIX KELAS TABLE - ADD ANGKATAN COLUMN
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- Add angkatan column to kelas table
ALTER TABLE kelas ADD COLUMN IF NOT EXISTS angkatan INTEGER DEFAULT 34;

-- Verify column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'kelas';
