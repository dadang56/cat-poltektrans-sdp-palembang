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
    nama VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    password VARCHAR(255), -- For legacy login
    role VARCHAR(20) NOT NULL CHECK (role IN ('superadmin', 'admin', 'admin_prodi', 'dosen', 'mahasiswa', 'pengawas')),
    prodi_id UUID REFERENCES prodi(id) ON DELETE SET NULL,
    kelas_id UUID REFERENCES kelas(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. MATA KULIAH
CREATE TABLE mata_kuliah (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    kode VARCHAR(20) UNIQUE NOT NULL,
    nama VARCHAR(255) NOT NULL,
    sks INTEGER DEFAULT 3,
    sks_praktek INTEGER DEFAULT 0,
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
INSERT INTO mata_kuliah (kode, nama, sks, prodi_id)
SELECT 'TI101', 'Pemrograman Dasar', 3, id FROM prodi WHERE kode = 'TI';

INSERT INTO mata_kuliah (kode, nama, sks, prodi_id)
SELECT 'TI102', 'Basis Data', 3, id FROM prodi WHERE kode = 'TI';

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
