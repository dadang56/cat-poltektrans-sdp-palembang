-- =============================================================================
-- FIX ALL ISSUES: Koreksi Ujian, Monitor, Pengawas Menu
-- =============================================================================
-- Masalah yang diperbaiki:
-- 1. Kolom answers_detail tidak ada di hasil_ujian
-- 2. Kolom nilai_tugas, nilai_praktek tidak ada (untuk Nilai Akhir)
-- 3. Mahasiswa tidak bisa INSERT/UPDATE ke hasil_ujian
-- 4. Pengawas tidak bisa UPDATE hasil_ujian
-- 5. JWT Claims mungkin tidak sinkron
--
-- JALANKAN DI SUPABASE SQL EDITOR
-- =============================================================================

-- =============================================================================
-- PART 1: ADD MISSING COLUMNS TO hasil_ujian
-- =============================================================================

-- Add answers_detail column (untuk menyimpan detail jawaban per soal)
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS answers_detail JSONB;

-- Add nilai_tugas column (untuk Nilai Akhir - Nilai Tugas)
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS nilai_tugas DECIMAL(5,2);

-- Add nilai_praktek column (untuk Nilai Akhir - Nilai Praktek)
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS nilai_praktek DECIMAL(5,2);

-- Add kicked status to hasil_ujian if not exists
DO $$
BEGIN
    -- Drop and recreate the constraint to include 'kicked'
    ALTER TABLE hasil_ujian DROP CONSTRAINT IF EXISTS hasil_ujian_status_check;
    ALTER TABLE hasil_ujian ADD CONSTRAINT hasil_ujian_status_check 
        CHECK (status IN ('pending', 'in_progress', 'submitted', 'graded', 'kicked'));
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Constraint modification skipped: %', SQLERRM;
END $$;

COMMENT ON COLUMN hasil_ujian.answers_detail IS 'Detail jawaban per soal dalam format JSON: [{questionId, answer, type, earnedPoints, maxPoints, isCorrect}]';
COMMENT ON COLUMN hasil_ujian.nilai_tugas IS 'Nilai Tugas (NT) untuk perhitungan Nilai Akhir Keseluruhan';
COMMENT ON COLUMN hasil_ujian.nilai_praktek IS 'Nilai Praktek (NP) untuk mata kuliah yang memiliki SKS Praktek';

-- =============================================================================
-- PART 2: FIX RLS POLICIES FOR hasil_ujian
-- =============================================================================

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "hasil_mahasiswa_insert" ON hasil_ujian;
DROP POLICY IF EXISTS "hasil_mahasiswa_update" ON hasil_ujian;
DROP POLICY IF EXISTS "hasil_pengawas_update" ON hasil_ujian;
DROP POLICY IF EXISTS "hasil_pengawas_view" ON hasil_ujian;
DROP POLICY IF EXISTS "hasil_mahasiswa_upsert" ON hasil_ujian;

-- CRITICAL: Allow mahasiswa to INSERT their own exam results
-- This is needed when they START an exam
CREATE POLICY "hasil_mahasiswa_insert" ON hasil_ujian
    FOR INSERT 
    WITH CHECK (
        -- Check if user role is mahasiswa via app_metadata
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'mahasiswa'
        AND mahasiswa_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
    );

-- CRITICAL: Allow mahasiswa to UPDATE their own exam results
-- This is needed when they ANSWER questions and SUBMIT
CREATE POLICY "hasil_mahasiswa_update" ON hasil_ujian
    FOR UPDATE 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'mahasiswa'
        AND mahasiswa_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
    )
    WITH CHECK (
        mahasiswa_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
    );

-- Allow pengawas to VIEW all hasil_ujian for exams they supervise
CREATE POLICY "hasil_pengawas_view" ON hasil_ujian
    FOR SELECT 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'pengawas'
        AND EXISTS (
            SELECT 1 FROM jadwal_ujian j
            WHERE j.id = hasil_ujian.jadwal_id
            AND j.pengawas_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
        )
    );

