-- =====================================================================
-- SKEMA LENGKAP UNTUK PROJECT STAGING (cat-poltektrans-staging)
-- Gabungan migrasi CAT + LMS + SIAKAD. Tempel SELURUH file ini ke
-- Supabase (staging) -> SQL Editor -> RUN. Jalankan di DB KOSONG.
-- Dibuat otomatis dari file migrasi asli.
-- =====================================================================


-- ============================================================
-- SUMBER: CAT/CLEAN_REBUILD.sql (base: drop+create semua tabel CAT)
-- ============================================================

-- ============================================
-- CAT POLTEKTRANS - CLEAN REBUILD
-- ============================================
-- Script ini akan:
-- 1. DROP semua tabel lama
-- 2. Buat tabel baru dengan semua kolom yang diperlukan
-- 3. DISABLE RLS sepenuhnya
-- 4. Buat sample data untuk testing
--
-- JALANKAN DI SUPABASE SQL EDITOR
-- ============================================

-- ============================================
-- PART 0: DROP ALL EXISTING TABLES
-- ============================================
-- Drop in reverse order of dependencies

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

-- ============================================
-- PART 1: CREATE TABLES
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PRODI (Program Studi)
CREATE TABLE prodi (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    kode VARCHAR(20) UNIQUE NOT NULL,
    nama VARCHAR(255) NOT NULL,
    ketua VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. KELAS
CREATE TABLE kelas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    prodi_id UUID REFERENCES prodi(id) ON DELETE CASCADE,
    angkatan INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. USERS (All user types)
CREATE TABLE users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    auth_id UUID UNIQUE,
    nim_nip VARCHAR(50) UNIQUE NOT NULL,
    username VARCHAR(100),
    nip VARCHAR(50), -- For dosen NIP
    nama VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    password VARCHAR(255), -- For legacy login
    role VARCHAR(20) NOT NULL CHECK (role IN ('superadmin', 'admin', 'admin_prodi', 'dosen', 'mahasiswa', 'pengawas', 'pusbangkatar')),
    prodi_id UUID REFERENCES prodi(id) ON DELETE SET NULL,
    kelas_id UUID REFERENCES kelas(id) ON DELETE SET NULL,
    -- Dosen specific fields (arrays stored as JSON strings)
    prodi_ids TEXT, -- JSON array of prodi IDs for dosen
    kelas_ids TEXT, -- JSON array of kelas IDs for dosen
    matkul_ids TEXT, -- JSON array of matkul IDs for dosen
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    photo TEXT, -- Profile photo URL or base64
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. MATA KULIAH
CREATE TABLE mata_kuliah (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    kode VARCHAR(20) UNIQUE NOT NULL,
    nama VARCHAR(255) NOT NULL,
    semester INTEGER DEFAULT 1, -- Semester 1-8
    sks_teori INTEGER DEFAULT 2, -- SKS Teori
    sks_praktek INTEGER DEFAULT 0, -- SKS Praktek
    sks INTEGER DEFAULT 2, -- Total SKS (computed)
    prodi_id UUID REFERENCES prodi(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. RUANG UJIAN
CREATE TABLE ruang_ujian (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    kapasitas INTEGER DEFAULT 30,
    lokasi VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. JADWAL UJIAN
CREATE TABLE jadwal_ujian (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    matkul_id UUID REFERENCES mata_kuliah(id) ON DELETE CASCADE,
    kelas_id UUID REFERENCES kelas(id) ON DELETE CASCADE,
    tipe VARCHAR(10) NOT NULL CHECK (tipe IN ('UTS', 'UAS')),
    tanggal DATE NOT NULL,
    waktu_mulai TIME NOT NULL,
    waktu_selesai TIME NOT NULL,
    durasi INTEGER DEFAULT 90,
    ruangan_id UUID REFERENCES ruang_ujian(id) ON DELETE SET NULL,
    dosen_id UUID REFERENCES users(id) ON DELETE SET NULL,
    pengawas_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
    tahun_akademik VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. SOAL (Exam Questions)
CREATE TABLE soal (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    matkul_id UUID REFERENCES mata_kuliah(id) ON DELETE CASCADE,
    dosen_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tipe_ujian VARCHAR(10) CHECK (tipe_ujian IN ('UTS', 'UAS')),
    tipe_soal VARCHAR(30) NOT NULL CHECK (tipe_soal IN ('pilihan_ganda', 'pilihan_ganda_kompleks', 'benar_salah', 'menjodohkan', 'uraian')),
    pertanyaan TEXT NOT NULL,
    pilihan JSONB,
    jawaban_benar JSONB,
    bobot INTEGER DEFAULT 10,
    gambar TEXT, -- For question images (base64 or URL)
    kelas_ids UUID[], -- Array of kelas IDs this question applies to
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. HASIL UJIAN
CREATE TABLE hasil_ujian (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    jadwal_id UUID REFERENCES jadwal_ujian(id) ON DELETE CASCADE,
    mahasiswa_id UUID REFERENCES users(id) ON DELETE CASCADE,
    nilai_total DECIMAL(5,2),
    jumlah_benar INTEGER DEFAULT 0,
    jumlah_salah INTEGER DEFAULT 0,
    jumlah_kosong INTEGER DEFAULT 0,
    waktu_mulai TIMESTAMP WITH TIME ZONE,
    waktu_selesai TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted', 'graded', 'kicked')),
    answers_detail JSONB, -- [{questionId, answer, isCorrect, earnedPoints, maxPoints}]
    nilai_tugas DECIMAL(5,2), -- For final grade calculation
    nilai_praktek DECIMAL(5,2), -- For final grade calculation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(jadwal_id, mahasiswa_id)
);

-- 9. KEHADIRAN
CREATE TABLE kehadiran (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    jadwal_id UUID REFERENCES jadwal_ujian(id) ON DELETE CASCADE,
    mahasiswa_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'belum' CHECK (status IN ('hadir', 'tidak_hadir', 'izin', 'belum')),
    waktu_hadir TIMESTAMP WITH TIME ZONE,
    keterangan TEXT,
    dicatat_oleh UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(jadwal_id, mahasiswa_id)
);

-- 10. BERITA ACARA
CREATE TABLE berita_acara (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    jadwal_id UUID REFERENCES jadwal_ujian(id) ON DELETE CASCADE,
    pengawas_id UUID REFERENCES users(id) ON DELETE SET NULL,
    jumlah_hadir INTEGER DEFAULT 0,
    jumlah_tidak_hadir INTEGER DEFAULT 0,
    catatan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(jadwal_id)
);

-- 11. APP SETTINGS
CREATE TABLE app_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PART 2: CREATE INDEXES
-- ============================================
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_prodi ON users(prodi_id);
CREATE INDEX idx_users_kelas ON users(kelas_id);
CREATE INDEX idx_jadwal_tanggal ON jadwal_ujian(tanggal);
CREATE INDEX idx_jadwal_status ON jadwal_ujian(status);
CREATE INDEX idx_jadwal_dosen ON jadwal_ujian(dosen_id);
CREATE INDEX idx_soal_matkul ON soal(matkul_id);
CREATE INDEX idx_soal_dosen ON soal(dosen_id);
CREATE INDEX idx_hasil_jadwal ON hasil_ujian(jadwal_id);
CREATE INDEX idx_hasil_mahasiswa ON hasil_ujian(mahasiswa_id);

-- ============================================
-- PART 3: SEED SAMPLE DATA
-- ============================================

-- Insert sample prodi
INSERT INTO prodi (kode, nama) VALUES
('TI', 'Teknik Informatika'),
('SI', 'Sistem Informasi'),
('TK', 'Teknik Komputer');

-- Insert sample kelas
INSERT INTO kelas (nama, prodi_id, angkatan) 
SELECT 'TI-1A', id, 2024 FROM prodi WHERE kode = 'TI';

INSERT INTO kelas (nama, prodi_id, angkatan) 
SELECT 'TI-1B', id, 2024 FROM prodi WHERE kode = 'TI';

-- Insert admin user (password: admin123)
INSERT INTO users (nim_nip, nama, email, password, role) VALUES
('admin', 'Administrator', 'admin@poltektrans.ac.id', 'admin123', 'superadmin');

-- Insert sample dosen
INSERT INTO users (nim_nip, nama, email, password, role, prodi_id) 
SELECT '198501012010011001', 'Dr. Budi Santoso', 'budi@poltektrans.ac.id', 'dosen123', 'dosen', id 
FROM prodi WHERE kode = 'TI';

-- Insert sample pengawas
INSERT INTO users (nim_nip, nama, email, password, role) VALUES
('pengawas01', 'Pengawas Ujian 1', 'pengawas@poltektrans.ac.id', 'pengawas123', 'pengawas');

-- Insert sample mahasiswa
INSERT INTO users (nim_nip, nama, email, password, role, prodi_id, kelas_id)
SELECT '2024001', 'Ahmad Rizky', 'ahmad@student.poltektrans.ac.id', 'mahasiswa123', 'mahasiswa', p.id, k.id
FROM prodi p, kelas k WHERE p.kode = 'TI' AND k.nama = 'TI-1A';

INSERT INTO users (nim_nip, nama, email, password, role, prodi_id, kelas_id)
SELECT '2024002', 'Siti Nurhaliza', 'siti@student.poltektrans.ac.id', 'mahasiswa123', 'mahasiswa', p.id, k.id
FROM prodi p, kelas k WHERE p.kode = 'TI' AND k.nama = 'TI-1A';

-- Insert sample mata kuliah
INSERT INTO mata_kuliah (kode, nama, semester, sks_teori, sks_praktek, sks, prodi_id)
SELECT 'TI101', 'Pemrograman Dasar', 1, 2, 1, 3, id FROM prodi WHERE kode = 'TI';

INSERT INTO mata_kuliah (kode, nama, semester, sks_teori, sks_praktek, sks, prodi_id)
SELECT 'TI102', 'Basis Data', 2, 2, 1, 3, id FROM prodi WHERE kode = 'TI';

-- Insert sample ruang ujian
INSERT INTO ruang_ujian (nama, kapasitas, lokasi) VALUES
('Lab Komputer 1', 40, 'Gedung A Lt. 2'),
('Lab Komputer 2', 40, 'Gedung A Lt. 2'),
('Ruang Teori 1', 50, 'Gedung B Lt. 1');

-- Insert sample jadwal ujian for TODAY
INSERT INTO jadwal_ujian (matkul_id, kelas_id, tipe, tanggal, waktu_mulai, waktu_selesai, durasi, ruangan_id, dosen_id, tahun_akademik, status)
SELECT 
    m.id, 
    k.id, 
    'UTS', 
    CURRENT_DATE, 
    '08:00', 
    '10:00', 
    120,
    r.id,
    d.id,
    '2024/2025 Ganjil',
    'scheduled'
FROM mata_kuliah m, kelas k, ruang_ujian r, users d
WHERE m.kode = 'TI101' AND k.nama = 'TI-1A' AND r.nama = 'Lab Komputer 1' AND d.nim_nip = '198501012010011001';

-- Insert sample soal for the matkul
INSERT INTO soal (matkul_id, dosen_id, tipe_ujian, tipe_soal, pertanyaan, pilihan, jawaban_benar, bobot)
SELECT 
    m.id,
    d.id,
    'UTS',
    'pilihan_ganda',
    'Apa kepanjangan dari HTML?',
    '[{"id": "a", "text": "Hyper Text Markup Language"}, {"id": "b", "text": "High Tech Modern Language"}, {"id": "c", "text": "Home Tool Markup Language"}, {"id": "d", "text": "Hyperlink Text Markup Language"}]'::jsonb,
    '"a"'::jsonb,
    10
FROM mata_kuliah m, users d
WHERE m.kode = 'TI101' AND d.nim_nip = '198501012010011001';

INSERT INTO soal (matkul_id, dosen_id, tipe_ujian, tipe_soal, pertanyaan, pilihan, jawaban_benar, bobot)
SELECT 
    m.id,
    d.id,
    'UTS',
    'pilihan_ganda',
    'Bahasa pemrograman apa yang digunakan untuk styling web?',
    '[{"id": "a", "text": "JavaScript"}, {"id": "b", "text": "HTML"}, {"id": "c", "text": "CSS"}, {"id": "d", "text": "Python"}]'::jsonb,
    '"c"'::jsonb,
    10
FROM mata_kuliah m, users d
WHERE m.kode = 'TI101' AND d.nim_nip = '198501012010011001';

INSERT INTO soal (matkul_id, dosen_id, tipe_ujian, tipe_soal, pertanyaan, pilihan, jawaban_benar, bobot)
SELECT 
    m.id,
    d.id,
    'UTS',
    'benar_salah',
    'JavaScript adalah bahasa pemrograman yang berjalan di browser.',
    '[{"id": "benar", "text": "Benar"}, {"id": "salah", "text": "Salah"}]'::jsonb,
    '"benar"'::jsonb,
    10
FROM mata_kuliah m, users d
WHERE m.kode = 'TI101' AND d.nim_nip = '198501012010011001';

-- ============================================
-- PART 4: VERIFICATION
-- ============================================
SELECT 'Tables created:' as info;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

SELECT 'Data counts:' as info;
SELECT 'prodi' as table_name, COUNT(*) as count FROM prodi
UNION ALL SELECT 'kelas', COUNT(*) FROM kelas
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'mata_kuliah', COUNT(*) FROM mata_kuliah
UNION ALL SELECT 'ruang_ujian', COUNT(*) FROM ruang_ujian
UNION ALL SELECT 'jadwal_ujian', COUNT(*) FROM jadwal_ujian
UNION ALL SELECT 'soal', COUNT(*) FROM soal;

SELECT 'Users created:' as info;
SELECT nim_nip, nama, role FROM users ORDER BY role;

-- ============================================
-- DONE!
-- ============================================
SELECT '✅ CLEAN REBUILD COMPLETED!' as status;
SELECT 'Login credentials:' as info;
SELECT nim_nip as username, password, role FROM users ORDER BY role;


-- ============================================================
-- SUMBER: CAT/MIGRATION_ADD_COLUMNS.sql
-- ============================================================

-- ============================================
-- MIGRATION SCRIPT - ADD MISSING COLUMNS
-- ============================================
-- Script ini TIDAK akan menghapus data yang sudah ada
-- Hanya menambahkan kolom-kolom yang hilang
-- Jalankan di Supabase SQL Editor
-- ============================================

-- 1. Add missing columns to USERS table (for dosen)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS nip VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS prodi_ids TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kelas_ids TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS matkul_ids TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT;

-- 2. Add missing columns to MATA_KULIAH table
ALTER TABLE mata_kuliah ADD COLUMN IF NOT EXISTS semester INTEGER DEFAULT 1;
ALTER TABLE mata_kuliah ADD COLUMN IF NOT EXISTS sks_teori INTEGER DEFAULT 2;

-- 3. Make sure KELAS has angkatan column
ALTER TABLE kelas ADD COLUMN IF NOT EXISTS angkatan INTEGER;

-- 4. Fix SOAL table - drop and recreate constraint to allow more tipe_soal values
-- First, drop the old constraint
ALTER TABLE soal DROP CONSTRAINT IF EXISTS soal_tipe_soal_check;

-- Then create new constraint with all allowed values
ALTER TABLE soal ADD CONSTRAINT soal_tipe_soal_check 
    CHECK (tipe_soal IN ('pilihan_ganda', 'pilihan_ganda_kompleks', 'benar_salah', 'menjodohkan', 'uraian', 'essay'));

-- 5. Make sure gambar column exists in soal table
ALTER TABLE soal ADD COLUMN IF NOT EXISTS gambar TEXT;

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'Migration completed!' as status;

-- Show users columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('username', 'nip', 'prodi_ids', 'kelas_ids', 'matkul_ids', 'photo');

-- Show mata_kuliah columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'mata_kuliah' 
AND column_name IN ('semester', 'sks_teori');

-- Show soal constraints
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'soal' AND constraint_type = 'CHECK';


-- ============================================================
-- SUMBER: CAT/MIGRATION_ADD_PUSBANGKATAR_ROLE.sql
-- ============================================================

-- ============================================
-- MIGRATION: Pusbangkatar Role + Required Columns
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Drop the old role CHECK constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Create new constraint with 'pusbangkatar' role added
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('superadmin', 'admin', 'admin_prodi', 'dosen', 'mahasiswa', 'pengawas', 'pusbangkatar'));

-- 3. Add password column if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);

-- 4. Add username column if not exists  
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);

-- 5. Add nilai_kondite and nilai_semapta columns for Pusbangkatar
ALTER TABLE users ADD COLUMN IF NOT EXISTS nilai_kondite DECIMAL(5,2) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nilai_semapta DECIMAL(5,2) DEFAULT NULL;

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'Migration completed!' as status;

-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('password', 'username', 'nilai_kondite', 'nilai_semapta');

-- Verify role constraint
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'users_role_check';


-- ============================================================
-- SUMBER: CAT/MIGRATION_TAHUN_AKADEMIK.sql
-- ============================================================

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


-- ============================================================
-- SUMBER: CAT/MIGRATION_TAMBAHAN_WAKTU.sql
-- ============================================================

-- ============================================
-- MIGRATION: Add missing columns to hasil_ujian
-- Run this ENTIRE SCRIPT in Supabase SQL Editor
-- ============================================

-- 1. tambahan_waktu: Extra time in minutes added by pengawas
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS tambahan_waktu INTEGER DEFAULT 0;

-- 2. jumlah_pelanggaran: Number of anti-cheat violations
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS jumlah_pelanggaran INTEGER DEFAULT 0;

-- 3. violation_log: JSON log of violation details
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS violation_log TEXT;

-- 4. answers_detail: JSON snapshot of all student answers
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS answers_detail JSONB;

-- 5. nilai_tugas: Task/assignment score for final grade
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS nilai_tugas DECIMAL(5,2);

-- 6. nilai_praktek: Practical score for final grade
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS nilai_praktek DECIMAL(5,2);

-- 7. nilai_uts: Manual UTS override score for final grade
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS nilai_uts DECIMAL(5,2);

-- 8. nilai_uas: Manual UAS override score for final grade
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS nilai_uas DECIMAL(5,2);

-- 9. nilai_final: Final score after remedial/retake
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS nilai_final DECIMAL(5,2);

-- 10. is_ulang: Flag for retake exam
ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS is_ulang BOOLEAN DEFAULT false;

-- 11. Relax status CHECK constraint to support new statuses
ALTER TABLE hasil_ujian DROP CONSTRAINT IF EXISTS hasil_ujian_status_check;
ALTER TABLE hasil_ujian ADD CONSTRAINT hasil_ujian_status_check 
CHECK (status IN ('pending', 'in_progress', 'submitted', 'graded', 'kicked', 'cheating_submitted', 'needs_approval'));

-- Done!
SELECT 'Migration completed successfully! All columns added.' AS result;


-- ============================================================
-- SUMBER: CAT/MIGRATION_UJIAN_ULANG.sql
-- ============================================================

-- ============================================
-- MIGRATION: Ujian Ulang (Remedial Exam)
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Expand jadwal_ujian.tipe to allow 'ULANG'
ALTER TABLE jadwal_ujian DROP CONSTRAINT IF EXISTS jadwal_ujian_tipe_check;
ALTER TABLE jadwal_ujian ADD CONSTRAINT jadwal_ujian_tipe_check 
  CHECK (tipe IN ('UTS', 'UAS', 'ULANG'));

-- 2. Add parent_jadwal_id — links remedial exam to the original exam
ALTER TABLE jadwal_ujian ADD COLUMN IF NOT EXISTS parent_jadwal_id UUID REFERENCES jadwal_ujian(id) ON DELETE SET NULL;

-- 3. Add ulang_ke — which remedial attempt (0 = original, 1 = first retry, 2 = second retry)
ALTER TABLE jadwal_ujian ADD COLUMN IF NOT EXISTS ulang_ke INTEGER DEFAULT 0;

-- 4. Add nilai_final to hasil_ujian — the capped score (max 70 for remedial)
ALTER TABLE hasil_ujian ADD COLUMN IF NOT EXISTS nilai_final DECIMAL(5,2);

-- 5. Add is_ulang flag to hasil_ujian
ALTER TABLE hasil_ujian ADD COLUMN IF NOT EXISTS is_ulang BOOLEAN DEFAULT false;

-- 6. Index for efficient lookup of remedial exams
CREATE INDEX IF NOT EXISTS idx_jadwal_parent ON jadwal_ujian(parent_jadwal_id);
CREATE INDEX IF NOT EXISTS idx_hasil_is_ulang ON hasil_ujian(is_ulang);

-- ============================================
-- BACKFILL: Set nilai_final = nilai_total for all existing records
-- ============================================
UPDATE hasil_ujian SET nilai_final = nilai_total WHERE nilai_final IS NULL;

COMMIT;


-- ============================================================
-- SUMBER: CAT/MIGRATION_CLUSTER_SOAL.sql
-- ============================================================

-- ============================================
-- MIGRATION: Add Cluster Soal Support
-- ============================================
-- Cluster soal allows grouping question variants together.
-- Each cluster represents one "slot" in the exam.
-- Each variant within a cluster has different numbers/values
-- but the same difficulty level.
-- During exam, each student gets 1 random variant per cluster.

-- Add cluster columns to soal table
ALTER TABLE soal ADD COLUMN IF NOT EXISTS cluster_id UUID;
ALTER TABLE soal ADD COLUMN IF NOT EXISTS cluster_label VARCHAR(200);

-- cluster_id: groups variants of the same question together
-- cluster_label: human-readable name like "Soal 1 - Hitung Volume Kapal"
-- Soal without cluster_id are standalone (non-clustered) questions

-- Add is_bank_soal flag for persistent bank soal
ALTER TABLE soal ADD COLUMN IF NOT EXISTS is_bank_soal BOOLEAN DEFAULT true;

-- Add bank_soal_ref to track which bank soal a copied question came from
ALTER TABLE soal ADD COLUMN IF NOT EXISTS bank_soal_ref UUID REFERENCES soal(id) ON DELETE SET NULL;

-- Add gambar column for question images (if not exists)
ALTER TABLE soal ADD COLUMN IF NOT EXISTS gambar TEXT;

-- Add kelas_ids column for class distribution
ALTER TABLE soal ADD COLUMN IF NOT EXISTS kelas_ids JSONB DEFAULT '[]';

-- Index for faster cluster queries
CREATE INDEX IF NOT EXISTS idx_soal_cluster_id ON soal(cluster_id);
CREATE INDEX IF NOT EXISTS idx_soal_is_bank_soal ON soal(is_bank_soal);


-- ============================================================
-- SUMBER: CAT/MIGRATION_KAPRODI_COLUMNS.sql
-- ============================================================

-- ============================================
-- FIX: Add ketua_prodi_nama and ketua_prodi_nip columns to prodi table
-- Run this in Supabase SQL Editor
-- ============================================

-- Add Ka. Prodi name and NIP columns
ALTER TABLE prodi ADD COLUMN IF NOT EXISTS ketua_prodi_nama VARCHAR(255);
ALTER TABLE prodi ADD COLUMN IF NOT EXISTS ketua_prodi_nip VARCHAR(50);


-- ============================================================
-- SUMBER: CAT/MIGRATION_SAFE_DELETE.sql
-- ============================================================

-- =============================================
-- MIGRATION: Safe Delete & Soft Delete
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Remove CASCADE DELETE from hasil_ujian → jadwal_id
ALTER TABLE hasil_ujian DROP CONSTRAINT IF EXISTS hasil_ujian_jadwal_id_fkey;
ALTER TABLE hasil_ujian 
    ADD CONSTRAINT hasil_ujian_jadwal_id_fkey 
    FOREIGN KEY (jadwal_id) REFERENCES jadwal_ujian(id) ON DELETE SET NULL;

-- 2. Remove CASCADE DELETE from kehadiran → jadwal_id
ALTER TABLE kehadiran DROP CONSTRAINT IF EXISTS kehadiran_jadwal_id_fkey;
ALTER TABLE kehadiran 
    ADD CONSTRAINT kehadiran_jadwal_id_fkey 
    FOREIGN KEY (jadwal_id) REFERENCES jadwal_ujian(id) ON DELETE SET NULL;

-- 3. Remove CASCADE DELETE from berita_acara → jadwal_id
ALTER TABLE berita_acara DROP CONSTRAINT IF EXISTS berita_acara_jadwal_id_fkey;
ALTER TABLE berita_acara 
    ADD CONSTRAINT berita_acara_jadwal_id_fkey 
    FOREIGN KEY (jadwal_id) REFERENCES jadwal_ujian(id) ON DELETE SET NULL;

-- 4. Add soft-delete column to jadwal_ujian
ALTER TABLE jadwal_ujian ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 5. (Optional) If jawaban_mahasiswa table exists, remove its CASCADE too
-- Uncomment below if the table exists in your database:
-- ALTER TABLE jawaban_mahasiswa DROP CONSTRAINT IF EXISTS jawaban_mahasiswa_jadwal_id_fkey;
-- ALTER TABLE jawaban_mahasiswa 
--     ADD CONSTRAINT jawaban_mahasiswa_jadwal_id_fkey 
--     FOREIGN KEY (jadwal_id) REFERENCES jadwal_ujian(id) ON DELETE SET NULL;


-- ============================================================
-- SUMBER: LMS/migration_shared_db.sql (tabel LMS + kolom users tambahan)
-- ============================================================

-- ============================================
-- LMS POLTEKTRANS - Safe Migration for Shared CAT Database
-- AMAN dijalankan berulang (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- Tidak menghapus/mengubah data CAT yang sudah ada
-- ============================================

-- ===== 1. UPDATE USERS TABLE =====
-- Tambah role baru ke constraint (pimpinan, kaprodi)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('superadmin', 'admin', 'admin_prodi', 'pimpinan', 'kaprodi', 'dosen', 'mahasiswa', 'pengawas', 'pusbangkatar'));

-- Tambah kolom LMS (yang tidak ada di CAT)
ALTER TABLE users ADD COLUMN IF NOT EXISTS no_hp TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token TEXT;

-- ===== 2. TAHUN AKADEMIK =====
CREATE TABLE IF NOT EXISTS tahun_akademik (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tahun TEXT NOT NULL,
  semester TEXT NOT NULL CHECK (semester IN ('Ganjil', 'Genap')),
  is_active BOOLEAN DEFAULT false,
  tanggal_mulai DATE,
  tanggal_selesai DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 3. KELAS KULIAH (LMS) =====
-- Berbeda dari kelas CAT: ini = mata kuliah + dosen + semester
CREATE TABLE IF NOT EXISTS kelas_kuliah (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  mata_kuliah_id UUID NOT NULL REFERENCES mata_kuliah(id) ON DELETE CASCADE,
  dosen_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tahun_akademik_id UUID REFERENCES tahun_akademik(id) ON DELETE SET NULL,
  kelas_id UUID REFERENCES kelas(id) ON DELETE SET NULL,
  kode_kelas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 4. ENROLLMENT =====
CREATE TABLE IF NOT EXISTS kelas_mahasiswa (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  kelas_kuliah_id UUID NOT NULL REFERENCES kelas_kuliah(id) ON DELETE CASCADE,
  mahasiswa_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kelas_kuliah_id, mahasiswa_id)
);

-- ===== 5. PERTEMUAN =====
CREATE TABLE IF NOT EXISTS pertemuan (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  kelas_kuliah_id UUID NOT NULL REFERENCES kelas_kuliah(id) ON DELETE CASCADE,
  nomor INTEGER NOT NULL,
  topik TEXT,
  tanggal DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 6. MATERI =====
CREATE TABLE IF NOT EXISTS materi (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pertemuan_id UUID REFERENCES pertemuan(id) ON DELETE CASCADE,
  kelas_kuliah_id UUID NOT NULL REFERENCES kelas_kuliah(id) ON DELETE CASCADE,
  judul TEXT NOT NULL,
  deskripsi TEXT,
  tipe TEXT NOT NULL CHECK (tipe IN ('file', 'link', 'video')),
  url TEXT,
  file_path TEXT,
  urutan INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 7. TUGAS =====
CREATE TABLE IF NOT EXISTS tugas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  kelas_kuliah_id UUID NOT NULL REFERENCES kelas_kuliah(id) ON DELETE CASCADE,
  judul TEXT NOT NULL,
  deskripsi TEXT,
  deadline TIMESTAMPTZ,
  bobot_nilai NUMERIC(5,2) DEFAULT 0,
  file_lampiran TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 8. PENGUMPULAN TUGAS =====
CREATE TABLE IF NOT EXISTS pengumpulan_tugas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tugas_id UUID NOT NULL REFERENCES tugas(id) ON DELETE CASCADE,
  mahasiswa_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT,
  catatan TEXT,
  waktu_kumpul TIMESTAMPTZ DEFAULT NOW(),
  nilai NUMERIC(5,2),
  feedback TEXT,
  dinilai_pada TIMESTAMPTZ,
  UNIQUE(tugas_id, mahasiswa_id)
);

-- ===== 9. PRESENSI (GPS) =====
CREATE TABLE IF NOT EXISTS presensi (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pertemuan_id UUID NOT NULL REFERENCES pertemuan(id) ON DELETE CASCADE,
  mahasiswa_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Alpha' CHECK (status IN ('Hadir', 'Izin', 'Sakit', 'Alpha')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  lokasi_valid BOOLEAN DEFAULT false,
  alamat_lokasi TEXT,
  waktu_presensi TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pertemuan_id, mahasiswa_id)
);

-- ===== 10. PENGUMUMAN =====
CREATE TABLE IF NOT EXISTS pengumuman (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  judul TEXT NOT NULL,
  isi TEXT NOT NULL,
  target TEXT DEFAULT 'global' CHECK (target IN ('global', 'dosen', 'mahasiswa', 'prodi')),
  prodi_id UUID REFERENCES prodi(id) ON DELETE SET NULL,
  is_pinned BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 11. NILAI AKHIR =====
CREATE TABLE IF NOT EXISTS nilai_akhir (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  kelas_kuliah_id UUID NOT NULL REFERENCES kelas_kuliah(id) ON DELETE CASCADE,
  mahasiswa_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nilai_tugas NUMERIC(5,2),
  nilai_kuis NUMERIC(5,2),
  nilai_uts NUMERIC(5,2),
  nilai_uas NUMERIC(5,2),
  nilai_total NUMERIC(5,2),
  grade TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kelas_kuliah_id, mahasiswa_id)
);

-- ===== 12. FORUM =====
CREATE TABLE IF NOT EXISTS forum_thread (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  judul TEXT NOT NULL,
  isi TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  kelas_kuliah_id UUID REFERENCES kelas_kuliah(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_reply (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES forum_thread(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  isi TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== ENABLE RLS =====
ALTER TABLE tahun_akademik ENABLE ROW LEVEL SECURITY;
ALTER TABLE kelas_kuliah ENABLE ROW LEVEL SECURITY;
ALTER TABLE kelas_mahasiswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE pertemuan ENABLE ROW LEVEL SECURITY;
ALTER TABLE materi ENABLE ROW LEVEL SECURITY;
ALTER TABLE tugas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengumpulan_tugas ENABLE ROW LEVEL SECURITY;
ALTER TABLE presensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengumuman ENABLE ROW LEVEL SECURITY;
ALTER TABLE nilai_akhir ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_thread ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_reply ENABLE ROW LEVEL SECURITY;

-- ===== RLS POLICIES (Allow all - same as CAT) =====
-- Using simple "allow all" policies matching CAT pattern
DO $$
BEGIN
  -- Drop existing LMS policies if they exist (to avoid conflicts)
  DROP POLICY IF EXISTS "lms_read_tahun_akademik" ON tahun_akademik;
  DROP POLICY IF EXISTS "lms_manage_tahun_akademik" ON tahun_akademik;
  DROP POLICY IF EXISTS "lms_read_kelas_kuliah" ON kelas_kuliah;
  DROP POLICY IF EXISTS "lms_manage_kelas_kuliah" ON kelas_kuliah;
  DROP POLICY IF EXISTS "lms_read_enrollment" ON kelas_mahasiswa;
  DROP POLICY IF EXISTS "lms_manage_enrollment" ON kelas_mahasiswa;
  DROP POLICY IF EXISTS "lms_read_pertemuan" ON pertemuan;
  DROP POLICY IF EXISTS "lms_manage_pertemuan" ON pertemuan;
  DROP POLICY IF EXISTS "lms_read_materi" ON materi;
  DROP POLICY IF EXISTS "lms_manage_materi" ON materi;
  DROP POLICY IF EXISTS "lms_read_tugas" ON tugas;
  DROP POLICY IF EXISTS "lms_manage_tugas" ON tugas;
  DROP POLICY IF EXISTS "lms_read_pengumpulan" ON pengumpulan_tugas;
  DROP POLICY IF EXISTS "lms_submit_tugas" ON pengumpulan_tugas;
  DROP POLICY IF EXISTS "lms_grade_tugas" ON pengumpulan_tugas;
  DROP POLICY IF EXISTS "lms_read_presensi" ON presensi;
  DROP POLICY IF EXISTS "lms_manage_presensi" ON presensi;
  DROP POLICY IF EXISTS "lms_submit_presensi" ON presensi;
  DROP POLICY IF EXISTS "lms_read_pengumuman" ON pengumuman;
  DROP POLICY IF EXISTS "lms_manage_pengumuman" ON pengumuman;
  DROP POLICY IF EXISTS "lms_read_nilai" ON nilai_akhir;
  DROP POLICY IF EXISTS "lms_manage_nilai" ON nilai_akhir;
  DROP POLICY IF EXISTS "lms_read_forum" ON forum_thread;
  DROP POLICY IF EXISTS "lms_create_forum" ON forum_thread;
  DROP POLICY IF EXISTS "lms_read_replies" ON forum_reply;
  DROP POLICY IF EXISTS "lms_create_replies" ON forum_reply;
END $$;

-- Simple allow-all policies (matching CAT pattern)
CREATE POLICY "Allow all access" ON tahun_akademik FOR ALL USING (true);
CREATE POLICY "Allow all access" ON kelas_kuliah FOR ALL USING (true);
CREATE POLICY "Allow all access" ON kelas_mahasiswa FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pertemuan FOR ALL USING (true);
CREATE POLICY "Allow all access" ON materi FOR ALL USING (true);
CREATE POLICY "Allow all access" ON tugas FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pengumpulan_tugas FOR ALL USING (true);
CREATE POLICY "Allow all access" ON presensi FOR ALL USING (true);
CREATE POLICY "Allow all access" ON pengumuman FOR ALL USING (true);
CREATE POLICY "Allow all access" ON nilai_akhir FOR ALL USING (true);
CREATE POLICY "Allow all access" ON forum_thread FOR ALL USING (true);
CREATE POLICY "Allow all access" ON forum_reply FOR ALL USING (true);

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_lms_kelas_kuliah_dosen ON kelas_kuliah(dosen_id);
CREATE INDEX IF NOT EXISTS idx_lms_kelas_kuliah_matkul ON kelas_kuliah(mata_kuliah_id);
CREATE INDEX IF NOT EXISTS idx_lms_enrollment_kelas ON kelas_mahasiswa(kelas_kuliah_id);
CREATE INDEX IF NOT EXISTS idx_lms_enrollment_mhs ON kelas_mahasiswa(mahasiswa_id);
CREATE INDEX IF NOT EXISTS idx_lms_tugas_kelas ON tugas(kelas_kuliah_id);
CREATE INDEX IF NOT EXISTS idx_lms_pengumpulan_tugas ON pengumpulan_tugas(tugas_id);
CREATE INDEX IF NOT EXISTS idx_lms_materi_kelas ON materi(kelas_kuliah_id);
CREATE INDEX IF NOT EXISTS idx_lms_presensi_pertemuan ON presensi(pertemuan_id);
CREATE INDEX IF NOT EXISTS idx_lms_presensi_mhs ON presensi(mahasiswa_id);
CREATE INDEX IF NOT EXISTS idx_lms_pengumuman_created ON pengumuman(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lms_forum_thread ON forum_thread(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lms_forum_reply ON forum_reply(thread_id);

-- ===== INSERT PRODI POLTEKTRANS (if not exists) =====
INSERT INTO prodi (kode, nama, ketua) VALUES
  ('PK', 'Permesinan Kapal', NULL),
  ('SN', 'Studi Nautika', NULL),
  ('MTPD', 'Manajemen Transportasi Perairan Daratan', NULL)
ON CONFLICT (kode) DO NOTHING;


-- ============================================================
-- SUMBER: LMS/migration_fase5.sql (jadwal_pembelajaran dll)
-- ============================================================

-- ============================================
-- LMS POLTEKTRANS - Fase 5 Migration
-- Kuis Harian, Jadwal Pembelajaran
-- ============================================

-- ===== 1. KUIS LMS (harian, per pertemuan) =====
CREATE TABLE IF NOT EXISTS kuis_lms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kelas_kuliah_id UUID REFERENCES kelas_kuliah(id) ON DELETE CASCADE,
  pertemuan_id UUID REFERENCES pertemuan(id) ON DELETE SET NULL,
  judul TEXT NOT NULL,
  deskripsi TEXT,
  waktu_mulai TIMESTAMPTZ,
  waktu_selesai TIMESTAMPTZ,
  durasi_menit INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Soal kuis LMS
CREATE TABLE IF NOT EXISTS soal_kuis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kuis_id UUID REFERENCES kuis_lms(id) ON DELETE CASCADE,
  pertanyaan TEXT NOT NULL,
  pilihan JSONB,
  jawaban_benar INTEGER,
  bobot INTEGER DEFAULT 1,
  urutan INTEGER DEFAULT 0
);

-- Jawaban kuis mahasiswa
CREATE TABLE IF NOT EXISTS jawaban_kuis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kuis_id UUID REFERENCES kuis_lms(id) ON DELETE CASCADE,
  mahasiswa_id UUID REFERENCES users(id) ON DELETE CASCADE,
  soal_id UUID REFERENCES soal_kuis(id) ON DELETE CASCADE,
  jawaban INTEGER,
  is_correct BOOLEAN,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kuis_id, mahasiswa_id, soal_id)
);

-- Hasil kuis
CREATE TABLE IF NOT EXISTS hasil_kuis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kuis_id UUID REFERENCES kuis_lms(id) ON DELETE CASCADE,
  mahasiswa_id UUID REFERENCES users(id) ON DELETE CASCADE,
  nilai NUMERIC(5,2),
  jumlah_benar INTEGER DEFAULT 0,
  jumlah_salah INTEGER DEFAULT 0,
  waktu_mulai TIMESTAMPTZ,
  waktu_selesai TIMESTAMPTZ,
  UNIQUE(kuis_id, mahasiswa_id)
);

-- ===== 2. JADWAL PEMBELAJARAN =====
CREATE TABLE IF NOT EXISTS jadwal_pembelajaran (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kelas_kuliah_id UUID REFERENCES kelas_kuliah(id) ON DELETE CASCADE,
  hari TEXT CHECK (hari IN ('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu')),
  jam_mulai TIME NOT NULL,
  jam_selesai TIME NOT NULL,
  ruangan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== ENABLE RLS =====
ALTER TABLE kuis_lms ENABLE ROW LEVEL SECURITY;
ALTER TABLE soal_kuis ENABLE ROW LEVEL SECURITY;
ALTER TABLE jawaban_kuis ENABLE ROW LEVEL SECURITY;
ALTER TABLE hasil_kuis ENABLE ROW LEVEL SECURITY;
ALTER TABLE jadwal_pembelajaran ENABLE ROW LEVEL SECURITY;

-- ===== RLS POLICIES =====
CREATE POLICY "Allow all access" ON kuis_lms FOR ALL USING (true);
CREATE POLICY "Allow all access" ON soal_kuis FOR ALL USING (true);
CREATE POLICY "Allow all access" ON jawaban_kuis FOR ALL USING (true);
CREATE POLICY "Allow all access" ON hasil_kuis FOR ALL USING (true);
CREATE POLICY "Allow all access" ON jadwal_pembelajaran FOR ALL USING (true);

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_kuis_kelas ON kuis_lms(kelas_kuliah_id);
CREATE INDEX IF NOT EXISTS idx_kuis_pertemuan ON kuis_lms(pertemuan_id);
CREATE INDEX IF NOT EXISTS idx_soal_kuis ON soal_kuis(kuis_id);
CREATE INDEX IF NOT EXISTS idx_jawaban_kuis_mahasiswa ON jawaban_kuis(mahasiswa_id);
CREATE INDEX IF NOT EXISTS idx_hasil_kuis_mahasiswa ON hasil_kuis(mahasiswa_id);
CREATE INDEX IF NOT EXISTS idx_jadwal_pembelajaran_kelas ON jadwal_pembelajaran(kelas_kuliah_id);


-- ============================================================
-- SUMBER: LMS/migration_fase6.sql (absensi_dosen dll)
-- ============================================================

-- ============================================
-- LMS POLTEKTRANS - Fase 6 Migration
-- Absensi Dosen, Dosen Gate, Asisten Dosen, App Settings
-- ============================================

-- ===== 0. APP SETTINGS =====
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON app_settings;
CREATE POLICY "Allow all access" ON app_settings FOR ALL USING (true);
-- Absensi Dosen, Dosen Gate, Asisten Dosen
-- ============================================

-- ===== 1. ASISTEN DOSEN: tambah kolom dosen_utama_id =====
ALTER TABLE users ADD COLUMN IF NOT EXISTS dosen_utama_id UUID REFERENCES users(id);

-- ===== 2. PERTEMUAN: tambah kolom buka/tutup =====
ALTER TABLE pertemuan ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT false;
ALTER TABLE pertemuan ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE pertemuan ADD COLUMN IF NOT EXISTS opened_by UUID REFERENCES users(id);
ALTER TABLE pertemuan ADD COLUMN IF NOT EXISTS toleransi_menit INTEGER DEFAULT 10;
ALTER TABLE pertemuan ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- ===== 3. ABSENSI DOSEN =====
CREATE TABLE IF NOT EXISTS absensi_dosen (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dosen_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pertemuan_id UUID REFERENCES pertemuan(id) ON DELETE CASCADE,
  kelas_kuliah_id UUID REFERENCES kelas_kuliah(id) ON DELETE CASCADE,
  waktu_masuk TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  waktu_keluar TIMESTAMPTZ,
  aktivitas TEXT,
  is_early_leave BOOLEAN DEFAULT false,
  pertemuan_nomor INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dosen_id, pertemuan_id)
);

ALTER TABLE absensi_dosen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON absensi_dosen;
CREATE POLICY "Allow all access" ON absensi_dosen FOR ALL USING (true);

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_absensi_dosen_dosen ON absensi_dosen(dosen_id);
CREATE INDEX IF NOT EXISTS idx_absensi_dosen_kelas ON absensi_dosen(kelas_kuliah_id);
CREATE INDEX IF NOT EXISTS idx_pertemuan_is_open ON pertemuan(is_open);
CREATE INDEX IF NOT EXISTS idx_users_dosen_utama ON users(dosen_utama_id);

-- ===== 4. JADWAL PEMBELAJARAN: tambah kolom independen =====
ALTER TABLE jadwal_pembelajaran ADD COLUMN IF NOT EXISTS kelas_id UUID REFERENCES kelas(id) ON DELETE CASCADE;
ALTER TABLE jadwal_pembelajaran ADD COLUMN IF NOT EXISTS mata_kuliah_id UUID REFERENCES mata_kuliah(id) ON DELETE CASCADE;
ALTER TABLE jadwal_pembelajaran ADD COLUMN IF NOT EXISTS dosen_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_jadwal_kelas ON jadwal_pembelajaran(kelas_id);

-- ===== 5. DOSEN PRODI: many-to-many (dosen bisa mengajar di beberapa prodi) =====
CREATE TABLE IF NOT EXISTS dosen_prodi (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dosen_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prodi_id UUID NOT NULL REFERENCES prodi(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dosen_id, prodi_id)
);
ALTER TABLE dosen_prodi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON dosen_prodi;
CREATE POLICY "Allow all access" ON dosen_prodi FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_dosen_prodi_dosen ON dosen_prodi(dosen_id);
CREATE INDEX IF NOT EXISTS idx_dosen_prodi_prodi ON dosen_prodi(prodi_id);


-- ============================================================
-- SUMBER: SIAKAD/schema.sql (krs, pembayaran_ukt)
-- ============================================================

-- SQL Schema untuk SIAKAD Politeknik Transportasi SDP Palembang
-- Silakan salin dan jalankan script ini di SQL Editor dashboard Supabase Anda.

-- 1. Membuat tabel krs
CREATE TABLE IF NOT EXISTS public.krs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mahasiswa_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  semester INT NOT NULL,
  tahun_ajaran TEXT NOT NULL,
  kelas_ids TEXT[] DEFAULT '{}', -- Menyimpan array ID kelas yang diambil
  status TEXT NOT NULL DEFAULT 'Draft', -- Draft, Menunggu Persetujuan, Menunggu Persetujuan Ka. Prodi, Disetujui Ka. Prodi, Ditolak
  catatan_dosen TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Mengaktifkan RLS untuk tabel krs
ALTER TABLE public.krs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.krs FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.krs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.krs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.krs FOR DELETE USING (true);

-- 2. Membuat tabel pembayaran_ukt
CREATE TABLE IF NOT EXISTS public.pembayaran_ukt (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mahasiswa_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  semester INT NOT NULL,
  status_ukt TEXT NOT NULL DEFAULT 'Belum Lunas', -- Lunas, Belum Lunas
  keterangan TEXT, -- Keterangan kurang berapa/biaya apa yang kurang
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Mengaktifkan RLS untuk tabel pembayaran_ukt
ALTER TABLE public.pembayaran_ukt ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.pembayaran_ukt FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.pembayaran_ukt FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.pembayaran_ukt FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.pembayaran_ukt FOR DELETE USING (true);
