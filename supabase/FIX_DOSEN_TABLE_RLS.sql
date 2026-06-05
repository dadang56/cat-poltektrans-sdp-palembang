-- ============================================================
-- FIX: "new row violates row-level security policy for table 'dosen'"
-- 
-- Masalah: Ada tabel 'dosen' terpisah di Supabase yang punya RLS aktif
-- tapi tidak ada policy yang mengizinkan INSERT.
-- Ini mungkin tabel yang dibuat otomatis atau manual di Supabase.
--
-- Jalankan SQL ini di Supabase SQL Editor:
-- Dashboard → SQL Editor → New query → Paste → Run
-- ============================================================

-- OPSI 1 (RECOMMENDED): Nonaktifkan RLS pada tabel 'dosen'
-- Karena aplikasi kita menggunakan tabel 'users' untuk semua role,
-- tabel 'dosen' terpisah ini tidak diperlukan.
ALTER TABLE IF EXISTS dosen DISABLE ROW LEVEL SECURITY;

-- Tambahkan policy "allow all" untuk jaga-jaga
DO $$
BEGIN
    -- Drop existing restrictive policies
    DROP POLICY IF EXISTS "dosen_select_policy" ON dosen;
    DROP POLICY IF EXISTS "dosen_insert_policy" ON dosen;
    DROP POLICY IF EXISTS "dosen_update_policy" ON dosen;
    DROP POLICY IF EXISTS "dosen_delete_policy" ON dosen;
    DROP POLICY IF EXISTS "Enable read access for all users" ON dosen;
    DROP POLICY IF EXISTS "Enable insert for all users" ON dosen;
    DROP POLICY IF EXISTS "Enable update for all users" ON dosen;
    DROP POLICY IF EXISTS "Enable delete for all users" ON dosen;
    
    -- Create permissive policies for all operations
    CREATE POLICY "Allow all access on dosen" ON dosen FOR ALL USING (true) WITH CHECK (true);
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'Table dosen does not exist, skipping...';
    WHEN OTHERS THEN
        RAISE NOTICE 'Error: %, skipping policy creation', SQLERRM;
END $$;

-- ============================================================
-- OPSI 2 (ALTERNATIF): Jika tabel 'dosen' memang tidak dipakai,
-- hapus saja tabelnya. UNCOMMENT baris berikut jika yakin:
-- ============================================================
-- DROP TABLE IF EXISTS dosen CASCADE;

-- ============================================================
-- Verifikasi: Cek apakah tabel dosen ada dan RLS-nya
-- ============================================================
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'dosen';
