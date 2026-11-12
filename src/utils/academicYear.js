export function generateAcademicYearOptions({ now = new Date(), yearsBack = 4, yearsForward = 1 } = {}) {
    const currentYear = now.getFullYear()
    const options = []

    for (let year = currentYear + yearsForward; year >= currentYear - yearsBack; year -= 1) {
        options.push(`${year}/${year + 1} Ganjil`, `${year}/${year + 1} Genap`)
    }

    return options
}

export function getCurrentAcademicYear(now = new Date()) {
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    // Ganjil runs August-January: January still belongs to the year that
    // started the previous August (Jan 2027 -> 2026/2027 Ganjil)
    if (month >= 8) return `${year}/${year + 1} Ganjil`
    if (month === 1) return `${year - 1}/${year} Ganjil`
    return `${year - 1}/${year} Genap`
}

const GLOBAL_ACADEMIC_YEAR_ROLES = new Set(['superadmin', 'admin', 'admin_prodi'])

export function getActiveAcademicYear(settings, user) {
    if (GLOBAL_ACADEMIC_YEAR_ROLES.has(user?.role)) {
        return settings?.tahunAkademik || user?.tahunAkademik || ''
    }

    return user?.tahunAkademik || settings?.tahunAkademik || ''
}

// "2026/2027 Ganjil" -> 'Ganjil', "... Genap" -> 'Genap'
export function getTerm(tahunAkademik) {
    const t = String(tahunAkademik || '').trim().toLowerCase()
    if (t.endsWith('ganjil')) return 'Ganjil'
    if (t.endsWith('genap')) return 'Genap'
    return null
}

// Courses are taught in odd semesters (1,3,5,7) in Ganjil and even ones in
// Genap. Courses without a semester, or an unknown term, always pass.
export function isMatkulInTerm(matkul, tahunAkademik) {
    const term = getTerm(tahunAkademik)
    const sem = Number(matkul?.semester)
    if (!term || !sem) return true
    return term === 'Ganjil' ? sem % 2 === 1 : sem % 2 === 0
}

// Course list for pickers in the active term. keepIds stay in the list even
// when off-term, so editing an existing record never loses its course.
export function filterMatkulByTerm(list = [], tahunAkademik, keepIds = []) {
    const keep = new Set((keepIds || []).filter(Boolean).map(String))
    return list.filter(m => keep.has(String(m.id)) || isMatkulInTerm(m, tahunAkademik))
}
