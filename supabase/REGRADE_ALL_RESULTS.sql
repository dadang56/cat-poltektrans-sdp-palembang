-- ============================================
-- REGRADE v6 - No array_length in WHERE
-- ============================================
DO $$
DECLARE
    rec RECORD;
    detail_arr JSONB;
    new_arr JSONB;
    elem JSONB;
    soal_jawaban JSONB;
    student_ans JSONB;
    is_match BOOLEAN;
    earned NUMERIC;
    new_total NUMERIC;
    i INTEGER;
    arr_len INTEGER;
    regraded INTEGER := 0;
    changed INTEGER := 0;
    old_total NUMERIC;
    q_text TEXT;
    detail_type TEXT;
BEGIN
    FOR rec IN 
        SELECT h.id, h.answers_detail, h.nilai_total
        FROM hasil_ujian h 
        WHERE h.answers_detail IS NOT NULL
    LOOP
        -- Check type safely inside the loop
        BEGIN
            detail_type := jsonb_typeof(rec.answers_detail);
        EXCEPTION WHEN OTHERS THEN
            CONTINUE;
        END;
        
        IF detail_type != 'array' THEN
            CONTINUE;
        END IF;
        
        BEGIN
            arr_len := jsonb_array_length(rec.answers_detail);
        EXCEPTION WHEN OTHERS THEN
            CONTINUE;
        END;
        
        IF arr_len = 0 THEN
            CONTINUE;
        END IF;
        
        new_arr := '[]'::jsonb;
        new_total := 0;
        old_total := COALESCE(rec.nilai_total, 0);
        detail_arr := rec.answers_detail;
        
        FOR i IN 0..arr_len - 1 LOOP
            elem := detail_arr->i;
            
            IF elem IS NULL OR jsonb_typeof(elem) != 'object' THEN
                new_arr := new_arr || jsonb_build_array(elem);
                CONTINUE;
            END IF;
            
            -- Keep essay as-is
            IF elem->>'needsManualGrading' = 'true' THEN
                BEGIN
                    new_total := new_total + COALESCE((elem->>'earnedPoints')::numeric, 0);
                EXCEPTION WHEN OTHERS THEN NULL;
                END;
                new_arr := new_arr || jsonb_build_array(elem);
                CONTINUE;
            END IF;
            
            student_ans := elem->'answer';
            
            soal_jawaban := NULL;
            BEGIN
                SELECT s.jawaban_benar INTO soal_jawaban
                FROM soal s WHERE s.id = (elem->>'questionId')::uuid;
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
            
            is_match := false;
            earned := 0;
            
            IF student_ans IS NOT NULL 
               AND student_ans != 'null'::jsonb 
               AND soal_jawaban IS NOT NULL 
            THEN
                IF student_ans = soal_jawaban THEN
                    is_match := true;
                ELSE
                    BEGIN
                        IF (student_ans #>> '{}') = (soal_jawaban #>> '{}') THEN
                            is_match := true;
                        END IF;
                    EXCEPTION WHEN OTHERS THEN NULL;
                    END;
                END IF;
                
                IF NOT is_match THEN
                    BEGIN
                        IF (student_ans #>> '{}')::int = (soal_jawaban #>> '{}')::int THEN
                            is_match := true;
                        END IF;
                    EXCEPTION WHEN OTHERS THEN NULL;
                    END;
                END IF;
                
                IF is_match THEN
                    BEGIN
                        earned := COALESCE((elem->>'maxPoints')::numeric, 0);
                    EXCEPTION WHEN OTHERS THEN earned := 0;
                    END;
                END IF;
            END IF;
            
            new_total := new_total + earned;
            
            IF is_match AND elem->>'isCorrect' = 'false' THEN
                q_text := '?';
                BEGIN
                    SELECT left(s.pertanyaan, 40) INTO q_text 
                    FROM soal s WHERE s.id = (elem->>'questionId')::uuid;
                EXCEPTION WHEN OTHERS THEN NULL;
                END;
                RAISE NOTICE 'FIXED: "%" jwb=% benar=% -> +% poin', q_text, student_ans, soal_jawaban, earned;
            END IF;
            
            new_arr := new_arr || jsonb_build_array(
                elem || jsonb_build_object(
                    'correctAnswer', COALESCE(soal_jawaban, 'null'::jsonb),
                    'isCorrect', is_match,
                    'earnedPoints', earned
                )
            );
        END LOOP;
        
        UPDATE hasil_ujian 
        SET answers_detail = new_arr,
            nilai_total = new_total,
            updated_at = NOW()
        WHERE id = rec.id;
        
        regraded := regraded + 1;
        IF old_total != new_total THEN
            changed := changed + 1;
            RAISE NOTICE '>> %: % -> % poin', rec.id, old_total, new_total;
        END IF;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Selesai! Diproses: %, Berubah: %', regraded, changed;
    RAISE NOTICE '========================================';
END $$;
