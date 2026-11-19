-- Per-mata-kuliah NAK component weights (dosen-configurable).
--
-- Lets a dosen set the weight (%) of each NAK aspect (NT / NUTS / NP / UAS)
-- for a course, bounded by Peraturan Akademik Pasal 20:
--   Dengan praktek : NT ≤10%, NUTS ≥30%, NP ≥20%, UAS ≤40%  (total 100%)
--   Tanpa praktek  : NT ≥10%, NUTS ≥30%, UAS ≤60%           (total 100%)
--
-- Stored as JSON e.g. {"nt":10,"nuts":30,"np":20,"uas":40}. When NULL the app
-- falls back to the regulation defaults, so existing rows need no backfill.
--
-- Safe + additive. Run this BEFORE deploying the build that selects
-- bobot_nilai (the dosen grade-loading query embeds the column), otherwise
-- that query will error.

ALTER TABLE mata_kuliah
    ADD COLUMN IF NOT EXISTS bobot_nilai jsonb;
