import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useSettings } from '../../contexts/SettingsContext'
import { exportArrayToXLSX } from '../../utils/excelUtils'
import { hasilUjianService, prodiService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    Award,
    Search,
    Filter,
    Info,
    FileSpreadsheet,
    BookOpen,
    Printer,
    ChevronDown,
    ChevronUp,
    Users
} from 'lucide-react'
import '../admin/Dashboard.css'

// Grade calculation helper functions
const calculateNAK = (student, hasPraktek) => {
    if (hasPraktek) {
        const nt = Number(student.nt ?? 0)
        const nuts = Number(student.nuts ?? 0)
        const np = Number(student.np ?? 0)
        const uas = Number(student.uas ?? 0)
        return (nt * 0.1) + (nuts * 0.2) + (np * 0.2) + (uas * 0.5)
    } else {
        const nt = Number(student.nt ?? 0)
        const nuts = Number(student.nuts ?? 0)
        const uas = Number(student.uas ?? 0)
        return (nt * 0.1) + (nuts * 0.3) + (uas * 0.6)
    }
}

const getNilaiHuruf = (nak) => {
    if (isNaN(nak)) return '-'
    if (nak > 80) return 'A'
    if (nak > 75) return 'AB'
    if (nak > 69) return 'B'
    if (nak > 60) return 'BC'
    if (nak > 55) return 'C'
    if (nak > 44) return 'D'
    return 'E'
}

const getScoreAkhir = (nak) => {
    if (isNaN(nak)) return 0
    if (nak > 80) return 4.0
    if (nak > 75) return 3.5
    if (nak > 69) return 3.0
    if (nak > 60) return 2.5
    if (nak > 55) return 2.0
    if (nak > 44) return 1.0
    return 0
}

const getGradeColor = (nh) => {
    if (['A', 'AB'].includes(nh)) return 'success'
    if (['B', 'BC'].includes(nh)) return 'warning'
    if (['C'].includes(nh)) return 'info'
    return 'error'
}

