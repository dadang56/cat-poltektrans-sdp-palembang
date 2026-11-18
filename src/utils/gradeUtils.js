/**
 * Grade Calculation Utilities
 * 
 * Two formulas based on SKS type (Bobot Penilaian Akademik):
 * - With Praktek:    NAK = (NT*10%) + (NUTS*30%) + (NP*20%) + (NUAS*40%)
 * - Without Praktek: NAK = (NT*10%) + (NUTS*30%) + (NUAS*60%)
 */

// Grade conversion table
// Skala penilaian akademik (Pasal 20 - Peraturan Akademik Poltektrans SDP Palembang)
//  >85,00–100,00 = A  (4,00)   | >75,00–85,00 = AB (3,50)
//  >65,00–75,00  = B  (3,00)   | >60,00–65,00 = BC (2,50)
//  >55,00–60,00  = C  (2,00)   | >44,00–55,00 = D  (1,00)
//  00,00–44,00   = E  (0,00)
// Nilai dibulatkan 2 desimal, jadi batas ">X,00" diwakili min = X,01.
const GRADE_TABLE = [
    { min: 85.01, max: 100, huruf: 'A', bobot: 4.00, predikat: 'Sangat Baik' },
    { min: 75.01, max: 85, huruf: 'AB', bobot: 3.50, predikat: 'Lebih Dari Baik' },
    { min: 65.01, max: 75, huruf: 'B', bobot: 3.00, predikat: 'Baik' },
    { min: 60.01, max: 65, huruf: 'BC', bobot: 2.50, predikat: 'Lebih Dari Cukup' },
    { min: 55.01, max: 60, huruf: 'C', bobot: 2.00, predikat: 'Cukup' },
    { min: 44.01, max: 55, huruf: 'D', bobot: 1.00, predikat: 'Kurang' },
    { min: 0, max: 44, huruf: 'E', bobot: 0.00, predikat: 'Sangat Kurang' }
]

/**
 * Calculate NAK (Nilai Akhir) based on grade components
 * @param {number} nt - Nilai Tugas (0-100)
 * @param {number} np - Nilai Praktek (0-100, null if no praktek)
 * @param {number} nuts - Nilai UTS (0-100)
 * @param {number} nuas - Nilai UAS (0-100)
 * @param {boolean} hasPraktek - Whether course has praktek component
 * @returns {number} NAK (0-100)
 */
export function calculateNAK(nt, np, nuts, nuas, hasPraktek) {
    const nilaiTugas = Number(nt) || 0
    const nilaiPraktek = Number(np) || 0
    const nilaiUTS = Number(nuts) || 0
    const nilaiUAS = Number(nuas) || 0

    let nak
    if (hasPraktek) {
        // With Praktek: (NT*10%) + (NUTS*30%) + (NP*20%) + (NUAS*40%)
        nak = (nilaiTugas * 0.10) + (nilaiUTS * 0.30) + (nilaiPraktek * 0.20) + (nilaiUAS * 0.40)
    } else {
        // Without Praktek: (NT*10%) + (NUTS*30%) + (NUAS*60%)
        nak = (nilaiTugas * 0.10) + (nilaiUTS * 0.30) + (nilaiUAS * 0.60)
    }

    return Math.round(nak * 100) / 100 // Round to 2 decimal places
}

/**
 * Normalize a raw exam score to a 0-100 scale.
 * nilai_total/nilai_final MUST be on a 0-100 scale because every downstream
 * consumer (NAK formula, remedial cap of 70, KHS) treats it as a percentage.
 * Without this, an exam whose question weights don't sum to 100
 * (e.g. 20 soal x 10 = 200) produces wrong grades.
 * @param {number} rawScore - Sum of earned points
 * @param {number} maxScore - Sum of max points (total bobot)
 * @returns {number} Score on 0-100 scale (2 decimals)
 */
export function toPercentScore(rawScore, maxScore) {
    const max = Number(maxScore) || 0
    if (max <= 0) return 0
    return Math.round((Number(rawScore) || 0) / max * 100 * 100) / 100
}

/**
 * Get grade details from NAK value
 * @param {number} nak - Nilai Akhir (0-100)
 * @returns {Object} { huruf, bobot, predikat }
 */
export function getGradeFromNAK(nak) {
    const nilai = Number(nak) || 0

    for (const grade of GRADE_TABLE) {
        if (nilai >= grade.min && nilai <= grade.max) {
            return {
                huruf: grade.huruf,
                bobot: grade.bobot,
                predikat: grade.predikat
            }
        }
    }

    // Default to E if not found
    return { huruf: 'E', bobot: 0.00, predikat: 'Sangat Kurang' }
}

/**
 * Get letter grade from NAK
 * @param {number} nak - Nilai Akhir (0-100)
 * @returns {string} Letter grade (A, AB, B, BC, C, D, E)
 */
