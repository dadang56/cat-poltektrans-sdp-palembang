-- ============================================
-- CAT POLTEKTRANS EXAM - High-Performance RLS
-- Optimized for High-Concurrency CBT System
-- ============================================
-- 
-- Key Optimizations:
-- 1. JWT Custom Claims (no N+1 queries)
-- 2. Direct auth.jwt() reads (no helper functions in hot path)
-- 3. Concurrent indexes for RLS foreign keys
-- 4. 2-minute latency buffer for exam submissions
-- 5. Explicit UPDATE policies for jawaban_mahasiswa
--
-- Run this AFTER schema.sql
-- ============================================

-- ============================================
-- STEP 0: CREATE AUDIT_LOGS TABLE (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    extra_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 1: JWT CUSTOM CLAIMS SYNC
-- This trigger syncs user role/prodi/kelas to auth.users.raw_app_meta_data
-- ============================================

-- Function to sync user claims to Supabase Auth
CREATE OR REPLACE FUNCTION public.sync_user_claims()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Update the raw_app_meta_data in auth.users
    -- This avoids N+1 queries in RLS policies
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
        'user_role', NEW.role,
        'user_id', NEW.id::text,
        'prodi_id', COALESCE(NEW.prodi_id::text, ''),
        'kelas_id', COALESCE(NEW.kelas_id::text, '')
    )
    WHERE id = NEW.auth_id;
    
    RETURN NEW;
END;
$$;

-- Set function owner to postgres (bypass RLS recursion)
ALTER FUNCTION public.sync_user_claims() OWNER TO postgres;

-- Trigger on INSERT
CREATE OR REPLACE TRIGGER on_user_created
    AFTER INSERT ON public.users
    FOR EACH ROW
    WHEN (NEW.auth_id IS NOT NULL)
    EXECUTE FUNCTION public.sync_user_claims();

-- Trigger on UPDATE (role, prodi_id, or kelas_id changes)
CREATE OR REPLACE TRIGGER on_user_updated
    AFTER UPDATE OF role, prodi_id, kelas_id, auth_id ON public.users
    FOR EACH ROW
    WHEN (NEW.auth_id IS NOT NULL)
    EXECUTE FUNCTION public.sync_user_claims();

-- ============================================
-- STEP 2: HELPER FUNCTIONS (SECURITY DEFINER, postgres owned)
-- Only for complex logic that can't be expressed in JWT
-- ============================================

-- Check if user is in an active exam (with 2-min buffer for INSERT)
CREATE OR REPLACE FUNCTION public.is_active_exam_for_insert(
    p_kelas_id UUID,
    p_matkul_id UUID,
    p_tipe TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM jadwal_ujian j
        WHERE j.kelas_id = p_kelas_id
        AND j.matkul_id = p_matkul_id
        AND j.tipe = p_tipe
        AND j.status = 'ongoing'
        AND CURRENT_TIMESTAMP >= (j.tanggal + j.waktu_mulai)
        -- 2-minute latency buffer for INSERT operations
        AND CURRENT_TIMESTAMP <= (j.tanggal + j.waktu_selesai + INTERVAL '2 minutes')
    );
$$;

-- Check if user is in an active exam (strict, for UPDATE)
CREATE OR REPLACE FUNCTION public.is_active_exam_strict(
    p_jadwal_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM jadwal_ujian j
        WHERE j.id = p_jadwal_id
        AND j.status = 'ongoing'
        AND CURRENT_TIMESTAMP >= (j.tanggal + j.waktu_mulai)
        -- Strict check: no buffer for updates
        AND CURRENT_TIMESTAMP < (j.tanggal + j.waktu_selesai)
    );
$$;

-- Set owners to postgres
ALTER FUNCTION public.is_active_exam_for_insert(UUID, UUID, TEXT) OWNER TO postgres;
ALTER FUNCTION public.is_active_exam_strict(UUID) OWNER TO postgres;

-- ============================================
-- STEP 3: PERFORMANCE INDEXES
-- Note: For production with live traffic, run these 
-- separately with CONCURRENTLY to avoid locking.
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_prodi_role 
    ON users(prodi_id, role);

CREATE INDEX IF NOT EXISTS idx_jadwal_kelas_status 
    ON jadwal_ujian(kelas_id, status);

