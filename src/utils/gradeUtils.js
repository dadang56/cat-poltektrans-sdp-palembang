/**
 * Grade Calculation Utilities
 * 
 * Two formulas based on SKS type:
 * - With Praktek: NAK = (NT*10%) + (NP*20%) + (NUTS*20%) + (NUAS*50%)
 * - Without Praktek: NAK = (NT*10%) + (NUTS*30%) + (NUAS*60%)
 */

// Grade conversion table
const GRADE_TABLE = [
    { min: 80.01, max: 100, huruf: 'A', bobot: 4.00, predikat: 'Sangat Baik' },
    { min: 75.01, max: 80, huruf: 'AB', bobot: 3.50, predikat: 'Lebih Dari Baik' },
    { min: 69.01, max: 75, huruf: 'B', bobot: 3.00, predikat: 'Baik' },
    { min: 60.01, max: 69, huruf: 'BC', bobot: 2.50, predikat: 'Lebih Dari Cukup' },
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
        // With Praktek: (NT*10%) + (NP*20%) + (NUTS*20%) + (NUAS*50%)
        nak = (nilaiTugas * 0.10) + (nilaiPraktek * 0.20) + (nilaiUTS * 0.20) + (nilaiUAS * 0.50)
    } else {
        // Without Praktek: (NT*10%) + (NUTS*30%) + (NUAS*60%)
        nak = (nilaiTugas * 0.10) + (nilaiUTS * 0.30) + (nilaiUAS * 0.60)
    }

    return Math.round(nak * 100) / 100 // Round to 2 decimal places
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
        return 'NAK = (NT×10%) + (NP×20%) + (UTS×20%) + (UAS×50%)'
    }
    return 'NAK = (NT×10%) + (UTS×30%) + (UAS×60%)'
}

export { GRADE_TABLE }
