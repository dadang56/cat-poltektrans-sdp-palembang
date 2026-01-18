-- ============================================
-- ADD PASSWORD COLUMN TO USERS TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Add password column (stores plain password for now - in production use bcrypt)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '123456';

-- Verify column was added
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'password';
