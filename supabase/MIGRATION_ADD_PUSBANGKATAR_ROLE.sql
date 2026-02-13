-- ============================================
-- MIGRATION: Add 'pusbangkatar' role to users table
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Drop the old role CHECK constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Create new constraint with 'pusbangkatar' role added
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('superadmin', 'admin', 'admin_prodi', 'dosen', 'mahasiswa', 'pengawas', 'pusbangkatar'));

-- 3. Add password column if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);

-- 4. Add username column if not exists  
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'Migration completed! pusbangkatar role is now available.' as status;

-- Show current constraint
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'users_role_check';
