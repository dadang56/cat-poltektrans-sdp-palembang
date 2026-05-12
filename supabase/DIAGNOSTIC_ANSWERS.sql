-- DIAGNOSTIC v3: Only wrong answers, skip non-array data
SELECT 
    left(s.pertanyaan, 50) as soal,
    elem->>'answer' as jwb_siswa,
    s.jawaban_benar as jwb_benar_db,
    elem->>'correctAnswer' as jwb_stored,
    elem->>'isCorrect' as benar,
    elem->>'type' as tipe
FROM hasil_ujian h,
    jsonb_array_elements(h.answers_detail) AS elem
LEFT JOIN soal s ON s.id = (elem->>'questionId')::uuid
WHERE jsonb_typeof(h.answers_detail) = 'array'
  AND (elem->>'isCorrect') = 'false'
ORDER BY h.id
LIMIT 20;
