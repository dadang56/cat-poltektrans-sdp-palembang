-- Migration: Add answers_detail column to hasil_ujian table
-- This column stores detailed answers from students in JSON format

ALTER TABLE hasil_ujian 
ADD COLUMN IF NOT EXISTS answers_detail JSONB;

-- Add comment to explain the column
COMMENT ON COLUMN hasil_ujian.answers_detail IS 'Detailed student answers stored as JSON array with question ID, answer, points, etc.';
