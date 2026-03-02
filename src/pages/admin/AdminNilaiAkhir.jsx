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
    const [search, setSearch] = useState('')
    const [expandedMatkul, setExpandedMatkul] = useState(null)

    // Data: { matkulId: { matkulInfo, dosenInfo, students: [...] } }
    const [gradeGroups, setGradeGroups] = useState([])
    const [dosenList, setDosenList] = useState([])
    const [matkulList, setMatkulList] = useState([])

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

                // Load ALL hasil ujian (not filtered by dosen)
                const results = await hasilUjianService.getAll()
                console.log('[AdminNilaiAkhir] Loaded results:', results?.length)

                // Log first result structure for debugging
                if (results?.length > 0) {
                    const r0 = results[0]
                    console.log('[AdminNilaiAkhir] First result sample:', {
                        id: r0.id,
                        jadwal: r0.jadwal ? { id: r0.jadwal.id, tipe: r0.jadwal.tipe, matkul: r0.jadwal.matkul, dosen: r0.jadwal.dosen } : null,
                        mahasiswa: r0.mahasiswa ? { id: r0.mahasiswa.id, nama: r0.mahasiswa.nama } : null,
                        nilai_total: r0.nilai_total,
                        nilai_tugas: r0.nilai_tugas,
                        nilai_praktek: r0.nilai_praktek
                    })
                }

                // Group by matkul + dosen combination
                const groups = {}
                const dosenMap = new Map()
                const matkulMap = new Map()

                results?.forEach((r, idx) => {
                    try {
                        const jadwal = r.jadwal || {}
                        const matkul = jadwal.matkul || {}
                        const dosen = jadwal.dosen || {}
                        const mahasiswa = r.mahasiswa || {}
                        const tipeUjian = jadwal.tipe

                        // Skip only if no matkul info at all
                        if (!matkul.id) {
                            console.log('[AdminNilaiAkhir] Skipping result #' + idx + ' - no matkul:', r.id)
                            return
                        }

                        // Filter by prodi if admin_prodi (skip filter if matkul has no prodi_id)
                        if (user?.role === 'admin_prodi' && user.prodi_id && matkul.prodi_id && String(matkul.prodi_id) !== String(user.prodi_id)) {
                            console.log('[AdminNilaiAkhir] Skipping result #' + idx + ' - prodi mismatch:', matkul.prodi_id, '!=', user.prodi_id)
                            return
                        }

                        // Use dosen info even if partial
                        const dosenId = dosen.id || jadwal.dosen_id || 'unknown'
                        const dosenNama = dosen.nama || 'Dosen'
                        const dosenNip = dosen.nim_nip || ''

                        // Track dosen and matkul for filters
                        if (dosen.id && !dosenMap.has(dosen.id)) dosenMap.set(dosen.id, dosen)
                        if (!matkulMap.has(matkul.id)) matkulMap.set(matkul.id, matkul)

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

                        const mahasiswaId = r.mahasiswa_id
                        if (!mahasiswaId) return

                        if (!groups[groupKey].students[mahasiswaId]) {
                            groups[groupKey].students[mahasiswaId] = {
                                id: mahasiswaId,
                                nim: mahasiswa.nim_nip || '-',
                                name: mahasiswa.nama || 'Unknown',
                                nt: r.nilai_tugas ?? null,
                                nuts: null,
                                np: r.nilai_praktek ?? null,
                                uas: null
                            }
                        }

                        // Update UTS or UAS score
                        const dbScore = Number(r.nilai_total || 0)
                        if (tipeUjian === 'UTS') {
                            groups[groupKey].students[mahasiswaId].nuts = dbScore
                        } else if (tipeUjian === 'UAS') {
                            groups[groupKey].students[mahasiswaId].uas = dbScore
                        }

                        // Update NT/NP from DB if available
                        if (r.nilai_tugas != null) {
                            groups[groupKey].students[mahasiswaId].nt = r.nilai_tugas
                        }
                        if (r.nilai_praktek != null) {
                            groups[groupKey].students[mahasiswaId].np = r.nilai_praktek
                        }
                    } catch (itemError) {
                        console.error('[AdminNilaiAkhir] Error processing result #' + idx + ':', itemError)
                    }
                })

                console.log('[AdminNilaiAkhir] Groups formed:', Object.keys(groups).length, 'user.prodi_id:', user?.prodi_id, 'user.role:', user?.role)

                // Convert students objects to arrays
                const groupArray = Object.values(groups).map(g => ({
                    ...g,
                    students: Object.values(g.students)
                }))

                console.log('[AdminNilaiAkhir] Setting gradeGroups:', groupArray.length)
                setGradeGroups(groupArray)
                setDosenList(Array.from(dosenMap.values()))
                setMatkulList(Array.from(matkulMap.values()))

            } catch (error) {
                console.error('[AdminNilaiAkhir] Error:', error)
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [user])

    // Get Ka.Prodi info
    const getKaprodiInfo = () => {
        const prodi = prodiList.find(p => String(p.id) === String(user?.prodi_id))
        return {
            nama: prodi?.ketua_prodi_nama || '',
            nip: prodi?.ketua_prodi_nip || ''
        }
    }

    // Filter groups
    const filteredGroups = gradeGroups.filter(g => {
        const matchesDosen = dosenFilter === 'all' || String(g.dosenId) === String(dosenFilter)
        const matchesMatkul = matkulFilter === 'all' || String(g.matkulId) === String(matkulFilter)
        return matchesDosen && matchesMatkul
    })

    // Print single matkul+dosen group
    const handlePrintGroup = (group) => {
        const kaprodiInfo = getKaprodiInfo()
        const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

        const studentsFiltered = group.students.filter(s =>
            s.name.toLowerCase().includes(search.toLowerCase()) || s.nim.includes(search)
        )

        const printWindow = window.open('', '_blank')
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Nilai Akhir - ${group.matkulNama}</title>
                <style>
                    @page { size: A4 portrait; margin: 15mm; }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Times New Roman', serif; font-size: 11pt; padding: 15px; }
                    .letterhead { display: flex; align-items: center; gap: 15px; border-bottom: 3px solid #000; padding-bottom: 12px; margin-bottom: 15px; }
                    .letterhead-logo { flex-shrink: 0; }
                    .letterhead-logo img { height: 70px; width: auto; }
                    .letterhead-text { flex: 1; text-align: center; }
                    .letterhead-text h2 { font-size: 14pt; font-weight: bold; margin: 3px 0; text-transform: uppercase; }
                    .letterhead-text .contact { font-size: 9pt; margin-top: 3px; }
                    .doc-title { text-align: center; margin: 20px 0; font-size: 14pt; font-weight: bold; text-decoration: underline; }
                    .info-row { margin-bottom: 3px; font-size: 10pt; }
                    .info-label { display: inline-block; width: 140px; }
                    table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10pt; }
                    th, td { border: 1px solid #000; padding: 5px 8px; text-align: center; }
                    th { background: #f0f0f0; font-weight: bold; }
                    td.left { text-align: left; }
                    .signatures { display: flex; justify-content: space-between; margin-top: 40px; font-size: 10pt; }
                    .signature-box { text-align: center; width: 220px; }
                    .signature-box .title { font-weight: normal; margin-bottom: 5px; line-height: 1.4; }
                    .signature-box .space { height: 60px; }
                    .signature-box .name { font-weight: bold; text-decoration: underline; }
                    .signature-box .nip { font-size: 9pt; }
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
            const students = group.students
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
                    @page { size: A4 portrait; margin: 15mm; }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Times New Roman', serif; font-size: 11pt; padding: 15px; }
                    .letterhead { display: flex; align-items: center; gap: 15px; border-bottom: 3px solid #000; padding-bottom: 12px; margin-bottom: 15px; }
                    .letterhead-logo { flex-shrink: 0; }
                    .letterhead-logo img { height: 70px; width: auto; }
                    .letterhead-text { flex: 1; text-align: center; }
                    .letterhead-text h2 { font-size: 14pt; font-weight: bold; margin: 3px 0; text-transform: uppercase; }
                    .letterhead-text .contact { font-size: 9pt; margin-top: 3px; }
                    .doc-title { text-align: center; margin: 20px 0; font-size: 14pt; font-weight: bold; text-decoration: underline; }
                    .info-row { margin-bottom: 3px; font-size: 10pt; }
                    .info-label { display: inline-block; width: 140px; }
                    table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10pt; }
                    th, td { border: 1px solid #000; padding: 5px 8px; text-align: center; }
                    th { background: #f0f0f0; font-weight: bold; }
                    td.left { text-align: left; }
                    .signatures { display: flex; justify-content: space-between; margin-top: 40px; font-size: 10pt; }
                    .signature-box { text-align: center; width: 220px; }
                    .signature-box .title { font-weight: normal; margin-bottom: 5px; line-height: 1.4; }
                    .signature-box .space { height: 60px; }
                    .signature-box .name { font-weight: bold; text-decoration: underline; }
                    .signature-box .nip { font-size: 9pt; }
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
        const rows = [['No', 'Mata Kuliah', 'Kode', 'Dosen', 'NIM', 'Nama', 'NT', 'NUTS', 'NP', 'UAS', 'NAK', 'NH', 'Score']]
        let counter = 1
        filteredGroups.forEach(g => {
            g.students.forEach(s => {
                const nak = calculateNAK(s, g.hasPraktek)
                const nh = getNilaiHuruf(nak)
                const score = getScoreAkhir(nak)
                rows.push([
                    counter++,
                    g.matkulNama,
                    g.matkulKode,
                    g.dosenNama,
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
                        const studentsFiltered = group.students.filter(s =>
                            s.name.toLowerCase().includes(search.toLowerCase()) || s.nim.includes(search)
                        )

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
                                            Dosen: {group.dosenNama} | {group.students.length} mahasiswa
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
            `}</style>
        </DashboardLayout>
    )
}

export default AdminNilaiAkhirPage
