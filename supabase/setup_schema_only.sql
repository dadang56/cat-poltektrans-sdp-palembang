-- ============================================
-- CAT POLTEKTRANS - MASTER SCHEMA SCRIPT
-- Version: Enterprise Greenfield
-- ============================================
-- 
-- This script performs a COMPLETE RESET and rebuilds:
-- 1. Hard Reset (DROP all tables/functions)
-- 2. Schema Definition (Enums, Tables)
-- 3. Advanced Triggers (JWT Sync, Reverse Delete)
-- 4. Enterprise RLS Policies
-- 5. Performance Indexes
--
-- NO SEED DATA - Tables are left empty for manual testing
-- ============================================

-- ============================================
-- SECTION 1: HARD RESET / CLEANUP
-- ============================================

-- Drop all existing tables (order matters due to FK constraints)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS berita_acara CASCADE;
DROP TABLE IF EXISTS kehadiran CASCADE;
DROP TABLE IF EXISTS hasil_ujian CASCADE;
DROP TABLE IF EXISTS jawaban_mahasiswa CASCADE;
DROP TABLE IF EXISTS soal CASCADE;
DROP TABLE IF EXISTS jadwal_ujian CASCADE;
DROP TABLE IF EXISTS ruang_ujian CASCADE;
DROP TABLE IF EXISTS mata_kuliah CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS kelas CASCADE;
DROP TABLE IF EXISTS prodi CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS sync_user_claims() CASCADE;
DROP FUNCTION IF EXISTS delete_auth_user_on_public_delete() CASCADE;
DROP FUNCTION IF EXISTS is_active_exam_for_insert(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS is_active_exam_strict(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_current_user_id() CASCADE;
DROP FUNCTION IF EXISTS get_current_user_role() CASCADE;
DROP FUNCTION IF EXISTS get_current_user_prodi() CASCADE;
DROP FUNCTION IF EXISTS get_current_user_kelas() CASCADE;

-- Drop existing types
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS user_status CASCADE;
DROP TYPE IF EXISTS exam_type CASCADE;
DROP TYPE IF EXISTS question_type CASCADE;
DROP TYPE IF EXISTS jadwal_status CASCADE;
DROP TYPE IF EXISTS attendance_status CASCADE;

-- ============================================
-- SECTION 2: SCHEMA DEFINITION
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------
-- 2.1 ENUMS
-- -----------------------------

CREATE TYPE user_role AS ENUM (
    'superadmin',
    'admin',
    'admin_prodi',
    'dosen',
    'mahasiswa',
    'pengawas'
);

CREATE TYPE user_status AS ENUM (
    'active',
    'inactive',
    'suspended'
);

CREATE TYPE exam_type AS ENUM (
    'UTS',
    'UAS'
);

CREATE TYPE question_type AS ENUM (
    'pilihan_ganda',
    'essay',
    'benar_salah'
);

CREATE TYPE jadwal_status AS ENUM (
    'scheduled',
    'ongoing',
    'completed',
    'cancelled'
);

CREATE TYPE attendance_status AS ENUM (
    'hadir',
    'tidak_hadir',
    'sakit',
    'izin'
);

-- -----------------------------
-- 2.2 TABLES
-- -----------------------------

-- Program Studi
CREATE TABLE prodi (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    kode VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kelas
CREATE TABLE kelas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama VARCHAR(50) NOT NULL,
    prodi_id UUID NOT NULL REFERENCES prodi(id) ON DELETE CASCADE,
    tahun_angkatan INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (linked to Supabase Auth)
CREATE TABLE users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    auth_id UUID UNIQUE,  -- Links to auth.users.id
    nim_nip VARCHAR(50) NOT NULL UNIQUE,
    nama VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    role user_role NOT NULL DEFAULT 'mahasiswa',
    status user_status NOT NULL DEFAULT 'active',
    prodi_id UUID REFERENCES prodi(id) ON DELETE SET NULL,
    kelas_id UUID REFERENCES kelas(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mata Kuliah
CREATE TABLE mata_kuliah (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    kode VARCHAR(20) NOT NULL,
    sks INTEGER DEFAULT 3,
    prodi_id UUID REFERENCES prodi(id) ON DELETE CASCADE,
    dosen_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ruang Ujian
CREATE TABLE ruang_ujian (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama VARCHAR(50) NOT NULL,
    kode VARCHAR(20),
    kapasitas INTEGER DEFAULT 30,
    lokasi VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jadwal Ujian
CREATE TABLE jadwal_ujian (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    matkul_id UUID NOT NULL REFERENCES mata_kuliah(id) ON DELETE CASCADE,
    kelas_id UUID NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
    ruangan_id UUID REFERENCES ruang_ujian(id) ON DELETE SET NULL,
    dosen_id UUID REFERENCES users(id) ON DELETE SET NULL,
    pengawas_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tipe exam_type NOT NULL DEFAULT 'UTS',
    tanggal DATE NOT NULL,
    waktu_mulai TIME NOT NULL,
    waktu_selesai TIME NOT NULL,
    status jadwal_status DEFAULT 'scheduled',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Soal (Questions)
CREATE TABLE soal (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    matkul_id UUID NOT NULL REFERENCES mata_kuliah(id) ON DELETE CASCADE,
    dosen_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tipe_ujian exam_type NOT NULL DEFAULT 'UTS',
    tipe_soal question_type NOT NULL DEFAULT 'pilihan_ganda',
    pertanyaan TEXT NOT NULL,
    pilihan JSONB,  -- For pilihan_ganda: [{text: "Option A"}, ...]
    jawaban_benar TEXT,  -- Index for PG, or text for essay rubric
    bobot INTEGER DEFAULT 10,
    gambar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jawaban Mahasiswa (Student Answers)
CREATE TABLE jawaban_mahasiswa (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    jadwal_id UUID NOT NULL REFERENCES jadwal_ujian(id) ON DELETE CASCADE,
    mahasiswa_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    soal_id UUID NOT NULL REFERENCES soal(id) ON DELETE CASCADE,
    jawaban JSONB,  -- {value: "answer", index: 0}
    nilai INTEGER,  -- Score given by dosen
    is_correct BOOLEAN,
    answered_at TIMESTAMPTZ DEFAULT NOW(),
    graded_at TIMESTAMPTZ,
    graded_by UUID REFERENCES users(id),
    UNIQUE(jadwal_id, mahasiswa_id, soal_id)
);

-- Hasil Ujian (Exam Results)
CREATE TABLE hasil_ujian (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    jadwal_id UUID NOT NULL REFERENCES jadwal_ujian(id) ON DELETE CASCADE,
    mahasiswa_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nilai_total DECIMAL(5,2),
    nilai_pg DECIMAL(5,2),  -- Auto-graded
    nilai_essay DECIMAL(5,2),  -- Manual graded
    is_submitted BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMPTZ,
    is_graded BOOLEAN DEFAULT FALSE,
    graded_at TIMESTAMPTZ,
    warnings_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(jadwal_id, mahasiswa_id)
);

-- Kehadiran (Attendance)
CREATE TABLE kehadiran (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    jadwal_id UUID NOT NULL REFERENCES jadwal_ujian(id) ON DELETE CASCADE,
    mahasiswa_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status attendance_status DEFAULT 'tidak_hadir',
    waktu_hadir TIMESTAMPTZ,
    catatan TEXT,
    verified_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(jadwal_id, mahasiswa_id)
);

-- Berita Acara (Exam Minutes)
CREATE TABLE berita_acara (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    jadwal_id UUID NOT NULL REFERENCES jadwal_ujian(id) ON DELETE CASCADE,
    pengawas_id UUID REFERENCES users(id) ON DELETE SET NULL,
    jumlah_hadir INTEGER DEFAULT 0,
    jumlah_tidak_hadir INTEGER DEFAULT 0,
    catatan TEXT,
    kejadian TEXT,
    ttd_pengawas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- App Settings
CREATE TABLE app_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
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

-- ============================================
-- SECTION 3: ADVANCED TRIGGERS
-- ============================================

-- -----------------------------
-- 3.A JWT SYNC TRIGGER
-- Syncs user claims to auth.users.raw_app_meta_data
-- -----------------------------

CREATE OR REPLACE FUNCTION public.sync_user_claims()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Update raw_app_meta_data in auth.users
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
        'user_role', NEW.role::text,
        'user_id', NEW.id::text,
        'prodi_id', COALESCE(NEW.prodi_id::text, ''),
        'kelas_id', COALESCE(NEW.kelas_id::text, '')
    )
    WHERE id = NEW.auth_id;
    
    RETURN NEW;
END;
$$;

-- Set owner to postgres (bypass RLS)
ALTER FUNCTION public.sync_user_claims() OWNER TO postgres;

-- Trigger on INSERT
CREATE TRIGGER on_user_created
    AFTER INSERT ON public.users
    FOR EACH ROW
    WHEN (NEW.auth_id IS NOT NULL)
    EXECUTE FUNCTION public.sync_user_claims();

-- Trigger on UPDATE
CREATE TRIGGER on_user_updated
    AFTER UPDATE OF role, prodi_id, kelas_id, auth_id ON public.users
    FOR EACH ROW
    WHEN (NEW.auth_id IS NOT NULL)
    EXECUTE FUNCTION public.sync_user_claims();

-- -----------------------------
-- 3.B REVERSE DELETE TRIGGER
-- Deleting from public.users also deletes from auth.users
-- -----------------------------

CREATE OR REPLACE FUNCTION public.delete_auth_user_on_public_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Delete the corresponding auth.users record
    IF OLD.auth_id IS NOT NULL THEN
        DELETE FROM auth.users WHERE id = OLD.auth_id;
    END IF;
    
    RETURN OLD;
END;
$$;

-- Set owner to postgres (required to modify auth schema)
ALTER FUNCTION public.delete_auth_user_on_public_delete() OWNER TO postgres;

-- Trigger AFTER DELETE on public.users
CREATE TRIGGER on_user_delete
    AFTER DELETE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.delete_auth_user_on_public_delete();

-- ============================================
-- SECTION 4: ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE prodi ENABLE ROW LEVEL SECURITY;
ALTER TABLE kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mata_kuliah ENABLE ROW LEVEL SECURITY;
ALTER TABLE ruang_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE jadwal_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE jawaban_mahasiswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE hasil_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE kehadiran ENABLE ROW LEVEL SECURITY;
ALTER TABLE berita_acara ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECTION 5: ENTERPRISE RLS POLICIES
-- All policies use auth.jwt() -> 'app_metadata' for performance
-- ============================================

-- -----------------------------
-- 5.1 USERS TABLE
-- -----------------------------

-- CRITICAL: Allow anonymous users to lookup by nim_nip for login flow
CREATE POLICY "users_login_lookup" ON users
    FOR SELECT USING (true);

-- CRITICAL: Allow INSERT for user registration (temporary until Edge Function)
CREATE POLICY "users_anon_insert" ON users
    FOR INSERT WITH CHECK (true);

-- Superadmin can do everything
CREATE POLICY "users_superadmin" ON users
    FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

-- Admin prodi can manage users in their prodi  
CREATE POLICY "users_admin_prodi" ON users
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin_prodi'
        AND prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id')
    );

-- Users can update their own profile
CREATE POLICY "users_update_self" ON users
    FOR UPDATE USING (auth_id = auth.uid());

-- Service role can do everything (for Edge Functions)
CREATE POLICY "users_service_role" ON users
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Dosen can view students in their prodi
CREATE POLICY "users_dosen_view" ON users
    FOR SELECT USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'dosen'
        AND prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id')
        AND role::text = 'mahasiswa'
    );

-- Pengawas can view all students
CREATE POLICY "users_pengawas_view" ON users
    FOR SELECT USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'pengawas'
        AND role::text = 'mahasiswa'
    );

-- -----------------------------
-- 5.2 PRODI TABLE
-- -----------------------------

CREATE POLICY "prodi_view_authenticated" ON prodi
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "prodi_superadmin" ON prodi
    FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

-- -----------------------------
-- 5.3 KELAS TABLE
-- -----------------------------

CREATE POLICY "kelas_superadmin" ON kelas
    FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

CREATE POLICY "kelas_admin_prodi" ON kelas
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin_prodi'
        AND prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id')
    );

CREATE POLICY "kelas_view_authenticated" ON kelas
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- -----------------------------
-- 5.4 MATA KULIAH TABLE
-- -----------------------------

CREATE POLICY "matkul_superadmin" ON mata_kuliah
    FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

CREATE POLICY "matkul_admin_prodi" ON mata_kuliah
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin_prodi'
        AND prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id')
    );

CREATE POLICY "matkul_view_own_prodi" ON mata_kuliah
    FOR SELECT USING (prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id'));

-- -----------------------------
-- 5.5 RUANG UJIAN TABLE
-- -----------------------------

CREATE POLICY "ruang_view_authenticated" ON ruang_ujian
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "ruang_admin_manage" ON ruang_ujian
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') IN ('superadmin', 'admin', 'admin_prodi')
    );

-- -----------------------------
-- 5.6 JADWAL UJIAN TABLE
-- -----------------------------

CREATE POLICY "jadwal_superadmin" ON jadwal_ujian
    FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

CREATE POLICY "jadwal_admin_prodi" ON jadwal_ujian
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin_prodi'
        AND kelas_id IN (
            SELECT id FROM kelas WHERE prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id')
        )
    );

CREATE POLICY "jadwal_mahasiswa_view" ON jadwal_ujian
    FOR SELECT USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'mahasiswa'
        AND kelas_id::text = (auth.jwt() -> 'app_metadata' ->> 'kelas_id')
    );

CREATE POLICY "jadwal_dosen_view" ON jadwal_ujian
    FOR SELECT USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'dosen'
        AND dosen_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
    );

