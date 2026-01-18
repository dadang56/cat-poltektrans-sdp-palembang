-- ============================================
-- COMPLETE FIX: RLS Policies for User Management
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Allow public SELECT for login lookup
DROP POLICY IF EXISTS "users_login_lookup" ON users;
CREATE POLICY "users_login_lookup" ON users
    FOR SELECT USING (true);

-- 2. Allow superadmin to do everything (INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "users_superadmin" ON users;
CREATE POLICY "users_superadmin" ON users
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin'
    );

-- 3. Allow admin_prodi to manage users in their prodi
DROP POLICY IF EXISTS "users_admin_prodi" ON users;
CREATE POLICY "users_admin_prodi" ON users
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin_prodi'
        AND prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id')
    );

-- 4. Allow self-update
DROP POLICY IF EXISTS "users_update_self" ON users;
CREATE POLICY "users_update_self" ON users
    FOR UPDATE USING (auth_id = auth.uid());

-- 5. CRITICAL: Allow service role to bypass RLS (for Edge Functions)
DROP POLICY IF EXISTS "users_service_role" ON users;
CREATE POLICY "users_service_role" ON users
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- 6. CRITICAL: Allow anon users to INSERT (for user creation before auth)
-- This is temporary - in production use Edge Function with service_role
DROP POLICY IF EXISTS "users_anon_insert" ON users;
CREATE POLICY "users_anon_insert" ON users
    FOR INSERT WITH CHECK (true);

-- Verify all policies
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'users';