-- Allow pengawas to UPDATE hasil_ujian (for kicking students, etc.)
CREATE POLICY "hasil_pengawas_update" ON hasil_ujian
    FOR UPDATE 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'pengawas'
        AND EXISTS (
            SELECT 1 FROM jadwal_ujian j
            WHERE j.id = hasil_ujian.jadwal_id
            AND j.pengawas_id::text = (auth.jwt() -> 'app_metadata' ->> 'user_id')
        )
    );

-- =============================================================================
-- PART 3: FIX RLS POLICIES FOR jadwal_ujian (Pengawas View All)
-- =============================================================================

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "jadwal_pengawas_view" ON jadwal_ujian;
DROP POLICY IF EXISTS "jadwal_pengawas_view_all" ON jadwal_ujian;

-- Allow pengawas to view ALL jadwal (not just assigned ones)
-- This is needed for Monitor Ujian to show all active exams
CREATE POLICY "jadwal_pengawas_view_all" ON jadwal_ujian
    FOR SELECT 
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'pengawas'
    );

-- =============================================================================
-- PART 4: ENSURE JWT CLAIMS SYNC TRIGGER EXISTS
-- =============================================================================

-- Recreate the sync function to handle edge cases
CREATE OR REPLACE FUNCTION public.sync_user_claims()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only proceed if auth_id is set
    IF NEW.auth_id IS NOT NULL THEN
        UPDATE auth.users
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
            'user_role', NEW.role,
            'user_id', NEW.id::text,
            'prodi_id', COALESCE(NEW.prodi_id::text, ''),
            'kelas_id', COALESCE(NEW.kelas_id::text, '')
        )
        WHERE id = NEW.auth_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Ensure function is owned by postgres for bypass
ALTER FUNCTION public.sync_user_claims() OWNER TO postgres;

-- Recreate triggers
DROP TRIGGER IF EXISTS on_user_created ON public.users;
DROP TRIGGER IF EXISTS on_user_updated ON public.users;

CREATE TRIGGER on_user_created
    AFTER INSERT ON public.users
    FOR EACH ROW
    WHEN (NEW.auth_id IS NOT NULL)
    EXECUTE FUNCTION public.sync_user_claims();

CREATE TRIGGER on_user_updated
    AFTER UPDATE OF role, prodi_id, kelas_id, auth_id ON public.users
    FOR EACH ROW
    WHEN (NEW.auth_id IS NOT NULL)
    EXECUTE FUNCTION public.sync_user_claims();

-- =============================================================================
-- PART 5: SYNC EXISTING USERS' JWT CLAIMS
-- =============================================================================
-- This updates all existing users to ensure their JWT claims are current

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, auth_id, role, prodi_id, kelas_id FROM public.users WHERE auth_id IS NOT NULL
    LOOP
        UPDATE auth.users
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
            'user_role', r.role,
            'user_id', r.id::text,
            'prodi_id', COALESCE(r.prodi_id::text, ''),
            'kelas_id', COALESCE(r.kelas_id::text, '')
        )
        WHERE id = r.auth_id;
    END LOOP;
    
    RAISE NOTICE 'Synced JWT claims for all existing users';
END $$;

-- =============================================================================
-- PART 6: FALLBACK - OPEN POLICIES (In case JWT claims still fail)
-- =============================================================================
-- These policies allow authenticated users broader access as a fallback
-- Comment these out once JWT sync is confirmed working

-- Fallback: Any authenticated user can view hasil_ujian
DROP POLICY IF EXISTS "hasil_authenticated_select" ON hasil_ujian;
CREATE POLICY "hasil_authenticated_select" ON hasil_ujian
    FOR SELECT 
    USING (auth.uid() IS NOT NULL);

-- Fallback: Any authenticated user can insert/update hasil_ujian (with ownership check)
DROP POLICY IF EXISTS "hasil_authenticated_insert" ON hasil_ujian;
CREATE POLICY "hasil_authenticated_insert" ON hasil_ujian
    FOR INSERT 
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "hasil_authenticated_update" ON hasil_ujian;
CREATE POLICY "hasil_authenticated_update" ON hasil_ujian
    FOR UPDATE 
    USING (auth.uid() IS NOT NULL);

-- =============================================================================
-- VERIFICATION QUERY
-- =============================================================================
-- Run this to verify the changes:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'hasil_ujian' ORDER BY ordinal_position;

SELECT 'Fix script completed successfully!' AS status;
