-- ============================================
-- MIGRATION: Pusbangkatar Role + Required Columns
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

-- 5. Add nilai_kondite and nilai_semapta columns for Pusbangkatar
ALTER TABLE users ADD COLUMN IF NOT EXISTS nilai_kondite DECIMAL(5,2) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nilai_semapta DECIMAL(5,2) DEFAULT NULL;

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'Migration completed!' as status;

-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('password', 'username', 'nilai_kondite', 'nilai_semapta');

-- Verify role constraint
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'users_role_check';