CREATE POLICY "jadwal_pengawas_view" ON jadwal_ujian
    FOR SELECT USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'pengawas'
        AND pengawas_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
    );

-- -----------------------------
-- 5.7 SOAL TABLE (CRITICAL)
-- -----------------------------

CREATE POLICY "soal_superadmin" ON soal
    FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

CREATE POLICY "soal_dosen_own" ON soal
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'dosen'
        AND dosen_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
    );

-- Mahasiswa can only view soal during active exam
CREATE POLICY "soal_mahasiswa_active_exam" ON soal
    FOR SELECT USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'mahasiswa'
        AND EXISTS (
            SELECT 1 FROM jadwal_ujian j
            WHERE j.matkul_id = soal.matkul_id
            AND j.tipe::text = soal.tipe_ujian::text
            AND j.kelas_id::text = (auth.jwt() -> 'app_metadata' ->> 'kelas_id')
            AND j.status = 'ongoing'
            AND CURRENT_TIMESTAMP >= (j.tanggal + j.waktu_mulai)
            AND CURRENT_TIMESTAMP <= (j.tanggal + j.waktu_selesai)
        )
    );

-- -----------------------------
-- 5.8 JAWABAN MAHASISWA TABLE (CRITICAL)
-- Includes 2-minute latency buffer for INSERT
-- -----------------------------

