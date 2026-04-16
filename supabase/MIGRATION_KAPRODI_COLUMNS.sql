-- ============================================
-- FIX: Add ketua_prodi_nama and ketua_prodi_nip columns to prodi table
-- Run this in Supabase SQL Editor
-- ============================================

-- Add Ka. Prodi name and NIP columns
ALTER TABLE prodi ADD COLUMN IF NOT EXISTS ketua_prodi_nama VARCHAR(255);
ALTER TABLE prodi ADD COLUMN IF NOT EXISTS ketua_prodi_nip VARCHAR(50);
