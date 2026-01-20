-- ============================================
-- ADD USERNAME AND NIP COLUMNS TO USERS TABLE
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- Add username column for login
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);

-- Add nip column for dosen (separate from nim_nip)
ALTER TABLE users ADD COLUMN IF NOT EXISTS nip VARCHAR(50);

-- Add dosen-specific array columns if not exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS prodi_ids JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS kelas_ids JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS matkul_ids JSONB DEFAULT '[]';

-- For existing users, copy nim_nip to username if username is null
UPDATE users SET username = nim_nip WHERE username IS NULL;

-- Create index for username lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