CREATE POLICY "jawaban_superadmin" ON jawaban_mahasiswa
    FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

CREATE POLICY "jawaban_mahasiswa_select" ON jawaban_mahasiswa
    FOR SELECT USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'mahasiswa'
        AND mahasiswa_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
    );

-- INSERT with 2-minute latency buffer
CREATE POLICY "jawaban_mahasiswa_insert" ON jawaban_mahasiswa
    FOR INSERT WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'mahasiswa'
        AND mahasiswa_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
        AND EXISTS (
            SELECT 1 FROM jadwal_ujian j
            WHERE j.id = jadwal_id
            AND j.status = 'ongoing'
            AND CURRENT_TIMESTAMP >= (j.tanggal + j.waktu_mulai)
            AND CURRENT_TIMESTAMP <= (j.tanggal + j.waktu_selesai + INTERVAL '2 minutes')
        )
    );

-- UPDATE with STRICT deadline (no buffer)
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
            AND CURRENT_TIMESTAMP < (j.tanggal + j.waktu_selesai)
        )
    );

CREATE POLICY "jawaban_dosen_view" ON jawaban_mahasiswa
    FOR SELECT USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'dosen'
        AND EXISTS (
            SELECT 1 FROM jadwal_ujian j
            WHERE j.id = jawaban_mahasiswa.jadwal_id
            AND j.dosen_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
        )
    );