function AdminNilaiAkhirPage() {
    const { user } = useAuth()
    const { settings } = useSettings()
    const [loading, setLoading] = useState(true)
    const [prodiList, setProdiList] = useState([])
    const [dosenFilter, setDosenFilter] = useState('all')
    const [matkulFilter, setMatkulFilter] = useState('all')
    const [kelasFilter, setKelasFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [expandedMatkul, setExpandedMatkul] = useState(null)

    // Data: { matkulId: { matkulInfo, dosenInfo, students: [...] } }
    const [gradeGroups, setGradeGroups] = useState([])
    const [dosenList, setDosenList] = useState([])
    const [matkulList, setMatkulList] = useState([])
    const [kelasList, setKelasList] = useState([])

    useEffect(() => {
        const loadData = async () => {
            if (!isSupabaseConfigured()) {
                setLoading(false)
                return
            }

            setLoading(true)
            try {
                // Load prodi for Ka.Prodi info
                const prodiData = await prodiService.getAll()
                setProdiList(prodiData || [])

                // 1. Load all schedules (jadwal_ujian)
                const allJadwal = await jadwalService.getAll()
                console.log('[AdminNilaiAkhir] Loaded schedules:', allJadwal?.length)

                const currentTA = settings?.tahunAkademik
                const filteredJadwal = allJadwal.filter(j => {
                    // Filter by tahun_akademik
                    if (currentTA && j.tahun_akademik !== currentTA) return false
                    
                    // Filter by prodi if admin_prodi
                    if (user?.role === 'admin_prodi' && user.prodi_id) {
                        const matkulProdi = j.matkul?.prodi_id
                        if (matkulProdi && String(matkulProdi) !== String(user.prodi_id)) return false
                    }
                    return true
                })

                // 2. Load all students (mahasiswa) for classes
                let activeStudents = []
                if (user?.role === 'admin_prodi' && user.prodi_id) {
                    activeStudents = await userService.getAll({ role: 'mahasiswa', prodi_id: user.prodi_id })
                } else {
                    activeStudents = await userService.getAll({ role: 'mahasiswa' })
                }
                console.log('[AdminNilaiAkhir] Loaded active students:', activeStudents?.length)

                // 3. Load hasil ujian filtered by matkul_prodi_id if admin_prodi
                const filter = user?.role === 'admin_prodi' && user?.prodi_id ? { matkul_prodi_id: user.prodi_id } : {}
                const results = await hasilUjianService.getAll(filter)
                console.log('[AdminNilaiAkhir] Loaded results:', results?.length)

                // Group by matkul + dosen combination
                const groups = {}
                const dosenMap = new Map()
                const matkulMap = new Map()
                const kelasMap = new Map()

                // First, pre-populate all scheduled matkul + dosen groups & their students
                filteredJadwal.forEach(j => {
                    const matkul = j.matkul || {}
                    const dosen = j.dosen || {}
                    const kelas = j.kelas || {}

                    if (!matkul.id) return

                    const dosenId = dosen.id || j.dosen_id || 'unknown'
                    const dosenNama = dosen.nama || (dosenId !== 'unknown' ? 'Dosen' : 'Belum Ditentukan')
                    const dosenNip = dosen.nim_nip || ''

                    // Track dosen and matkul for filters
                    if (dosenId !== 'unknown' && !dosenMap.has(dosenId)) {
                        dosenMap.set(dosenId, { id: dosenId, nama: dosenNama, nim_nip: dosenNip })
                    }
                    if (!matkulMap.has(matkul.id)) matkulMap.set(matkul.id, matkul)

                    // Track classes for filters
                    if (kelas.id) {
                        kelasMap.set(kelas.id, kelas.nama)
                    }

                    const groupKey = `${matkul.id}_${dosenId}`

                    if (!groups[groupKey]) {
                        groups[groupKey] = {
                            matkulId: matkul.id,
                            matkulNama: matkul.nama || 'N/A',
                            matkulKode: matkul.kode || '',
                            hasPraktek: (matkul.sks_praktek > 0) || (matkul.sksPraktek > 0),
                            dosenId: dosenId,
                            dosenNama: dosenNama,
                            dosenNip: dosenNip,
                            students: {}
                        }
                    }

                    // Pre-populate students of this class
                    if (kelas.id) {
                        const classStudents = activeStudents.filter(s => String(s.kelas_id) === String(kelas.id))
                        classStudents.forEach(s => {
                            if (!groups[groupKey].students[s.id]) {
                                groups[groupKey].students[s.id] = {
                                    id: s.id,
                                    nim: s.nim_nip || '-',
                                    name: s.nama || 'Unknown',
                                    kelasId: kelas.id || null,
                                    kelasNama: kelas.nama || '-',
                                    nt: null,
                                    nuts: null,
                                    np: null,
                                    uas: null
                                }
                            }
                        })
                    }
                })

                // Next, update grades from exam results (hasil_ujian)
                const sortedResults = results ? [...results].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)) : []

                sortedResults.forEach((r) => {
                    try {
                        const jadwal = r.jadwal || {}
                        const matkul = jadwal.matkul || {}
                        const dosen = jadwal.dosen || {}
                        const mahasiswa = r.mahasiswa || {}
                        const kelas = mahasiswa.kelas || {}
                        const tipeUjian = jadwal.tipe

                        // Skip only if no matkul info at all
                        if (!matkul.id) return

                        const dosenId = dosen.id || jadwal.dosen_id || 'unknown'
                        const groupKey = `${matkul.id}_${dosenId}`

                        // Fallback group creation if not in schedules
                        if (!groups[groupKey]) {
                            const dosenNama = dosen.nama || (dosenId !== 'unknown' ? 'Dosen' : 'Belum Ditentukan')
                            const dosenNip = dosen.nim_nip || ''
                            
                            if (dosenId !== 'unknown' && !dosenMap.has(dosenId)) {
                                dosenMap.set(dosenId, { id: dosenId, nama: dosenNama, nim_nip: dosenNip })
                            }
                            if (!matkulMap.has(matkul.id)) matkulMap.set(matkul.id, matkul)
                            if (kelas.id) {
                                kelasMap.set(kelas.id, kelas.nama)
                            }

                            groups[groupKey] = {
                                matkulId: matkul.id,
                                matkulNama: matkul.nama || 'N/A',
                                matkulKode: matkul.kode || '',
                                hasPraktek: (matkul.sks_praktek > 0) || (matkul.sksPraktek > 0),
                                dosenId: dosenId,
                                dosenNama: dosenNama,
                                dosenNip: dosenNip,
                                students: {}
                            }
                        }

                        const mahasiswaId = r.mahasiswa_id
                        if (!mahasiswaId) return

                        if (!groups[groupKey].students[mahasiswaId]) {
                            groups[groupKey].students[mahasiswaId] = {
                                id: mahasiswaId,
                                nim: mahasiswa.nim_nip || '-',
                                name: mahasiswa.nama || 'Unknown',
                                kelasId: kelas.id || null,
                                kelasNama: kelas.nama || '-',
                                nt: r.nilai_tugas ?? null,
                                nuts: r.nilai_uts ?? null,
                                np: r.nilai_praktek ?? null,
                                uas: r.nilai_uas ?? null
                            }
                        }

                        const studentEntry = groups[groupKey].students[mahasiswaId]

                        // Update UTS or UAS score from exam results (nilai_total)
                        const dbScore = r.nilai_total != null ? Number(r.nilai_total) : null
                        if (dbScore != null) {
                            if (tipeUjian === 'UTS') {
                                studentEntry.nuts = dbScore
                            } else if (tipeUjian === 'UAS') {
                                studentEntry.uas = dbScore
                            }
                        }

                        // Update NT/NP from DB if available
                        if (r.nilai_tugas != null) {
                            studentEntry.nt = r.nilai_tugas
                        }
                        if (r.nilai_praktek != null) {
                            studentEntry.np = r.nilai_praktek
                        }
                    } catch (itemError) {
                        console.error('[AdminNilaiAkhir] Error processing result:', itemError)
                    }
                })

                console.log('[AdminNilaiAkhir] Groups formed:', Object.keys(groups).length)

                // Convert students objects to arrays
                const groupArray = Object.values(groups).map(g => ({
                    ...g,
                    students: Object.values(g.students)
                }))

                console.log('[AdminNilaiAkhir] Setting gradeGroups:', groupArray.length)
                setGradeGroups(groupArray)
                setDosenList(Array.from(dosenMap.values()))
                setMatkulList(Array.from(matkulMap.values()))
                setKelasList(Array.from(kelasMap.entries()).map(([id, nama]) => ({ id, nama })).sort((a, b) => a.nama.localeCompare(b.nama)))

            } catch (error) {
                console.error('[AdminNilaiAkhir] Error:', error)
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [user, settings])

    // Get Ka.Prodi info
    const getKaprodiInfo = () => {
        const prodi = prodiList.find(p => String(p.id) === String(user?.prodi_id))
        return {
            nama: prodi?.ketua_prodi_nama || '',
            nip: prodi?.ketua_prodi_nip || ''
        }
    }

    // Filter groups
    const filteredGroups = gradeGroups.map(g => {
        const studentsFiltered = g.students.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.nim.includes(search)
            const matchesKelas = kelasFilter === 'all' || String(s.kelasId) === String(kelasFilter)
            return matchesSearch && matchesKelas
        })
        return {
            ...g,
            studentsFiltered
        }
    }).filter(g => {
        const matchesDosen = dosenFilter === 'all' || String(g.dosenId) === String(dosenFilter)
        const matchesMatkul = matkulFilter === 'all' || String(g.matkulId) === String(matkulFilter)
        return matchesDosen && matchesMatkul && g.studentsFiltered.length > 0
    })

    // Print single matkul+dosen group
    const handlePrintGroup = (group) => {
        const kaprodiInfo = getKaprodiInfo()
        const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

        const studentsFiltered = group.studentsFiltered || group.students.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.nim.includes(search)
            const matchesKelas = kelasFilter === 'all' || String(s.kelasId) === String(kelasFilter)
            return matchesSearch && matchesKelas
        })

        const printWindow = window.open('', '_blank')
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Nilai Akhir - ${group.matkulNama}</title>
                <style>
                    @page { size: A4 portrait; margin: 8mm 12mm 6mm; }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Times New Roman', serif; font-size: 9.5pt; padding: 0; line-height: 1.35; }
                    .letterhead { display: flex; align-items: center; gap: 12px; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 10px; }
                    .letterhead-logo { flex-shrink: 0; }
                    .letterhead-logo img { height: 55px; width: auto; }
                    .letterhead-text { flex: 1; text-align: center; }
                    .letterhead-text h2 { font-size: 12.5pt; font-weight: bold; margin: 2px 0; text-transform: uppercase; }
                    .letterhead-text .contact { font-size: 8.5pt; margin-top: 2px; }
                    .doc-title { text-align: center; margin: 10px 0 5px; font-size: 12.5pt; font-weight: bold; text-decoration: underline; }
                    .info-row { margin-bottom: 2px; font-size: 9.5pt; }
                    .info-label { display: inline-block; width: 140px; }
                    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9.5pt; }
                    th, td { border: 1px solid #000; padding: 3px 5px; text-align: center; }
                    th { background: #f0f0f0; font-weight: bold; }
                    td.left { text-align: left; }
                    .signatures { display: flex; justify-content: space-between; margin-top: 20px; font-size: 9.5pt; page-break-inside: avoid; }
                    .signature-box { text-align: center; width: 220px; }
                    .signature-box .title { font-weight: normal; margin-bottom: 5px; line-height: 1.3; }
                    .signature-box .space { height: 45px; }
                    .signature-box .name { font-weight: bold; text-decoration: underline; }
                    .signature-box .nip { font-size: 8.5pt; }
                </style>
            </head>
            <body>
                <div class="letterhead">
                    <div class="letterhead-logo">
                        ${settings?.logoUrl ? `<img src="${settings.logoUrl}" alt="Logo" />` : '<div style="width:70px;height:70px;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:8pt;color:#999;">LOGO</div>'}
                    </div>
                    <div class="letterhead-text">
                        <h2>${settings?.institution || 'POLITEKNIK TRANSPORTASI SUNGAI, DANAU DAN PENYEBERANGAN PALEMBANG'}</h2>
                        <div class="contact">
                            ${settings?.address || 'Jl. Residen Abdul Rozak, Palembang'} |
                            Telp: ${settings?.phone || '(0711) 712345'} |
                            Email: ${settings?.email || 'info@poltektrans.ac.id'}
                        </div>
                    </div>
                </div>

                <div class="doc-title">DAFTAR NILAI AKHIR SEMESTER</div>
                <p style="text-align:center; margin-bottom:15px;">Tahun Akademik ${settings?.tahunAkademik || '2025/2026'}</p>

                <div class="info-row"><span class="info-label">Mata Kuliah</span>: ${group.matkulNama} (${group.matkulKode})</div>
                <div class="info-row"><span class="info-label">Dosen Pengampu</span>: ${group.dosenNama}</div>
                ${kelasFilter !== 'all' ? `<div class="info-row"><span class="info-label">Kelas</span>: ${kelasList.find(k => String(k.id) === String(kelasFilter))?.nama || ''}</div>` : ''}
                <div class="info-row"><span class="info-label">Rumus Nilai</span>: ${group.hasPraktek ? 'NT(10%) + NUTS(20%) + NP(20%) + UAS(50%)' : 'NT(10%) + NUTS(30%) + UAS(60%)'}</div>

                <table>
                    <thead>
                        <tr>
                            <th style="width:30px">No</th>
                            <th class="left">Nama Mahasiswa</th>
                            <th>NIM</th>
                            <th>NT<br/><small>10%</small></th>
                            <th>NUTS<br/><small>${group.hasPraktek ? '20%' : '30%'}</small></th>
                            ${group.hasPraktek ? '<th>NP<br/><small>20%</small></th>' : ''}
                            <th>UAS<br/><small>${group.hasPraktek ? '50%' : '60%'}</small></th>
                            <th>NAK</th>
                            <th>NH</th>
                            <th>Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${studentsFiltered.map((s, idx) => {
            const nak = calculateNAK(s, group.hasPraktek)
            const nh = getNilaiHuruf(nak)
            const score = getScoreAkhir(nak)
            return `
                                <tr>
                                    <td>${idx + 1}</td>
                                    <td class="left">${s.name}</td>
                                    <td>${s.nim}</td>
                                    <td>${s.nt ?? '-'}</td>
                                    <td>${s.nuts ?? '-'}</td>
                                    ${group.hasPraktek ? `<td>${s.np ?? '-'}</td>` : ''}
                                    <td>${s.uas ?? '-'}</td>
                                    <td><strong>${isNaN(nak) ? '-' : nak.toFixed(1)}</strong></td>
                                    <td><strong>${isNaN(nak) ? '-' : nh}</strong></td>
                                    <td>${isNaN(nak) ? '-' : score}</td>
                                </tr>
                            `
        }).join('')}
                    </tbody>
                </table>

                <div class="signatures">
                    <div class="signature-box">
                        <div class="title">Mengetahui,<br/>Ka. Program Studi</div>
                        <div class="space"></div>
                        <div class="name">${kaprodiInfo.nama || '................................'}</div>
                        <div class="nip">NIP. ${kaprodiInfo.nip || '..............................'}</div>
                    </div>
                    <div class="signature-box">
                        <div class="title">Palembang, ${today}<br/>Dosen Pengampu</div>
                        <div class="space"></div>
                        <div class="name">${group.dosenNama}</div>
                        <div class="nip">NIP. ${group.dosenNip || '..............................'}</div>
                    </div>
                </div>
            </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.print()
    }

    // Print ALL groups collectively
    const handlePrintAll = () => {
        if (filteredGroups.length === 0) return
        const kaprodiInfo = getKaprodiInfo()
        const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

        const allPages = filteredGroups.map((group, gIdx) => {
            const students = group.studentsFiltered || group.students
            return `
                <div class="letterhead">
                    <div class="letterhead-logo">
                        ${settings?.logoUrl ? `<img src="${settings.logoUrl}" alt="Logo" />` : '<div style="width:70px;height:70px;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:8pt;color:#999;">LOGO</div>'}
                    </div>
                    <div class="letterhead-text">
                        <h2>${settings?.institution || 'POLITEKNIK TRANSPORTASI SUNGAI, DANAU DAN PENYEBERANGAN PALEMBANG'}</h2>
                        <div class="contact">
                            ${settings?.address || 'Jl. Residen Abdul Rozak, Palembang'} |
                            Telp: ${settings?.phone || '(0711) 712345'} |
                            Email: ${settings?.email || 'info@poltektrans.ac.id'}
                        </div>
                    </div>
                </div>

                <div class="doc-title">DAFTAR NILAI AKHIR SEMESTER</div>
                <p style="text-align:center; margin-bottom:15px;">Tahun Akademik ${settings?.tahunAkademik || '2025/2026'}</p>

                <div class="info-row"><span class="info-label">Mata Kuliah</span>: ${group.matkulNama} (${group.matkulKode})</div>
                <div class="info-row"><span class="info-label">Dosen Pengampu</span>: ${group.dosenNama}</div>
                ${kelasFilter !== 'all' ? `<div class="info-row"><span class="info-label">Kelas</span>: ${kelasList.find(k => String(k.id) === String(kelasFilter))?.nama || ''}</div>` : ''}

                <table>
                    <thead>
                        <tr>
                            <th style="width:30px">No</th>
                            <th class="left">Nama Mahasiswa</th>
                            <th>NIM</th>
                            <th>NT<br/><small>10%</small></th>
                            <th>NUTS<br/><small>${group.hasPraktek ? '20%' : '30%'}</small></th>
                            ${group.hasPraktek ? '<th>NP<br/><small>20%</small></th>' : ''}
                            <th>UAS<br/><small>${group.hasPraktek ? '50%' : '60%'}</small></th>
                            <th>NAK</th>
                            <th>NH</th>
                            <th>Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${students.map((s, idx) => {
                const nak = calculateNAK(s, group.hasPraktek)
                const nh = getNilaiHuruf(nak)
                const score = getScoreAkhir(nak)
                return `
                                <tr>
                                    <td>${idx + 1}</td>
                                    <td class="left">${s.name}</td>
                                    <td>${s.nim}</td>
                                    <td>${s.nt ?? '-'}</td>
                                    <td>${s.nuts ?? '-'}</td>
                                    ${group.hasPraktek ? `<td>${s.np ?? '-'}</td>` : ''}
                                    <td>${s.uas ?? '-'}</td>
                                    <td><strong>${isNaN(nak) ? '-' : nak.toFixed(1)}</strong></td>
                                    <td><strong>${isNaN(nak) ? '-' : nh}</strong></td>
                                    <td>${isNaN(nak) ? '-' : score}</td>
                                </tr>
                            `
            }).join('')}
                    </tbody>
                </table>

                <div class="signatures">
                    <div class="signature-box">
                        <div class="title">Mengetahui,<br/>Ka. Program Studi</div>
                        <div class="space"></div>
                        <div class="name">${kaprodiInfo.nama || '................................'}</div>
                        <div class="nip">NIP. ${kaprodiInfo.nip || '..............................'}</div>
                    </div>
                    <div class="signature-box">
                        <div class="title">Palembang, ${today}<br/>Dosen Pengampu</div>
                        <div class="space"></div>
                        <div class="name">${group.dosenNama}</div>
                        <div class="nip">NIP. ${group.dosenNip || '..............................'}</div>
                    </div>
                </div>
                ${gIdx < filteredGroups.length - 1 ? '<div style="page-break-after: always;"></div>' : ''}
            `
        }).join('')

        const printWindow = window.open('', '_blank')
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Nilai Akhir Kolektif - ${filteredGroups.length} Mata Kuliah</title>
                <style>
                    @page { size: A4 portrait; margin: 8mm 12mm 6mm; }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Times New Roman', serif; font-size: 9.5pt; padding: 0; line-height: 1.35; }
                    .letterhead { display: flex; align-items: center; gap: 12px; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 10px; }
                    .letterhead-logo { flex-shrink: 0; }
                    .letterhead-logo img { height: 55px; width: auto; }
                    .letterhead-text { flex: 1; text-align: center; }
                    .letterhead-text h2 { font-size: 12.5pt; font-weight: bold; margin: 2px 0; text-transform: uppercase; }
                    .letterhead-text .contact { font-size: 8.5pt; margin-top: 2px; }
                    .doc-title { text-align: center; margin: 10px 0 5px; font-size: 12.5pt; font-weight: bold; text-decoration: underline; }
                    .info-row { margin-bottom: 2px; font-size: 9.5pt; }
                    .info-label { display: inline-block; width: 140px; }
                    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9.5pt; }
                    th, td { border: 1px solid #000; padding: 3px 5px; text-align: center; }
                    th { background: #f0f0f0; font-weight: bold; }
                    td.left { text-align: left; }
                    .signatures { display: flex; justify-content: space-between; margin-top: 20px; font-size: 9.5pt; page-break-inside: avoid; }
                    .signature-box { text-align: center; width: 220px; }
                    .signature-box .title { font-weight: normal; margin-bottom: 5px; line-height: 1.3; }
                    .signature-box .space { height: 45px; }
                    .signature-box .name { font-weight: bold; text-decoration: underline; }
                    .signature-box .nip { font-size: 8.5pt; }
                </style>
            </head>
            <body>
                ${allPages}
            </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.print()
    }

    // Export excel
    const handleExportExcel = () => {
        if (filteredGroups.length === 0) return
        const rows = [['No', 'Mata Kuliah', 'Kode', 'Dosen', 'Kelas', 'NIM', 'Nama', 'NT', 'NUTS', 'NP', 'UAS', 'NAK', 'NH', 'Score']]
        let counter = 1
        filteredGroups.forEach(g => {
            const students = g.studentsFiltered || g.students
            students.forEach(s => {
                const nak = calculateNAK(s, g.hasPraktek)
                const nh = getNilaiHuruf(nak)
                const score = getScoreAkhir(nak)
                rows.push([
                    counter++,
                    g.matkulNama,
                    g.matkulKode,
                    g.dosenNama,
                    s.kelasNama || '-',
                    s.nim,
                    s.name,
                    s.nt ?? '-',
                    s.nuts ?? '-',
                    s.np ?? '-',
                    s.uas ?? '-',
                    isNaN(nak) ? '-' : nak.toFixed(1),
                    isNaN(nak) ? '-' : nh,
                    isNaN(nak) ? '-' : score
                ])
            })
        })
        exportArrayToXLSX(rows, `nilai_akhir_all_${new Date().toISOString().split('T')[0]}`, 'Nilai Akhir')
    }

    if (loading) {
        return (
            <DashboardLayout>
                <div className="dashboard-page animate-fadeIn">
                    <div className="page-header">
                        <div>
                            <h1 className="page-title">Nilai Akhir Semester</h1>
                            <p className="page-subtitle">Rekap nilai akhir seluruh dosen</p>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-body text-center" style={{ padding: '64px 32px' }}>
                            <BookOpen size={64} style={{ marginBottom: '16px', opacity: 0.4, color: 'var(--color-text-muted)' }} />
                            <h3>Memuat Data...</h3>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    const totalStudents = filteredGroups.reduce((sum, g) => sum + g.students.length, 0)

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Nilai Akhir Semester</h1>
                        <p className="page-subtitle">Rekap nilai akhir seluruh dosen ({filteredGroups.length} mata kuliah, {totalStudents} mahasiswa)</p>
                    </div>
                    <div className="header-actions">
                        <button className="btn btn-primary" onClick={handleExportExcel} disabled={filteredGroups.length === 0}>
                            <FileSpreadsheet size={18} />
                            Export Excel
                        </button>
                        <button className="btn btn-secondary" onClick={handlePrintAll} disabled={filteredGroups.length === 0}
                            style={{ background: 'var(--color-primary)', color: 'white', border: 'none' }}>
                            <Printer size={18} />
                            Cetak Semua ({filteredGroups.length})
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="card mb-4">
                    <div className="card-body">
                        <div className="filters-row">
                            <div className="filter-group">
                                <label>Dosen</label>
                                <select className="form-select" value={dosenFilter} onChange={e => setDosenFilter(e.target.value)}>
                                    <option value="all">Semua Dosen</option>
                                    {dosenList.map(d => (
                                        <option key={d.id} value={d.id}>{d.nama}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="filter-group">
                                <label>Mata Kuliah</label>
                                <select className="form-select" value={matkulFilter} onChange={e => setMatkulFilter(e.target.value)}>
                                    <option value="all">Semua Mata Kuliah</option>
                                    {matkulList.map(m => (
                                        <option key={m.id} value={m.id}>{m.nama} ({m.kode})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="filter-group">
                                <label>Kelas</label>
                                <select className="form-select" value={kelasFilter} onChange={e => setKelasFilter(e.target.value)}>
                                    <option value="all">Semua Kelas</option>
                                    {kelasList.map(k => (
                                        <option key={k.id} value={k.id}>{k.nama}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="filter-group">
                                <label>Cari Mahasiswa</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                                    <Search size={16} />
                                    <input
                                        type="text"
                                        placeholder="Cari nama atau NIM..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%' }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bobot Info */}
                <div className="card mb-4 info-box">
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Info size={18} className="info-icon" />
                        <div>
                            <strong>Rumus Nilai:</strong>
                            <span style={{ marginLeft: '8px' }}>
                                Dengan Praktek: NT(10%) + NUTS(20%) + NP(20%) + UAS(50%) | Tanpa Praktek: NT(10%) + NUTS(30%) + UAS(60%)
                            </span>
                        </div>
                    </div>
                </div>

                {/* Grade Groups */}
                {filteredGroups.length === 0 ? (
                    <div className="card">
                        <div className="card-body text-center" style={{ padding: '48px' }}>
                            <Award size={48} style={{ opacity: 0.4, marginBottom: '16px', color: 'var(--color-text-muted)' }} />
                            <h4>Belum Ada Data Nilai</h4>
                            <p className="text-muted">Data nilai mahasiswa akan muncul setelah ujian selesai dikoreksi.</p>
                        </div>
                    </div>
                ) : (
                    filteredGroups.map((group) => {
                        const isExpanded = expandedMatkul === `${group.matkulId}_${group.dosenId}`
                        const studentsFiltered = group.studentsFiltered || group.students

                        return (
                            <div className="card mb-4" key={`${group.matkulId}_${group.dosenId}`}>
                                <div className="card-header"
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                                    onClick={() => setExpandedMatkul(isExpanded ? null : `${group.matkulId}_${group.dosenId}`)}
                                >
                                    <div>
                                        <h3 style={{ marginBottom: '4px' }}>{group.matkulNama} <small style={{ color: 'var(--color-text-muted)' }}>({group.matkulKode})</small></h3>
                                        <p className="text-muted" style={{ fontSize: '13px' }}>
                                            <Users size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                            Dosen: {group.dosenNama} | {studentsFiltered.length} mahasiswa
                                            {group.hasPraktek && ' | Praktek'}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); handlePrintGroup(group) }} title="Cetak">
                                            <Printer size={16} />
                                        </button>
                                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="card-body">
                                        <div style={{ overflowX: 'auto' }}>
                                            <table className="table">
                                                <thead>
                                                    <tr>
                                                        <th>No</th>
                                                        <th>Nama</th>
                                                        <th>NIM</th>
                                                        <th>Kelas</th>
                                                        <th className="text-center">NT<br /><small>10%</small></th>
                                                        <th className="text-center">NUTS<br /><small>{group.hasPraktek ? '20%' : '30%'}</small></th>
                                                        {group.hasPraktek && <th className="text-center">NP<br /><small>20%</small></th>}
                                                        <th className="text-center">UAS<br /><small>{group.hasPraktek ? '50%' : '60%'}</small></th>
                                                        <th className="text-center">NAK</th>
                                                        <th className="text-center">NH</th>
                                                        <th className="text-center">Score</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {studentsFiltered.map((student, index) => {
                                                        const nak = calculateNAK(student, group.hasPraktek)
                                                        const nh = getNilaiHuruf(nak)
                                                        const score = getScoreAkhir(nak)
                                                        return (
                                                            <tr key={student.id}>
                                                                <td>{index + 1}</td>
                                                                <td>{student.name}</td>
                                                                <td>{student.nim}</td>
                                                                <td>{student.kelasNama || '-'}</td>
                                                                <td className="text-center">{student.nt ?? <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                                                                <td className="text-center">{student.nuts ?? <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                                                                {group.hasPraktek && (
                                                                    <td className="text-center">{student.np ?? <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                                                                )}
                                                                <td className="text-center">{student.uas ?? <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                                                                <td className="text-center"><strong>{isNaN(nak) ? '-' : nak.toFixed(1)}</strong></td>
                                                                <td className="text-center">
                                                                    {isNaN(nak) ? '-' : <span className={`badge badge-${getGradeColor(nh)}`}>{nh}</span>}
                                                                </td>
                                                                <td className="text-center"><strong>{isNaN(nak) ? '-' : score}</strong></td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            <style>{`
                .mb-4 { margin-bottom: 16px; }
                .text-center { text-align: center; }
                .btn-sm { padding: 4px 8px; font-size: 12px; }
                .info-box {
                    background: var(--info-50);
                    border: 1px solid var(--info-200);
                }
                .info-box .card-body { color: var(--info-700); }
                .info-box .info-icon { color: var(--info-600); }
                .info-box strong { color: var(--info-800); }
                [data-theme="dark"] .info-box {
                    background: rgba(59, 130, 246, 0.1);
                    border-color: rgba(59, 130, 246, 0.3);
                }
                [data-theme="dark"] .info-box .card-body,
                [data-theme="dark"] .info-box strong,
                [data-theme="dark"] .info-box span { color: #93c5fd; }
                [data-theme="dark"] .info-box .info-icon { color: #60a5fa; }

                .filters-row {
                    display: flex;
                    gap: 16px;
                    margin-bottom: 16px;
                    flex-wrap: wrap;
                    align-items: flex-end;
                }
                .filter-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    min-width: 200px;
                    flex: 1;
                }
                .filter-group label {
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--color-text-muted);
                }
            `}</style>
        </DashboardLayout>
    )
}

export default AdminNilaiAkhirPage
