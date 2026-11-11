-- 1) TakeExam has sent submit_type ('auto' | 'manual') since 2026-06-11, but the
--    column never existed. Every final submit failed, so results stayed
--    in_progress until a dosen pressed "Regrade Semua Hasil".
-- 2) server_now() lets the exam timer use the database clock instead of the
--    student's or pengawas's device clock, which is often minutes or hours off.
-- Safe to run more than once.

ALTER TABLE hasil_ujian
  ADD COLUMN IF NOT EXISTS submit_type VARCHAR(10);

CREATE OR REPLACE FUNCTION public.server_now()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$ SELECT now() $$;

GRANT EXECUTE ON FUNCTION public.server_now() TO anon, authenticated;

-- Make PostgREST see the new column and function right away
NOTIFY pgrst, 'reload schema';