CREATE POLICY "jawaban_dosen_grade" ON jawaban_mahasiswa
    FOR UPDATE USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'dosen'
        AND EXISTS (
            SELECT 1 FROM jadwal_ujian j
            WHERE j.id = jawaban_mahasiswa.jadwal_id
            AND j.dosen_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
        )
    );

CREATE POLICY "jawaban_service_role" ON jawaban_mahasiswa
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- -----------------------------
-- 5.9 HASIL UJIAN TABLE
-- -----------------------------

CREATE POLICY "hasil_superadmin" ON hasil_ujian
    FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

CREATE POLICY "hasil_mahasiswa_own" ON hasil_ujian
    FOR SELECT USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'mahasiswa'
        AND mahasiswa_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
    );

CREATE POLICY "hasil_dosen_manage" ON hasil_ujian
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'dosen'
        AND EXISTS (
            SELECT 1 FROM jadwal_ujian j
            WHERE j.id = hasil_ujian.jadwal_id
            AND j.dosen_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
        )
    );

CREATE POLICY "hasil_admin_prodi_view" ON hasil_ujian
    FOR SELECT USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin_prodi'
        AND EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = hasil_ujian.mahasiswa_id
            AND u.prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id')
        )
    );

CREATE POLICY "hasil_service_role" ON hasil_ujian
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- -----------------------------
-- 5.10 KEHADIRAN TABLE
-- -----------------------------

