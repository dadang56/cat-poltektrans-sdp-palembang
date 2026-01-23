-- ================================================================
-- CRITICAL FIX: Add missing columns to hasil_ujian table
-- Run this ENTIRE script in Supabase SQL Editor
-- ================================================================

-- 1. Add ALL missing columns
ALTER TABLE hasil_ujian ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'in_progress';
ALTER TABLE hasil_ujian ADD COLUMN IF NOT EXISTS answers_detail JSONB;
ALTER TABLE hasil_ujian ADD COLUMN IF NOT EXISTS nilai_total INTEGER DEFAULT 0;
ALTER TABLE hasil_ujian ADD COLUMN IF NOT EXISTS jumlah_benar INTEGER DEFAULT 0;
ALTER TABLE hasil_ujian ADD COLUMN IF NOT EXISTS jumlah_salah INTEGER DEFAULT 0;
ALTER TABLE hasil_ujian ADD COLUMN IF NOT EXISTS jumlah_kosong INTEGER DEFAULT 0;
ALTER TABLE hasil_ujian ADD COLUMN IF NOT EXISTS waktu_mulai TIMESTAMPTZ;
ALTER TABLE hasil_ujian ADD COLUMN IF NOT EXISTS waktu_selesai TIMESTAMPTZ;

-- 2. Add unique constraint for upsert (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'hasil_ujian_jadwal_mahasiswa_unique'
    ) THEN
        ALTER TABLE hasil_ujian 
        ADD CONSTRAINT hasil_ujian_jadwal_mahasiswa_unique 
        UNIQUE (jadwal_id, mahasiswa_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 3. Disable RLS and fix policies
ALTER TABLE hasil_ujian DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_hasil" ON hasil_ujian;
DROP POLICY IF EXISTS "hasil_all_access" ON hasil_ujian;
DROP POLICY IF EXISTS "hasil_superadmin" ON hasil_ujian;
DROP POLICY IF EXISTS "hasil_mahasiswa_own" ON hasil_ujian;

CREATE POLICY "allow_all_hasil" ON hasil_ujian
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

ALTER TABLE hasil_ujian ENABLE ROW LEVEL SECURITY;

-- 4. Verify the columns exist now
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'hasil_ujian'
ORDER BY ordinal_position;
