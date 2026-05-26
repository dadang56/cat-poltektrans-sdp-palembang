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