CREATE INDEX IF NOT EXISTS idx_jadwal_status_tanggal 
    ON jadwal_ujian(status, tanggal);

CREATE INDEX IF NOT EXISTS idx_jawaban_mahasiswa_lookup 
    ON jawaban_mahasiswa(mahasiswa_id, jadwal_id);

CREATE INDEX IF NOT EXISTS idx_soal_matkul_tipe 
    ON soal(matkul_id, tipe_ujian);

CREATE INDEX IF NOT EXISTS idx_users_auth_id 
    ON users(auth_id);

CREATE INDEX IF NOT EXISTS idx_kelas_prodi 
    ON kelas(prodi_id);

-- ============================================
-- STEP 4: DROP OLD POLICIES
-- ============================================

DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all existing policies on these tables
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN (
            'users', 'prodi', 'kelas', 'mata_kuliah', 'jadwal_ujian',
            'soal', 'jawaban_mahasiswa', 'hasil_ujian', 'kehadiran',
            'ruang_ujian', 'app_settings', 'berita_acara', 'audit_logs'
        )
    )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Drop old helper functions that cause recursion
DROP FUNCTION IF EXISTS get_current_user_id();
DROP FUNCTION IF EXISTS get_current_user_role();
DROP FUNCTION IF EXISTS get_current_user_prodi();
DROP FUNCTION IF EXISTS get_current_user_kelas();

-- ============================================
-- STEP 5: NEW HIGH-PERFORMANCE RLS POLICIES
-- All policies read directly from auth.jwt()
-- ============================================

-- -----------------------------
-- 1. USERS TABLE
-- -----------------------------

-- Superadmin full access
CREATE POLICY "users_superadmin" ON users
    FOR ALL 
    USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

-- Admin prodi can manage users in their prodi
CREATE POLICY "users_admin_prodi" ON users
    FOR ALL 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin_prodi'
        AND prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id')
    );

-- Users can view their own profile
CREATE POLICY "users_view_self" ON users
    FOR SELECT 
    USING (auth_id = auth.uid());

-- Users can update their own profile
CREATE POLICY "users_update_self" ON users
    FOR UPDATE 
    USING (auth_id = auth.uid());

-- Dosen can view students in their prodi
CREATE POLICY "users_dosen_view" ON users
    FOR SELECT 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'dosen'
        AND prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id')
        AND role = 'mahasiswa'
    );

-- Pengawas can view all students
CREATE POLICY "users_pengawas_view" ON users
    FOR SELECT 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'pengawas'
        AND role = 'mahasiswa'
    );

-- -----------------------------
-- 2. PRODI TABLE
-- -----------------------------

CREATE POLICY "prodi_view_authenticated" ON prodi
    FOR SELECT 
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "prodi_superadmin" ON prodi
    FOR ALL 
    USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

-- -----------------------------
-- 3. KELAS TABLE
-- -----------------------------

CREATE POLICY "kelas_superadmin" ON kelas
    FOR ALL 
    USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

CREATE POLICY "kelas_admin_prodi" ON kelas
    FOR ALL 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin_prodi'
        AND prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id')
    );

CREATE POLICY "kelas_view_authenticated" ON kelas
    FOR SELECT 
    USING (auth.uid() IS NOT NULL);

-- -----------------------------
-- 4. MATA KULIAH TABLE
-- -----------------------------

CREATE POLICY "matkul_superadmin" ON mata_kuliah
    FOR ALL 
    USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

CREATE POLICY "matkul_admin_prodi" ON mata_kuliah
    FOR ALL 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin_prodi'
        AND prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id')
    );

CREATE POLICY "matkul_view_own_prodi" ON mata_kuliah
    FOR SELECT 
    USING (
        prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id')
    );

-- -----------------------------
-- 5. RUANG UJIAN TABLE
-- -----------------------------

CREATE POLICY "ruang_view_authenticated" ON ruang_ujian
    FOR SELECT 
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "ruang_admin_manage" ON ruang_ujian
    FOR ALL 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') IN ('superadmin', 'admin', 'admin_prodi')
    );

-- -----------------------------
-- 6. JADWAL UJIAN TABLE
-- -----------------------------

