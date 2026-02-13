-- ============================================
-- CAT POLTEKTRANS EXAM - Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PRODI (Program Studi)
-- ============================================
CREATE TABLE IF NOT EXISTS prodi (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    kode VARCHAR(20) UNIQUE NOT NULL,
    nama VARCHAR(255) NOT NULL,
    ketua VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. KELAS
-- ============================================
CREATE TABLE IF NOT EXISTS kelas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    prodi_id UUID REFERENCES prodi(id) ON DELETE CASCADE,
    angkatan INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. USERS (All user types)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    auth_id UUID UNIQUE, -- Links to Supabase Auth
    nim_nip VARCHAR(50) UNIQUE NOT NULL,
    nama VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(20) NOT NULL CHECK (role IN ('superadmin', 'admin', 'admin_prodi', 'dosen', 'mahasiswa', 'pengawas', 'pusbangkatar')),
    prodi_id UUID REFERENCES prodi(id) ON DELETE SET NULL,
    kelas_id UUID REFERENCES kelas(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. MATA KULIAH
-- ============================================
CREATE TABLE IF NOT EXISTS mata_kuliah (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    kode VARCHAR(20) UNIQUE NOT NULL,
    nama VARCHAR(255) NOT NULL,
    sks INTEGER DEFAULT 3,
    prodi_id UUID REFERENCES prodi(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. RUANG UJIAN
-- ============================================
CREATE TABLE IF NOT EXISTS ruang_ujian (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    kapasitas INTEGER DEFAULT 30,
    lokasi VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. JADWAL UJIAN
-- ============================================
CREATE TABLE IF NOT EXISTS jadwal_ujian (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    matkul_id UUID REFERENCES mata_kuliah(id) ON DELETE CASCADE,
    kelas_id UUID REFERENCES kelas(id) ON DELETE CASCADE,
    tipe VARCHAR(10) NOT NULL CHECK (tipe IN ('UTS', 'UAS')),
    tanggal DATE NOT NULL,
    waktu_mulai TIME NOT NULL,
    waktu_selesai TIME NOT NULL,
    durasi INTEGER DEFAULT 90, -- in minutes
    ruangan_id UUID REFERENCES ruang_ujian(id) ON DELETE SET NULL,
    dosen_id UUID REFERENCES users(id) ON DELETE SET NULL,
    pengawas_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
    tahun_akademik VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. SOAL (Exam Questions)
-- ============================================
CREATE TABLE IF NOT EXISTS soal (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    matkul_id UUID REFERENCES mata_kuliah(id) ON DELETE CASCADE,
    dosen_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tipe_ujian VARCHAR(10) CHECK (tipe_ujian IN ('UTS', 'UAS')),
    tipe_soal VARCHAR(30) NOT NULL CHECK (tipe_soal IN ('pilihan_ganda', 'pilihan_ganda_kompleks', 'benar_salah', 'menjodohkan', 'uraian')),
    pertanyaan TEXT NOT NULL,
    pilihan JSONB, -- For multiple choice: [{id, text}]
    jawaban_benar JSONB, -- Correct answer(s)
    bobot INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 8. JAWABAN MAHASISWA
-- ============================================
CREATE TABLE IF NOT EXISTS jawaban_mahasiswa (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    jadwal_id UUID REFERENCES jadwal_ujian(id) ON DELETE CASCADE,
    mahasiswa_id UUID REFERENCES users(id) ON DELETE CASCADE,
    soal_id UUID REFERENCES soal(id) ON DELETE CASCADE,
    jawaban JSONB,
    nilai DECIMAL(5,2),
    is_correct BOOLEAN,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(jadwal_id, mahasiswa_id, soal_id)
);

-- ============================================
-- 9. HASIL UJIAN
-- ============================================
CREATE TABLE IF NOT EXISTS hasil_ujian (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    jadwal_id UUID REFERENCES jadwal_ujian(id) ON DELETE CASCADE,
    mahasiswa_id UUID REFERENCES users(id) ON DELETE CASCADE,
    nilai_total DECIMAL(5,2),
    jumlah_benar INTEGER DEFAULT 0,
    jumlah_salah INTEGER DEFAULT 0,
    jumlah_kosong INTEGER DEFAULT 0,
    waktu_mulai TIMESTAMP WITH TIME ZONE,
    waktu_selesai TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted', 'graded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(jadwal_id, mahasiswa_id)
);

-- ============================================
-- 10. KEHADIRAN
-- ============================================
CREATE TABLE IF NOT EXISTS kehadiran (
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

-- ============================================
-- 11. APP SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 12. BERITA ACARA
-- ============================================
CREATE TABLE IF NOT EXISTS berita_acara (
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

-- ============================================
-- Create indexes for better performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_prodi ON users(prodi_id);
CREATE INDEX IF NOT EXISTS idx_jadwal_tanggal ON jadwal_ujian(tanggal);
CREATE INDEX IF NOT EXISTS idx_jadwal_status ON jadwal_ujian(status);
CREATE INDEX IF NOT EXISTS idx_soal_matkul ON soal(matkul_id);
CREATE INDEX IF NOT EXISTS idx_jawaban_jadwal ON jawaban_mahasiswa(jadwal_id);
CREATE INDEX IF NOT EXISTS idx_hasil_mahasiswa ON hasil_ujian(mahasiswa_id);

-- ============================================
-- Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE prodi ENABLE ROW LEVEL SECURITY;
ALTER TABLE kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mata_kuliah ENABLE ROW LEVEL SECURITY;
ALTER TABLE jadwal_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE soal ENABLE ROW LEVEL SECURITY;
ALTER TABLE jawaban_mahasiswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE hasil_ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE kehadiran ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies (Allow all for now, will be refined)
-- ============================================
CREATE POLICY "Allow all access" ON users FOR ALL USING (true);
CREATE POLICY "Allow all access" ON prodi FOR ALL USING (true);
CREATE POLICY "Allow all access" ON kelas FOR ALL USING (true);
CREATE POLICY "Allow all access" ON mata_kuliah FOR ALL USING (true);
CREATE POLICY "Allow all access" ON jadwal_ujian FOR ALL USING (true);
CREATE POLICY "Allow all access" ON soal FOR ALL USING (true);
CREATE POLICY "Allow all access" ON jawaban_mahasiswa FOR ALL USING (true);
CREATE POLICY "Allow all access" ON hasil_ujian FOR ALL USING (true);
CREATE POLICY "Allow all access" ON kehadiran FOR ALL USING (true);
CREATE POLICY "Allow all access" ON ruang_ujian FOR ALL USING (true);
CREATE POLICY "Allow all access" ON app_settings FOR ALL USING (true);
CREATE POLICY "Allow all access" ON berita_acara FOR ALL USING (true);

-- ============================================
-- Insert sample data
-- ============================================

-- Sample Prodi
INSERT INTO prodi (kode, nama, ketua) VALUES
    ('TI', 'Teknologi Informasi', 'Dr. Ahmad Suryadi'),
    ('TM', 'Teknik Mesin', 'Dr. Budi Santoso'),
    ('TP', 'Teknik Perkapalan', 'Dr. Cahyo Wibowo')
ON CONFLICT (kode) DO NOTHING;

-- Sample Ruang Ujian
INSERT INTO ruang_ujian (nama, kapasitas, lokasi) VALUES
    ('Lab Komputer 1', 40, 'Gedung A Lt.1'),
    ('Lab Komputer 2', 35, 'Gedung A Lt.2'),
    ('Ruang Teori 1', 50, 'Gedung B Lt.1')
ON CONFLICT DO NOTHING;

COMMIT;
