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

    if (month >= 8 || month === 1) return `${year}/${year + 1} Ganjil`
    return `${year - 1}/${year} Genap`
}

const GLOBAL_ACADEMIC_YEAR_ROLES = new Set(['superadmin', 'admin', 'admin_prodi'])

export function getActiveAcademicYear(settings, user) {
    if (GLOBAL_ACADEMIC_YEAR_ROLES.has(user?.role)) {
        return settings?.tahunAkademik || user?.tahunAkademik || ''
    }

    return user?.tahunAkademik || settings?.tahunAkademik || ''
}