export function getGradeLetter(nak) {
    return getGradeFromNAK(nak).huruf
}

/**
 * Get numeric bobot from NAK
 * @param {number} nak - Nilai Akhir (0-100)
 * @returns {number} Bobot (0.00 - 4.00)
 */
export function getGradeBobot(nak) {
    return getGradeFromNAK(nak).bobot
}

/**
 * Get predikat from NAK
 * @param {number} nak - Nilai Akhir (0-100)
 * @returns {string} Predikat description
 */
export function getGradePredikat(nak) {
    return getGradeFromNAK(nak).predikat
}

/**
 * Calculate complete grade data
 * @param {Object} scores - { nt, np, nuts, nuas }
 * @param {boolean} hasPraktek - Whether course has praktek
 * @returns {Object} { nak, huruf, bobot, predikat }
 */
export function calculateFullGrade(scores, hasPraktek) {
    const { nt, np, nuts, nuas } = scores
    const nak = calculateNAK(nt, np, nuts, nuas, hasPraktek)
    const grade = getGradeFromNAK(nak)

    return {
        nilai_akhir: nak,
        nilai_huruf: grade.huruf,
        bobot: grade.bobot,
        predikat: grade.predikat
    }
}

/**
 * Get grade color class for UI
 * @param {string} huruf - Letter grade
 * @returns {string} CSS class name
 */
export function getGradeColorClass(huruf) {
    switch (huruf) {
        case 'A': return 'grade-excellent'
        case 'AB': return 'grade-very-good'
        case 'B': return 'grade-good'
        case 'BC': return 'grade-above-avg'
        case 'C': return 'grade-average'
        case 'D': return 'grade-poor'
        case 'E': return 'grade-fail'
        default: return ''
    }
}

/**
 * Get formula description based on course type
 * @param {boolean} hasPraktek
 * @returns {string} Formula description
 */
export function getFormulaDescription(hasPraktek) {
    if (hasPraktek) {
        return 'NAK = (NT×10%) + (UTS×30%) + (NP×20%) + (UAS×40%)'
    }
    return 'NAK = (NT×10%) + (UTS×30%) + (UAS×60%)'
}

export { GRADE_TABLE }

const isEssayType = t => t === 'essay' || t === 'uraian'
const normalizeChoice = (val) => {
    if (val === null || val === undefined || val === '') return null
    if (typeof val === 'string' && /^[A-E]$/i.test(val)) {
        return { A: 0, B: 1, C: 2, D: 3, E: 4 }[val.toUpperCase()]
    }
    return Number(val)
}

/**
 * Score saved answers against the question bank, the same way the exam page
 * does on submit. Used to finish an attempt the student never submitted
 * (left the exam, laptop or connection died) and to repair results saved
 * without points. Essay scores already given by the dosen are kept.
 * @param {Array} answers - answers_detail entries ({ questionId, type, answer, ... })
 * @param {Object} soalById - soal rows keyed by String(id)
 * @returns {{ answers: Array, raw: number, max: number, essayPending: boolean,
 *            benar: number, salah: number, kosong: number }}
 */
export function gradeAnswerDetails(answers, soalById) {
    let raw = 0
    let max = 0
    const graded = (answers || []).map(a => {
        const soal = soalById[String(a.questionId)]
        const type = a.type || soal?.tipe_soal || 'pilihan_ganda'
        const maxPoints = Number(a.maxPoints ?? soal?.bobot ?? 10) || 0
        max += maxPoints
        if (isEssayType(type)) {
            const earned = a.earnedPoints ?? null
            raw += earned || 0
            return { ...a, type, maxPoints, earnedPoints: earned, isCorrect: a.isCorrect ?? null, needsManualGrading: true }
        }
        const correct = soal ? soal.jawaban_benar : a.correctAnswer
        let isCorrect = false
        if (a.answer !== null && a.answer !== undefined && a.answer !== '' && correct !== null && correct !== undefined) {
            isCorrect = type === 'benar_salah'
                ? String(a.answer) === String(correct)
                : normalizeChoice(a.answer) === normalizeChoice(correct)
        }
        const earned = isCorrect ? maxPoints : 0
        raw += earned
        return { ...a, type, correctAnswer: correct, maxPoints, isCorrect, earnedPoints: earned, needsManualGrading: false }
    })
    const isEmpty = a => a.answer === null || a.answer === undefined || String(a.answer).trim() === ''
    return {
        answers: graded,
        raw,
        max,
        essayPending: graded.some(a => a.needsManualGrading && (a.earnedPoints === null || a.earnedPoints === undefined)),
        benar: graded.filter(a => a.isCorrect === true).length,
        salah: graded.filter(a => a.isCorrect === false && !isEmpty(a)).length,
        kosong: graded.filter(isEmpty).length
    }
}