CREATE POLICY "kehadiran_superadmin" ON kehadiran
    FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

CREATE POLICY "kehadiran_pengawas" ON kehadiran
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'pengawas'
        AND EXISTS (
            SELECT 1 FROM jadwal_ujian j
            WHERE j.id = kehadiran.jadwal_id
            AND j.pengawas_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
        )
    );

CREATE POLICY "kehadiran_mahasiswa_own" ON kehadiran
    FOR SELECT USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'mahasiswa'
        AND mahasiswa_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
    );

CREATE POLICY "kehadiran_admin_prodi" ON kehadiran
    FOR SELECT USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin_prodi'
        AND EXISTS (
            SELECT 1 FROM jadwal_ujian j
            JOIN kelas k ON j.kelas_id = k.id
            WHERE j.id = kehadiran.jadwal_id
            AND k.prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id')
        )
    );

-- -----------------------------
-- 5.11 BERITA ACARA TABLE
-- -----------------------------

CREATE POLICY "berita_acara_superadmin" ON berita_acara
    FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

CREATE POLICY "berita_acara_pengawas" ON berita_acara
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'pengawas'
        AND pengawas_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
    );

CREATE POLICY "berita_acara_admin_prodi" ON berita_acara
    FOR SELECT USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin_prodi'
        AND EXISTS (
            SELECT 1 FROM jadwal_ujian j
            JOIN kelas k ON j.kelas_id = k.id
            WHERE j.id = berita_acara.jadwal_id
            AND k.prodi_id::text = (auth.jwt() -> 'app_metadata' ->> 'prodi_id')
        )
    );

-- -----------------------------
-- 5.12 APP SETTINGS TABLE
-- -----------------------------

CREATE POLICY "settings_view_authenticated" ON app_settings
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "settings_superadmin" ON app_settings
    FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

-- -----------------------------
-- 5.13 AUDIT LOGS TABLE
-- -----------------------------

CREATE POLICY "audit_superadmin" ON audit_logs
    FOR SELECT USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'superadmin');

CREATE POLICY "audit_insert_authenticated" ON audit_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "audit_service_role" ON audit_logs
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- SECTION 6: PERFORMANCE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_prodi_role ON users(prodi_id, role);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_nim_nip ON users(nim_nip);

CREATE INDEX IF NOT EXISTS idx_kelas_prodi ON kelas(prodi_id);

CREATE INDEX IF NOT EXISTS idx_jadwal_kelas_status ON jadwal_ujian(kelas_id, status);
CREATE INDEX IF NOT EXISTS idx_jadwal_status_tanggal ON jadwal_ujian(status, tanggal);
CREATE INDEX IF NOT EXISTS idx_jadwal_dosen ON jadwal_ujian(dosen_id);
CREATE INDEX IF NOT EXISTS idx_jadwal_pengawas ON jadwal_ujian(pengawas_id);

CREATE INDEX IF NOT EXISTS idx_soal_matkul_tipe ON soal(matkul_id, tipe_ujian);
CREATE INDEX IF NOT EXISTS idx_soal_dosen ON soal(dosen_id);

CREATE INDEX IF NOT EXISTS idx_jawaban_mahasiswa_lookup ON jawaban_mahasiswa(mahasiswa_id, jadwal_id);
CREATE INDEX IF NOT EXISTS idx_jawaban_jadwal ON jawaban_mahasiswa(jadwal_id);
CREATE INDEX IF NOT EXISTS idx_jawaban_soal ON jawaban_mahasiswa(soal_id);

CREATE INDEX IF NOT EXISTS idx_hasil_jadwal ON hasil_ujian(jadwal_id);
CREATE INDEX IF NOT EXISTS idx_hasil_mahasiswa ON hasil_ujian(mahasiswa_id);

CREATE INDEX IF NOT EXISTS idx_kehadiran_jadwal ON kehadiran(jadwal_id);
CREATE INDEX IF NOT EXISTS idx_kehadiran_mahasiswa ON kehadiran(mahasiswa_id);

CREATE INDEX IF NOT EXISTS idx_berita_acara_jadwal ON berita_acara(jadwal_id);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ============================================
-- SECTION 7: GRANTS
-- ============================================

GRANT EXECUTE ON FUNCTION public.sync_user_claims() TO postgres;
GRANT EXECUTE ON FUNCTION public.delete_auth_user_on_public_delete() TO postgres;

-- ============================================
-- COMPLETE: Database is ready for manual data entry
-- ============================================
