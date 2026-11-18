-- Electronic-signature (QR) support for dosen & pengawas account settings.
--
-- Adds a per-user flag that turns the QR e-signature on/off for printed
-- Daftar Nilai / Nilai Akhir / Berita Acara / Daftar Hadir documents.
-- The official NIP uses the EXISTING users.nip column (no change needed).
--
-- Safe + additive: existing rows default to false (QR off). Run this BEFORE
-- deploying the app build that reads ttd_qr_enabled, otherwise login queries
-- that select the column will error.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS ttd_qr_enabled boolean DEFAULT false;