CREATE POLICY "jadwal_superadmin" ON jadwal_ujian
    FOR ALL 
    USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

CREATE POLICY "jadwal_admin_prodi" ON jadwal_ujian
    FOR ALL 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin_prodi'
        AND kelas_id IN (
            SELECT id FROM kelas 
            WHERE prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id')
        )
    );

CREATE POLICY "jadwal_mahasiswa_view" ON jadwal_ujian
    FOR SELECT 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'mahasiswa'
        AND kelas_id::text = (auth.jwt() -> 'app_metadata' ->> 'kelas_id')
    );

CREATE POLICY "jadwal_dosen_view" ON jadwal_ujian
    FOR SELECT 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'dosen'
        AND dosen_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
    );

CREATE POLICY "jadwal_pengawas_view" ON jadwal_ujian
    FOR SELECT 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'pengawas'
        AND pengawas_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
    );

-- -----------------------------
-- 7. SOAL TABLE (CRITICAL - Exam Questions)
-- -----------------------------

CREATE POLICY "soal_superadmin" ON soal
    FOR ALL 
    USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

CREATE POLICY "soal_dosen_own" ON soal
    FOR ALL 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'dosen'
        AND dosen_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
    );

-- Mahasiswa can ONLY view soal during active exam
CREATE POLICY "soal_mahasiswa_active_exam" ON soal
    FOR SELECT 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'mahasiswa'
        AND EXISTS (
            SELECT 1 FROM jadwal_ujian j
            WHERE j.matkul_id = soal.matkul_id
            AND j.tipe = soal.tipe_ujian
            AND j.kelas_id::text = (auth.jwt() -> 'app_metadata' ->> 'kelas_id')
            AND j.status = 'ongoing'
            AND CURRENT_TIMESTAMP >= (j.tanggal + j.waktu_mulai)
            AND CURRENT_TIMESTAMP <= (j.tanggal + j.waktu_selesai)
        )
    );

-- -----------------------------
-- 8. JAWABAN MAHASISWA TABLE (CRITICAL)
-- -----------------------------

CREATE POLICY "jawaban_superadmin" ON jawaban_mahasiswa
    FOR ALL 
    USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

-- Mahasiswa can SELECT their own answers
CREATE POLICY "jawaban_mahasiswa_select" ON jawaban_mahasiswa
    FOR SELECT 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'mahasiswa'
        AND mahasiswa_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
    );

-- Mahasiswa can INSERT during active exam (with 2-min latency buffer)
CREATE POLICY "jawaban_mahasiswa_insert" ON jawaban_mahasiswa
    FOR INSERT 
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'mahasiswa'
        AND mahasiswa_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
        AND EXISTS (
            SELECT 1 FROM jadwal_ujian j
            WHERE j.id = jadwal_id
            AND j.status = 'ongoing'
            AND CURRENT_TIMESTAMP >= (j.tanggal + j.waktu_mulai)
            -- 2-minute latency buffer for INSERT
            AND CURRENT_TIMESTAMP <= (j.tanggal + j.waktu_selesai + INTERVAL '2 minutes')
        )
    );

-- Mahasiswa can UPDATE ONLY during active exam (STRICT - no buffer)
CREATE POLICY "jawaban_mahasiswa_update" ON jawaban_mahasiswa
    FOR UPDATE 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'mahasiswa'
        AND mahasiswa_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM jadwal_ujian j
            WHERE j.id = jadwal_id
            AND j.status = 'ongoing'
            AND CURRENT_TIMESTAMP >= (j.tanggal + j.waktu_mulai)
            -- NO buffer for UPDATE - strict deadline enforcement
            AND CURRENT_TIMESTAMP < (j.tanggal + j.waktu_selesai)
        )
    );

-- Dosen can view answers for their matkul
CREATE POLICY "jawaban_dosen_view" ON jawaban_mahasiswa
    FOR SELECT 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'dosen'
        AND EXISTS (
            SELECT 1 FROM jadwal_ujian j
            WHERE j.id = jawaban_mahasiswa.jadwal_id
            AND j.dosen_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
        )
    );

