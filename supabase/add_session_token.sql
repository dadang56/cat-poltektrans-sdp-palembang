-- ============================================
-- SINGLE SESSION LOGIN - ADD SESSION TOKEN
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- Add session_token column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token TEXT;

-- Create index for faster session lookup
CREATE INDEX IF NOT EXISTS idx_users_session_token ON users(session_token);

-- Verify column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'session_token';
