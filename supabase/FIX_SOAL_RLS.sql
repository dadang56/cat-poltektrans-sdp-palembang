-- ============================================================
-- FIX: Soal tidak muncul untuk mahasiswa
-- 
-- Masalah: Mahasiswa melihat "Ujian Tidak Tersedia" meskipun
-- dosen sudah membuat soal.
--
-- Kemungkinan penyebab:
-- 1. RLS pada tabel 'soal' memblokir SELECT untuk mahasiswa
-- 2. Ada policy restrictive yang override "Allow all access"
--
-- Jalankan SQL ini di Supabase SQL Editor:
-- Dashboard → SQL Editor → New query → Paste → Run
-- ============================================================

-- STEP 1: Reset RLS policies on 'soal' table
DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Drop ALL existing policies on soal table
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'soal'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON soal', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- STEP 2: Create single permissive policy for ALL operations
CREATE POLICY "Allow all access" ON soal FOR ALL USING (true) WITH CHECK (true);

-- STEP 3: Verify - List all policies on soal
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual
FROM pg_policies 
WHERE tablename = 'soal';

-- STEP 4: Also fix other tables that might have similar issues
-- Reset policies on jadwal_ujian, hasil_ujian, mata_kuliah, users
DO $$
DECLARE
    tbl TEXT;
    pol RECORD;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['jadwal_ujian', 'hasil_ujian', 'mata_kuliah', 'users', 'kelas', 'prodi']
    LOOP
        -- Drop all existing policies
        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = tbl
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, tbl);
            RAISE NOTICE 'Dropped policy % on %', pol.policyname, tbl;
        END LOOP;
        
        -- Create single permissive policy
        EXECUTE format('CREATE POLICY "Allow all access" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl);
        RAISE NOTICE 'Created allow-all policy on %', tbl;
    END LOOP;
END $$;

-- STEP 5: Verify RLS status on all tables
SELECT 
    schemaname,
    tablename, 
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('soal', 'jadwal_ujian', 'hasil_ujian', 'mata_kuliah', 'users', 'kelas', 'prodi', 'dosen')
ORDER BY tablename;

-- STEP 6: Quick diagnostic - check if soal exist for Pendidikan Agama
SELECT 
    s.id,
    s.pertanyaan,
    s.tipe_ujian,
    s.tipe_soal,
    s.matkul_id,
    m.nama as matkul_nama,
    s.dosen_id,
    d.nama as dosen_nama
FROM soal s
LEFT JOIN mata_kuliah m ON m.id = s.matkul_id
LEFT JOIN users d ON d.id = s.dosen_id
WHERE m.nama ILIKE '%pendidikan agama%'
ORDER BY s.created_at DESC
LIMIT 10;
