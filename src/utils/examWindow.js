// Shared exam time-window helper.
// An exam is "active" (in progress right now) when `now` falls between its
// start and end. Handles cross-midnight exams (e.g. 23:30 - 00:30) the same
// way the dashboards do, so badges and dashboards never disagree.
export function isExamActive(jadwal, now = new Date()) {
    if (!jadwal) return false
    const tanggal = jadwal.tanggal || jadwal.exam_date
    const waktuMulai = jadwal.waktu_mulai || jadwal.waktuMulai
    const waktuSelesai = jadwal.waktu_selesai || jadwal.waktuSelesai
    if (!tanggal || !waktuMulai || !waktuSelesai) return false

    const examStart = new Date(`${tanggal}T${waktuMulai}`)
    let examEnd = new Date(`${tanggal}T${waktuSelesai}`)
    if (Number.isNaN(examStart.getTime()) || Number.isNaN(examEnd.getTime())) return false
    if (examEnd <= examStart) examEnd = new Date(examEnd.getTime() + 24 * 60 * 60 * 1000)

    return now >= examStart && now <= examEnd
}

// Kelas id of a jadwal / user, tolerating snake_case and camelCase shapes.
export function kelasIdOf(obj) {
    return obj?.kelas_id ?? obj?.kelasId ?? null
}
