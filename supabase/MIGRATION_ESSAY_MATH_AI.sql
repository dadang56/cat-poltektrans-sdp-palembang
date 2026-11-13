-- Essay options (2026-11-13)
-- math_keyboard:   dosen turns on the math symbol keyboard for an essay question
-- pedoman_jawaban: optional answer guide shown when grading and sent to "Tanya AI"
ALTER TABLE soal ADD COLUMN IF NOT EXISTS math_keyboard BOOLEAN DEFAULT FALSE;
ALTER TABLE soal ADD COLUMN IF NOT EXISTS pedoman_jawaban TEXT;
NOTIFY pgrst, 'reload schema';
