-- ================================================================
-- MIGRATION: Isolasi Data per Tahun Akademik
-- Jalankan di Supabase SQL Editor (copy-paste seluruh file ini)
-- ================================================================

-- 1. Tabel NILAI_PUSBANGKATAR
CREATE TABLE IF NOT EXISTS nilai_pusbangkatar (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    mahasiswa_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tahun_akademik VARCHAR(20) NOT NULL,
    nilai_kondite DECIMAL(3,2) CHECK (nilai_kondite IS NULL OR (nilai_kondite >= 0 AND nilai_kondite <= 4)),
    nilai_semapta DECIMAL(3,2) CHECK (nilai_semapta IS NULL OR (nilai_semapta >= 0 AND nilai_semapta <= 4)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(mahasiswa_id, tahun_akademik)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_nilai_pusbangkatar_ta ON nilai_pusbangkatar(tahun_akademik);
CREATE INDEX IF NOT EXISTS idx_nilai_pusbangkatar_mhs ON nilai_pusbangkatar(mahasiswa_id);

-- 3. Tambah tahun_akademik ke tabel SOAL (jika belum ada)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'soal' AND column_name = 'tahun_akademik'
    ) THEN
        ALTER TABLE soal ADD COLUMN tahun_akademik VARCHAR(20);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_soal_tahun_akademik ON soal(tahun_akademik);

-- 4. RLS Policies (allow all for anon + authenticated)
ALTER TABLE nilai_pusbangkatar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on nilai_pusbangkatar" ON nilai_pusbangkatar;
CREATE POLICY "Allow all operations on nilai_pusbangkatar" ON nilai_pusbangkatar
    FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions to anon and authenticated roles
GRANT ALL ON nilai_pusbangkatar TO anon;
GRANT ALL ON nilai_pusbangkatar TO authenticated;

-- 5. Migrasi data lama (skip jika kolom tidak ada)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'nilai_kondite'
    ) THEN
        INSERT INTO nilai_pusbangkatar (mahasiswa_id, tahun_akademik, nilai_kondite, nilai_semapta)
        SELECT id, '2024/2025 Ganjil', nilai_kondite, nilai_semapta
        FROM users
        WHERE (nilai_kondite IS NOT NULL OR nilai_semapta IS NOT NULL)
          AND role = 'mahasiswa'
        ON CONFLICT (mahasiswa_id, tahun_akademik) DO UPDATE SET
            nilai_kondite = COALESCE(EXCLUDED.nilai_kondite, nilai_pusbangkatar.nilai_kondite),
            nilai_semapta = COALESCE(EXCLUDED.nilai_semapta, nilai_pusbangkatar.nilai_semapta);
        RAISE NOTICE 'Data lama berhasil dimigrasi.';
    ELSE
        RAISE NOTICE 'Kolom nilai_kondite tidak ada di users, skip migrasi data lama.';
    END IF;
END $$;

-- 6. Verifikasi
SELECT 'nilai_pusbangkatar' AS tabel, COUNT(*) AS jumlah FROM nilai_pusbangkatar
UNION ALL
SELECT 'soal (with TA)' AS tabel, COUNT(*) AS jumlah FROM soal WHERE tahun_akademik IS NOT NULL;
