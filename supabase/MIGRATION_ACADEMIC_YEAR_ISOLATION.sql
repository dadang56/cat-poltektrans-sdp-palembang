-- Separate CAT schedules and question-bank records by academic year/semester.
-- Safe to run more than once. Existing schedules are assigned from their exam date;
-- existing untagged questions are assigned from created_at when possible.

ALTER TABLE jadwal_ujian
  ADD COLUMN IF NOT EXISTS tahun_akademik VARCHAR(30);

ALTER TABLE soal
  ADD COLUMN IF NOT EXISTS tahun_akademik VARCHAR(30);

UPDATE jadwal_ujian
SET tahun_akademik = CASE
  WHEN EXTRACT(MONTH FROM tanggal) >= 8 THEN
    EXTRACT(YEAR FROM tanggal)::INTEGER::TEXT || '/' || (EXTRACT(YEAR FROM tanggal)::INTEGER + 1)::TEXT || ' Ganjil'
  WHEN EXTRACT(MONTH FROM tanggal) = 1 THEN
    (EXTRACT(YEAR FROM tanggal)::INTEGER - 1)::TEXT || '/' || EXTRACT(YEAR FROM tanggal)::INTEGER::TEXT || ' Ganjil'
  ELSE
    (EXTRACT(YEAR FROM tanggal)::INTEGER - 1)::TEXT || '/' || EXTRACT(YEAR FROM tanggal)::INTEGER::TEXT || ' Genap'
END
WHERE tahun_akademik IS NULL OR BTRIM(tahun_akademik) = '';

UPDATE soal
SET tahun_akademik = COALESCE(
  CASE
    WHEN EXTRACT(MONTH FROM created_at) >= 8 THEN
      EXTRACT(YEAR FROM created_at)::INTEGER::TEXT || '/' || (EXTRACT(YEAR FROM created_at)::INTEGER + 1)::TEXT || ' Ganjil'
    WHEN EXTRACT(MONTH FROM created_at) = 1 THEN
      (EXTRACT(YEAR FROM created_at)::INTEGER - 1)::TEXT || '/' || EXTRACT(YEAR FROM created_at)::INTEGER::TEXT || ' Ganjil'
    ELSE
      (EXTRACT(YEAR FROM created_at)::INTEGER - 1)::TEXT || '/' || EXTRACT(YEAR FROM created_at)::INTEGER::TEXT || ' Genap'
  END,
  (
    SELECT NULLIF(BTRIM(value ->> 'tahunAkademik'), '')
    FROM app_settings
    WHERE key = 'app_config'
  ),
  '2025/2026 Ganjil'
)
WHERE tahun_akademik IS NULL OR BTRIM(tahun_akademik) = '';

CREATE INDEX IF NOT EXISTS idx_jadwal_tahun_akademik
  ON jadwal_ujian(tahun_akademik);

CREATE INDEX IF NOT EXISTS idx_soal_tahun_akademik
  ON soal(tahun_akademik);
