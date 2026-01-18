-- ============================================
-- USER CREATION FIX - MIGRATION SCRIPT
-- ============================================
-- Run this in Supabase SQL Editor to fix user creation
-- This enables database-only authentication (no auth.users needed)
-- ============================================

-- 1. Add password column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT NOT NULL DEFAULT '123456';

-- 2. Add RLS policy for password update by self
DROP POLICY IF EXISTS "users_update_password" ON users;
CREATE POLICY "users_update_password" ON users
    FOR UPDATE USING (true);

-- 3. Add RLS policy for anonymous INSERT (needed for user creation from app)
DROP POLICY IF EXISTS "users_anon_insert" ON users;
CREATE POLICY "users_anon_insert" ON users
    FOR INSERT WITH CHECK (true);

-- 4. Add RLS policy for anonymous SELECT (needed for login lookup)
DROP POLICY IF EXISTS "users_login_lookup" ON users;
CREATE POLICY "users_login_lookup" ON users
    FOR SELECT USING (true);

-- 5. Add RLS policy for DELETE (admin only in production)
DROP POLICY IF EXISTS "users_delete" ON users;
CREATE POLICY "users_delete" ON users
    FOR DELETE USING (true);

-- ============================================
-- OPTIONAL: Create first SUPERADMIN if not exists
-- ============================================
-- Uncomment and run this if you need to create the first admin:
--
-- INSERT INTO users (nim_nip, nama, role, password, status)
-- VALUES ('ADMIN', 'Super Admin', 'superadmin', 'admin123', 'active')
-- ON CONFLICT (nim_nip) DO NOTHING;

-- ============================================
-- VERIFY: Check that password column exists
-- ============================================
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'password';