-- Dosen can update nilai for grading
CREATE POLICY "jawaban_dosen_grade" ON jawaban_mahasiswa
    FOR UPDATE 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'dosen'
        AND EXISTS (
            SELECT 1 FROM jadwal_ujian j
            WHERE j.id = jawaban_mahasiswa.jadwal_id
            AND j.dosen_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
        )
    );

-- Service role for Edge Functions (server-side scoring)
CREATE POLICY "jawaban_service_role" ON jawaban_mahasiswa
    FOR ALL 
    USING (auth.jwt() ->> 'role' = 'service_role');

-- -----------------------------
-- 9. HASIL UJIAN TABLE
-- -----------------------------

CREATE POLICY "hasil_superadmin" ON hasil_ujian
    FOR ALL 
    USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

CREATE POLICY "hasil_mahasiswa_own" ON hasil_ujian
    FOR SELECT 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'mahasiswa'
        AND mahasiswa_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
    );

CREATE POLICY "hasil_dosen_manage" ON hasil_ujian
    FOR ALL 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'dosen'
        AND EXISTS (
            SELECT 1 FROM jadwal_ujian j
            WHERE j.id = hasil_ujian.jadwal_id
            AND j.dosen_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
        )
    );

CREATE POLICY "hasil_admin_prodi_view" ON hasil_ujian
    FOR SELECT 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin_prodi'
        AND EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = hasil_ujian.mahasiswa_id
            AND u.prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id')
        )
    );

CREATE POLICY "hasil_service_role" ON hasil_ujian
    FOR ALL 
    USING (auth.jwt() ->> 'role' = 'service_role');

-- -----------------------------
-- 10. KEHADIRAN TABLE
-- -----------------------------

CREATE POLICY "kehadiran_superadmin" ON kehadiran
    FOR ALL 
    USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

CREATE POLICY "kehadiran_pengawas" ON kehadiran
    FOR ALL 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'pengawas'
        AND EXISTS (
            SELECT 1 FROM jadwal_ujian j
            WHERE j.id = kehadiran.jadwal_id
            AND j.pengawas_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
        )
    );

CREATE POLICY "kehadiran_mahasiswa_own" ON kehadiran
    FOR SELECT 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'mahasiswa'
        AND mahasiswa_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
    );

CREATE POLICY "kehadiran_admin_prodi" ON kehadiran
    FOR SELECT 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin_prodi'
        AND EXISTS (
            SELECT 1 FROM jadwal_ujian j
            JOIN kelas k ON j.kelas_id = k.id
            WHERE j.id = kehadiran.jadwal_id
            AND k.prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id')
        )
    );

-- -----------------------------
-- 11. BERITA ACARA TABLE
-- -----------------------------

CREATE POLICY "berita_acara_superadmin" ON berita_acara
    FOR ALL 
    USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

CREATE POLICY "berita_acara_pengawas" ON berita_acara
    FOR ALL 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'pengawas'
        AND pengawas_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
    );

CREATE POLICY "berita_acara_admin_prodi" ON berita_acara
    FOR SELECT 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin_prodi'
        AND EXISTS (
            SELECT 1 FROM jadwal_ujian j
            JOIN kelas k ON j.kelas_id = k.id
            WHERE j.id = berita_acara.jadwal_id
            AND k.prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id')
        )
    );

-- -----------------------------
-- 12. APP SETTINGS TABLE
-- -----------------------------

CREATE POLICY "settings_view_authenticated" ON app_settings
    FOR SELECT 
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "settings_superadmin" ON app_settings
    FOR ALL 
    USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

-- -----------------------------
-- 13. AUDIT LOGS TABLE
-- -----------------------------

CREATE POLICY "audit_superadmin" ON audit_logs
    FOR SELECT 
    USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

CREATE POLICY "audit_insert_authenticated" ON audit_logs
    FOR INSERT 
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "audit_service_role" ON audit_logs
    FOR ALL 
    USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- STEP 6: GRANT PERMISSIONS
-- ============================================

-- Grant execute on helper functions to authenticated users
GRANT EXECUTE ON FUNCTION public.sync_user_claims() TO postgres;
GRANT EXECUTE ON FUNCTION public.is_active_exam_for_insert(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_exam_strict(UUID) TO authenticated;

COMMIT;
