-- ================================================================
-- MIGRATION: Isolasi Data per Tahun Akademik
-- Jalankan di Supabase SQL Editor
-- ================================================================

-- 1. Tabel NILAI_PUSBANGKATAR
-- Menyimpan nilai kondite & semapta per mahasiswa per tahun akademik
-- agar data tidak tertimpa saat berganti TA
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

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_nilai_pusbangkatar_ta ON nilai_pusbangkatar(tahun_akademik);
CREATE INDEX IF NOT EXISTS idx_nilai_pusbangkatar_mhs ON nilai_pusbangkatar(mahasiswa_id);

-- 2. Tambah tahun_akademik ke tabel SOAL
ALTER TABLE soal ADD COLUMN IF NOT EXISTS tahun_akademik VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_soal_tahun_akademik ON soal(tahun_akademik);

-- 3. RLS Policies for nilai_pusbangkatar
ALTER TABLE nilai_pusbangkatar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on nilai_pusbangkatar" ON nilai_pusbangkatar;
CREATE POLICY "Allow all operations on nilai_pusbangkatar" ON nilai_pusbangkatar
    FOR ALL USING (true) WITH CHECK (true);

-- 4. Migrasi data lama (jika ada nilai di tabel users)
-- Pindahkan ke tabel baru dengan TA default
INSERT INTO nilai_pusbangkatar (mahasiswa_id, tahun_akademik, nilai_kondite, nilai_semapta)
SELECT id, '2024/2025 Ganjil', nilai_kondite, nilai_semapta
FROM users
WHERE (nilai_kondite IS NOT NULL OR nilai_semapta IS NOT NULL)
  AND role = 'mahasiswa'
ON CONFLICT (mahasiswa_id, tahun_akademik) DO UPDATE SET
    nilai_kondite = COALESCE(EXCLUDED.nilai_kondite, nilai_pusbangkatar.nilai_kondite),
    nilai_semapta = COALESCE(EXCLUDED.nilai_semapta, nilai_pusbangkatar.nilai_semapta);

-- 5. Verifikasi
SELECT 'nilai_pusbangkatar' AS tabel, COUNT(*) AS jumlah FROM nilai_pusbangkatar
UNION ALL
SELECT 'soal (with TA)' AS tabel, COUNT(*) AS jumlah FROM soal WHERE tahun_akademik IS NOT NULL;
