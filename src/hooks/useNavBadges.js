import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { useSettings } from '../contexts/SettingsContext'
import { getActiveAcademicYear } from '../utils/academicYear'
import { jadwalService } from '../services/supabaseService'
import { isExamActive, kelasIdOf } from '../utils/examWindow'

// Live counts shown as badges next to nav items.
// Returns a map keyed by route path, e.g. { '/mahasiswa/ujian': 1 }.
// Fail-silent: any error just yields no badge (never blocks navigation).
//
// Covered today:
//   mahasiswa -> '/mahasiswa/ujian'   : exams in progress for the student's class
//   pengawas  -> '/pengawas/monitor'  : exams in progress (to supervise) right now
// Roles without a live signal simply get an empty map.
const BADGE_ROLES = ['mahasiswa', 'pengawas']
const REFRESH_MS = 60 * 1000

export function useNavBadges() {
    const { user } = useAuth()
    const { settings } = useSettings()
    const [badges, setBadges] = useState({})
    const role = user?.role
    const tahunAkademik = getActiveAcademicYear(settings, user)
    const kelasId = kelasIdOf(user)

    useEffect(() => {
        let cancelled = false
        const isBadgeRole = !!role && BADGE_ROLES.includes(role)

        const compute = async () => {
            if (!isBadgeRole) {
                if (!cancelled) setBadges({})
                return
            }
            try {
                const jadwal = await jadwalService.getAll({ tahun_akademik: tahunAkademik }).catch(() => [])
                if (cancelled || !Array.isArray(jadwal)) return
                const now = new Date()
                const next = {}

                if (role === 'mahasiswa') {
                    const count = jadwal.filter(j =>
                        kelasIdOf(j) === kelasId && isExamActive(j, now)
                    ).length
                    if (count > 0) next['/mahasiswa/ujian'] = count
                } else if (role === 'pengawas') {
                    const count = jadwal.filter(j => isExamActive(j, now)).length
                    if (count > 0) next['/pengawas/monitor'] = count
                }

                if (!cancelled) setBadges(next)
            } catch {
                if (!cancelled) setBadges({})
            }
        }

        compute()
        if (!isBadgeRole) {
            return () => { cancelled = true }
        }
        const id = setInterval(compute, REFRESH_MS)
        const onFocus = () => compute()
        window.addEventListener('focus', onFocus)
        return () => {
            cancelled = true
            clearInterval(id)
            window.removeEventListener('focus', onFocus)
        }
    }, [role, kelasId, tahunAkademik])

    return badges
}
