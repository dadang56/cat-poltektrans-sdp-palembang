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
