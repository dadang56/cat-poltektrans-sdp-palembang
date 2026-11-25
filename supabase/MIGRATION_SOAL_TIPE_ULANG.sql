-- ============================================
-- MIGRATION: izinkan soal ber-tipe 'ULANG' (Ujian Ulang / remedial)
-- Melengkapi MIGRATION_UJIAN_ULANG.sql yang hanya memperluas jadwal_ujian.tipe.
-- Tanpa ini, membuat paket soal Ujian Ulang gagal karena check constraint.
-- Jalankan di Supabase SQL Editor.
-- ============================================

ALTER TABLE soal DROP CONSTRAINT IF EXISTS soal_tipe_ujian_check;
ALTER TABLE soal ADD CONSTRAINT soal_tipe_ujian_check
  CHECK (tipe_ujian IN ('UTS', 'UAS', 'ULANG'));
