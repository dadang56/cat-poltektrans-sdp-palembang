-- ============================================
-- SEED: Create First Superadmin User
-- Run this AFTER setup_schema_only.sql and fix_login_policy.sql
-- ============================================

-- Create the first superadmin user
-- Login with: SUPERADMIN / 123456
INSERT INTO users (nim_nip, nama, email, role, status)
VALUES ('SUPERADMIN', 'Super Administrator', 'superadmin@poltektrans.ac.id', 'superadmin', 'active')
ON CONFLICT (nim_nip) DO NOTHING;

-- Verify user was created
SELECT id, nim_nip, nama, role, status FROM users WHERE nim_nip = 'SUPERADMIN';
