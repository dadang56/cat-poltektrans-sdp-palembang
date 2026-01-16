-- ============================================
-- CAT POLTEKTRANS EXAM - Seed Data
-- Run this AFTER schema.sql
-- ============================================

-- Get prodi IDs for reference
DO $$
DECLARE
    prodi_ti_id UUID;
    prodi_tm_id UUID;
    kelas_ti1a_id UUID;
    kelas_ti1b_id UUID;
    matkul_alpro_id UUID;
    matkul_basis_id UUID;
BEGIN
    -- Get prodi IDs
    SELECT id INTO prodi_ti_id FROM prodi WHERE kode = 'TI' LIMIT 1;
    SELECT id INTO prodi_tm_id FROM prodi WHERE kode = 'TM' LIMIT 1;
    
    -- Insert Kelas
    INSERT INTO kelas (id, nama, prodi_id, angkatan) VALUES
        (uuid_generate_v4(), 'TI-1A', prodi_ti_id, 2024),
        (uuid_generate_v4(), 'TI-1B', prodi_ti_id, 2024),
        (uuid_generate_v4(), 'TI-2A', prodi_ti_id, 2023),
        (uuid_generate_v4(), 'TM-1A', prodi_tm_id, 2024)
    ON CONFLICT DO NOTHING;
    
    -- Get kelas IDs
    SELECT id INTO kelas_ti1a_id FROM kelas WHERE nama = 'TI-1A' LIMIT 1;
    SELECT id INTO kelas_ti1b_id FROM kelas WHERE nama = 'TI-1B' LIMIT 1;
    
    -- Insert Users
    -- Super Admin
    INSERT INTO users (nim_nip, nama, email, role, status) VALUES
        ('superadmin', 'Super Administrator', 'admin@poltektrans.ac.id', 'superadmin', 'active')
    ON CONFLICT (nim_nip) DO NOTHING;
    
    -- Admin Prodi
    INSERT INTO users (nim_nip, nama, email, role, prodi_id, status) VALUES
        ('admin', 'Admin Prodi TI', 'admin.ti@poltektrans.ac.id', 'admin_prodi', prodi_ti_id, 'active')
    ON CONFLICT (nim_nip) DO NOTHING;
    
    -- Dosen
    INSERT INTO users (nim_nip, nama, email, role, prodi_id, status) VALUES
        ('dosen', 'Dr. Ahmad Suryadi, M.Kom', 'ahmad.suryadi@poltektrans.ac.id', 'dosen', prodi_ti_id, 'active'),
        ('198501012010011001', 'Dr. Budi Hartono, M.T', 'budi.hartono@poltektrans.ac.id', 'dosen', prodi_ti_id, 'active')
    ON CONFLICT (nim_nip) DO NOTHING;
    
    -- Pengawas
    INSERT INTO users (nim_nip, nama, email, role, status) VALUES
        ('pengawas', 'Pengawas Ujian', 'pengawas@poltektrans.ac.id', 'pengawas', 'active')
    ON CONFLICT (nim_nip) DO NOTHING;
    
    -- Mahasiswa
    INSERT INTO users (nim_nip, nama, email, role, prodi_id, kelas_id, status) VALUES
        ('2024001', 'Budi Santoso', 'budi.santoso@student.poltektrans.ac.id', 'mahasiswa', prodi_ti_id, kelas_ti1a_id, 'active'),
        ('2024002', 'Siti Rahayu', 'siti.rahayu@student.poltektrans.ac.id', 'mahasiswa', prodi_ti_id, kelas_ti1a_id, 'active'),
        ('2024003', 'Andi Pratama', 'andi.pratama@student.poltektrans.ac.id', 'mahasiswa', prodi_ti_id, kelas_ti1a_id, 'active'),
        ('2024004', 'Dewi Lestari', 'dewi.lestari@student.poltektrans.ac.id', 'mahasiswa', prodi_ti_id, kelas_ti1b_id, 'active'),
        ('2024005', 'Rudi Hermawan', 'rudi.hermawan@student.poltektrans.ac.id', 'mahasiswa', prodi_ti_id, kelas_ti1b_id, 'active'),
        ('mahasiswa', 'Demo Mahasiswa', 'demo@student.poltektrans.ac.id', 'mahasiswa', prodi_ti_id, kelas_ti1a_id, 'active')
    ON CONFLICT (nim_nip) DO NOTHING;
    
    -- Insert Mata Kuliah
    INSERT INTO mata_kuliah (id, kode, nama, sks, prodi_id) VALUES
        (uuid_generate_v4(), 'TI101', 'Algoritma dan Pemrograman', 3, prodi_ti_id),
        (uuid_generate_v4(), 'TI102', 'Basis Data', 3, prodi_ti_id),
        (uuid_generate_v4(), 'TI103', 'Jaringan Komputer', 3, prodi_ti_id),
        (uuid_generate_v4(), 'TI201', 'Pemrograman Web', 3, prodi_ti_id),
        (uuid_generate_v4(), 'TI202', 'Sistem Informasi', 3, prodi_ti_id)
    ON CONFLICT (kode) DO NOTHING;
    
END $$;

COMMIT;
