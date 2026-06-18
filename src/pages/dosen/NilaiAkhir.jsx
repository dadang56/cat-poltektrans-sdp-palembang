import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useSettings } from '../../contexts/SettingsContext'
import { exportArrayToXLSX } from '../../utils/excelUtils'
import { hasilUjianService, kelasService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    Award,
    Search,
    Download,
    Save,
    Filter,
    Edit2,
    Check,
    X,
    Info,
    RefreshCw,
    FileSpreadsheet,
    BookOpen,
    Printer
} from 'lucide-react'
import '../admin/Dashboard.css'

// Grade calculation helper functions
const calculateNAK = (student, hasPraktek) => {
    const nt = Number(student.nt) || 0
    const nuts = Number(student.nuts) || 0
    const np = Number(student.np) || 0
    const uas = Number(student.uas) || 0
    if (hasPraktek) {
        // NT 10% + NUTS 20% + NP 20% + UAS 50%
        return (nt * 0.1) + (nuts * 0.2) + (np * 0.2) + (uas * 0.5)
    } else {
        // NT 10% + NUTS 30% + UAS 60%
        return (nt * 0.1) + (nuts * 0.3) + (uas * 0.6)
    }
}

const getNilaiHuruf = (nak) => {
    if (nak > 80) return 'A'
    if (nak > 75) return 'AB'
    if (nak > 69) return 'B'
    if (nak > 60) return 'BC'
    if (nak > 55) return 'C'
    if (nak > 44) return 'D'
    return 'E'
}

const getScoreAkhir = (nak) => {
    if (nak > 80) return 4
    if (nak > 75) return 3.5
    if (nak > 69) return 3
    if (nak > 60) return 2.5
    if (nak > 55) return 2
    if (nak > 44) return 1
    return 0
}

const getGradeColor = (nh) => {
    switch (nh) {
        case 'A':
        case 'AB':
            return 'success'
        case 'B':
        case 'BC':
            return 'warning'
        case 'C':
            return 'info'
        default:
            return 'error'
    }
}

function NilaiAkhirPage() {
    const { user } = useAuth()
    const { settings } = useSettings()
    const [matkulList, setMatkulList] = useState([])
    const [selectedMatkul, setSelectedMatkul] = useState(null)
    const [grades, setGrades] = useState({})
    const [search, setSearch] = useState('')
    const [editingStudent, setEditingStudent] = useState(null)
    const [editValues, setEditValues] = useState({})
    const [saving, setSaving] = useState(false)
    const [kelasList, setKelasList] = useState([])
    const [kelasFilter, setKelasFilter] = useState('all')

    // Manual grade storage (in-memory fallback)
    const manualGrades = {}

    // Load matkul and exam results from Supabase
    useEffect(() => {
        const loadData = async () => {
            if (!user?.id) return

            try {
                // Load kelas list
                const kelasData = await kelasService.getAll()
                setKelasList(kelasData || [])

                // 1. Get all exam results for this lecturer
                const results = await hasilUjianService.getByDosen(user.id)
                console.log('NilaiAkhir results:', results)

                // 2. Extract unique matkuls from results
                const matkulMap = new Map()
                results.forEach(r => {
                    const m = r.jadwal?.matkul
                    if (m && !matkulMap.has(m.id)) {
                        matkulMap.set(m.id, {
                            ...m,
                            kelas_id: r.jadwal?.kelas_id || null
                        })
                    }
                })
                const uniqueMatkuls = Array.from(matkulMap.values())
                setMatkulList(uniqueMatkuls)

                // Set default selection
                if (uniqueMatkuls.length > 0 && !selectedMatkul) {
                    setSelectedMatkul(uniqueMatkuls[0])
                }


                // 4. Process grades
                const gradesByMatkul = {}

                // Sort results by created_at ascending (oldest first) so that newer exam records correctly overwrite older ones
                const sortedResults = results ? [...results].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)) : []

                sortedResults.forEach(r => {
                    const matkulId = r.jadwal?.matkul_id
                    const mahasiswaId = r.mahasiswa_id
                    const tipeUjian = (r.jadwal?.tipe || r.jadwal?.tipe_ujian || '').toUpperCase()

                    if (!matkulId || !mahasiswaId) return

                    if (!gradesByMatkul[matkulId]) {
                        gradesByMatkul[matkulId] = {}
                    }

                    // Init student entry if not exists
                    if (!gradesByMatkul[matkulId][mahasiswaId]) {
                        gradesByMatkul[matkulId][mahasiswaId] = {
                            id: mahasiswaId,
                            resultId: r.id,
                            allResultIds: [r.id],
                            nim: r.mahasiswa?.nim_nip || '-',
                            name: r.mahasiswa?.nama || 'Unknown',
                            kelas_id: r.mahasiswa?.kelas?.id || r.mahasiswa?.kelas_id || r.jadwal?.kelas?.id || null,
                            nt: r.nilai_tugas ?? null,
                            nuts: null,
                            np: r.nilai_praktek ?? null,
                            uas: null,
                            nak: null,
                            nh: null
                        }
                    } else {
                        // Collect ALL resultIds for this student (UTS + UAS records)
                        if (!gradesByMatkul[matkulId][mahasiswaId].allResultIds.includes(r.id)) {
                            gradesByMatkul[matkulId][mahasiswaId].allResultIds.push(r.id)
                        }
                    }

                    // Apply UTS or UAS score from exam results (nilai_total)
                    const dbScore = r.nilai_total != null ? Number(r.nilai_total) : null

                    if (dbScore != null && tipeUjian === 'UTS') {
                        gradesByMatkul[matkulId][mahasiswaId].nuts = dbScore
                        console.log(`[NilaiAkhir] Set NUTS=${dbScore} for ${mahasiswaId} from hasil_ujian`)
                    } else if (dbScore != null && tipeUjian === 'UAS') {
                        gradesByMatkul[matkulId][mahasiswaId].uas = dbScore
                        console.log(`[NilaiAkhir] Set UAS=${dbScore} for ${mahasiswaId} from hasil_ujian`)
                    }

                    // Apply manual overrides from ANY record (not filtered by tipe)
                    if (r.nilai_uts != null) {
                        gradesByMatkul[matkulId][mahasiswaId].nuts = Number(r.nilai_uts)
                    }
                    if (r.nilai_uas != null) {
                        gradesByMatkul[matkulId][mahasiswaId].uas = Number(r.nilai_uas)
                    }
                    if (r.nilai_tugas != null) {
                        gradesByMatkul[matkulId][mahasiswaId].nt = Number(r.nilai_tugas)
                    }
                    if (r.nilai_praktek != null) {
                        gradesByMatkul[matkulId][mahasiswaId].np = Number(r.nilai_praktek)
                    }
                })

                // Convert to array format for state
                const gradesArray = {}
                Object.keys(gradesByMatkul).forEach(mkId => {
                    gradesArray[mkId] = Object.values(gradesByMatkul[mkId])
                })

                setGrades(gradesArray)

            } catch (error) {
                console.error('Error loading nilai akhir:', error)
            }
        }

        loadData()
    }, [user])

    // Check if current matkul has praktek
    const hasPraktek = (selectedMatkul?.sks_praktek > 0) || (selectedMatkul?.sksPraktek > 0)

    const currentGrades = selectedMatkul ? (grades[selectedMatkul.id] || []) : []

    const filteredGrades = currentGrades.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.nim.includes(search)
        const matchesKelas = kelasFilter === 'all' || String(s.kelas_id) === String(kelasFilter)
        return matchesSearch && matchesKelas
    })

    const handleMatkulChange = (matkulId) => {
        const matkul = matkulList.find(m => String(m.id) === String(matkulId))
        setSelectedMatkul(matkul)
        setEditingStudent(null)
    }

    const handleStartEdit = (student) => {
        setEditingStudent(student.id)
        setEditValues({
            nt: student.nt ?? '',
            nuts: student.nuts ?? '',
            np: student.np ?? '',
            uas: student.uas ?? ''
        })
    }

    const handleSaveEdit = async (student) => {
        const nt = editValues.nt === '' ? null : Number(editValues.nt)
        const nuts = editValues.nuts === '' ? null : Number(editValues.nuts)
        const np = editValues.np === '' ? null : Number(editValues.np)
        const uas = editValues.uas === '' ? null : Number(editValues.uas)

        setSaving(true)

        // Save to Supabase if available — save to ALL result records for this student
        if (isSupabaseConfigured()) {
            const updateData = {
                nilai_tugas: nt,
                nilai_praktek: np,
                nilai_uts: nuts,
                nilai_uas: uas
            }
            const idsToUpdate = student.allResultIds || (student.resultId ? [student.resultId] : [])
            try {
                for (const rid of idsToUpdate) {
                    await hasilUjianService.update(rid, updateData)
                }
                console.log('[NilaiAkhir] Saved to Supabase, records:', idsToUpdate)
            } catch (error) {
                console.error('[NilaiAkhir] Save to Supabase failed:', error)
                alert('Gagal menyimpan ke database: ' + error.message)
            }
        }

        // Update in state
        const updatedGrades = { ...grades }
        updatedGrades[selectedMatkul.id] = updatedGrades[selectedMatkul.id].map(s =>
            s.id === student.id ? { ...s, nt, nuts, np, uas } : s
        )
        setGrades(updatedGrades)
        setEditingStudent(null)
        setSaving(false)
    }

    const handleCancelEdit = () => {
        setEditingStudent(null)
        setEditValues({})
    }

    const handleExportExcel = () => {
        if (!selectedMatkul || currentGrades.length === 0) return

        // Generate rows for XLSX export
        const headers = hasPraktek
            ? ['No', 'Nama', 'NIM', 'NT (10%)', 'NUTS (20%)', 'NP (20%)', 'UAS (50%)', 'NAK', 'NH', 'Score']
            : ['No', 'Nama', 'NIM', 'NT (10%)', 'NUTS (30%)', 'UAS (60%)', 'NAK', 'NH', 'Score']

        const dataRows = currentGrades.map((student, index) => {
            const nak = calculateNAK(student, hasPraktek)
            const nh = getNilaiHuruf(nak)
            const score = getScoreAkhir(nak)

            if (hasPraktek) {
                return [
                    index + 1,
                    student.name,
                    student.nim,
                    student.nt ?? '-',
                    student.nuts ?? '-',
                    student.np ?? '-',
                    student.uas ?? '-',
                    isNaN(nak) ? '-' : nak.toFixed(1),
                    isNaN(nak) ? '-' : nh,
                    isNaN(nak) ? '-' : score
                ]
            } else {
                return [
                    index + 1,
                    student.name,
                    student.nim,
                    student.nt ?? '-',
                    student.nuts ?? '-',
                    student.uas ?? '-',
                    isNaN(nak) ? '-' : nak.toFixed(1),
                    isNaN(nak) ? '-' : nh,
                    isNaN(nak) ? '-' : score
                ]
            }
        })

        const rows = [headers, ...dataRows]
        exportArrayToXLSX(rows, `nilai_akhir_${selectedMatkul.kode}_${new Date().toISOString().split('T')[0]}`, 'Nilai Akhir')
    }    

    // Print Nilai Akhir with kop surat
    const handlePrintNilaiAkhir = () => {
        if (!selectedMatkul || filteredGrades.length === 0) return

        const dosenName = user?.nama || ''
        const dosenNip = user?.nim_nip || ''
        const kelasName = kelasFilter !== 'all'
            ? kelasList.find(k => String(k.id) === String(kelasFilter))?.nama || ''
            : 'Semua Kelas'

        // Sort by NIM
        const sortedStudents = [...filteredGrades].sort((a, b) => (a.nim || '').localeCompare(b.nim || ''))

        // Build logo HTML
        const logoHtml = settings?.logoUrl
            ? '<img src="' + settings.logoUrl + '" alt="Logo" style="width: 70px; height: 70px; object-fit: contain;"/>'
            : '<div class="letterhead-logo"><span class="logo-icon">\u2693</span><span class="logo-text">POLTEKTRANS</span></div>'

        // Build NP column header
        const npHeader = hasPraktek ? '<th style="width:45px">NP<br/>20%</th>' : ''

        // Build table rows
        const tableRows = sortedStudents.map((s, i) => {
            const nak = calculateNAK(s, hasPraktek)
            const nh = getNilaiHuruf(nak)
            const score = getScoreAkhir(nak)
            const gradeClass = nh === 'A' || nh === 'AB' ? 'grade-a' : nh === 'B' || nh === 'BC' ? 'grade-b' : nh === 'C' ? 'grade-c' : 'grade-e'
            const npCell = hasPraktek ? '<td>' + (s.np ?? '-') + '</td>' : ''
            return '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td>' + s.nim + '</td>' +
                '<td class="name">' + s.name + '</td>' +
                '<td>' + (s.nt ?? '-') + '</td>' +
                '<td>' + (s.nuts ?? '-') + '</td>' +
                npCell +
                '<td>' + (s.uas ?? '-') + '</td>' +
                '<td><strong>' + (isNaN(nak) ? '-' : nak.toFixed(1)) + '</strong></td>' +
                '<td class="' + gradeClass + '">' + (isNaN(nak) ? '-' : nh) + '</td>' +
                '<td>' + (isNaN(nak) ? '-' : score) + '</td>' +
                '</tr>'
        }).join('')

        const printContent = `
            <html>
            <head>
                <title>Nilai Akhir - ${selectedMatkul.nama}</title>
                <style>
                    @page { size: A4 portrait; margin: 8mm 12mm 6mm; }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Times New Roman', serif; font-size: 9.5pt; padding: 0; line-height: 1.35; }
                    .letterhead { display: flex; align-items: center; gap: 12px; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 10px; }
                    .letterhead img { height: 55px; width: auto; }
                    .letterhead-logo {
                        flex-shrink: 0;
                    }
                    .letterhead-logo img { height: 55px; width: auto; }
                    .letterhead-logo .logo-icon { font-size: 24pt; line-height: 1; }
                    .letterhead-logo .logo-text { font-size: 6pt; color: #1e3a5f; font-weight: bold; }
                    .letterhead-text { flex: 1; text-align: center; }
                    .letterhead-text h1 { margin: 2px 0; font-size: 12.5pt; text-transform: uppercase; font-weight: bold; }
                    .letterhead-text p { margin: 2px 0; font-size: 8.5pt; }
                    .document-title { text-align: center; margin: 10px 0 5px; }
                    .document-title h3 { text-decoration: underline; margin: 0; font-size: 12.5pt; font-weight: bold; }
                    .document-title p { margin-top: 2px; font-size: 9.5pt; }
                    .exam-info { margin-bottom: 4px; font-size: 9.5pt; }
                    .exam-info p { margin: 2px 0; }
                    .bobot-info { margin-bottom: 8px; font-size: 8.5pt; font-style: italic; color: #555; }
                    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9.5pt; }
                    th, td { border: 1px solid #000; padding: 3px 5px; text-align: center; }
                    th { background: #f0f0f0; font-weight: bold; }
                    td.name { text-align: left; }
                    .grade-a { color: #166534; font-weight: bold; }
                    .grade-b { color: #854d0e; font-weight: bold; }
                    .grade-c { color: #1e40af; }
                    .grade-e { color: #dc2626; font-weight: bold; }
                    .signature-section { margin-top: 20px; display: flex; justify-content: flex-end; page-break-inside: avoid; }
                    .signature-box { text-align: center; width: 220px; font-size: 9.5pt; }
                    .signature-line { margin-top: 45px; padding-top: 5px; }
                    .signature-line p { margin: 2px 0; }
                </style>
            </head>
            <body>
                <div class="letterhead">
                    ${logoHtml}
                    <div class="letterhead-text">
                        <h1>${settings?.institution || 'Politeknik Transportasi SDP Palembang'}</h1>
                        <p>${settings?.address || 'Jl. Residen Abdul Rozak, Palembang, Sumatera Selatan'}</p>
                        <p>Telp: ${settings?.phone || '(0711) 123456'} | Email: ${settings?.email || 'info@poltektrans.ac.id'}</p>
                    </div>
                </div>
                <div class="document-title">
                    <h3>DAFTAR NILAI AKHIR SEMESTER</h3>
                    <p>Tahun Akademik ${settings?.tahunAkademik || ''}</p>
                </div>
                <div class="exam-info">
                    <p><strong>Mata Kuliah:</strong> ${selectedMatkul.nama} (${selectedMatkul.kode || ''})</p>
                    <p><strong>Kelas:</strong> ${kelasName}</p>
                    <p><strong>Dosen Pengampu:</strong> ${dosenName}</p>
                </div>
                <div class="bobot-info">
                    Bobot: NT ${hasPraktek ? '10%' : '10%'} | NUTS ${hasPraktek ? '20%' : '30%'} ${hasPraktek ? '| NP 20%' : ''} | UAS ${hasPraktek ? '50%' : '60%'}
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width:30px">No</th>
                            <th>NIM</th>
                            <th>Nama Mahasiswa</th>
                            <th style="width:45px">NT<br/>${hasPraktek ? '10%' : '10%'}</th>
                            <th style="width:45px">NUTS<br/>${hasPraktek ? '20%' : '30%'}</th>
                            ${npHeader}
                            <th style="width:45px">UAS<br/>${hasPraktek ? '50%' : '60%'}</th>
                            <th style="width:45px">NAK</th>
                            <th style="width:35px">NH</th>
                            <th style="width:40px">Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                <div class="signature-section">
                    <div class="signature-box">
                        <p>Palembang, ${new Date().toLocaleDateString('id-ID')}</p>
                        <p>Dosen Pengampu</p>
                        <div class="signature-line">
                            <p><strong>${dosenName || '_________________________'}</strong></p>
                            <p>NIP. ${dosenNip || '_______________'}</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `
        const printWindow = window.open('', '_blank')
        printWindow.document.write(printContent)
        printWindow.document.close()
        printWindow.print()
    }

    // Empty state - no matkul
    if (matkulList.length === 0) {
        return (
            <DashboardLayout>
                <div className="dashboard-page animate-fadeIn">
                    <div className="page-header">
                        <div>
                            <h1 className="page-title">Nilai Akhir Semester</h1>
                            <p className="page-subtitle">Perhitungan nilai akhir dengan bobot komponen</p>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-body text-center" style={{ padding: '64px 32px' }}>
                            <BookOpen size={64} style={{ marginBottom: '16px', opacity: 0.4, color: 'var(--color-text-muted)' }} />
                            <h3 style={{ marginBottom: '8px' }}>Belum Ada Mata Kuliah</h3>
                            <p className="text-muted">Data mata kuliah belum tersedia. Silakan hubungi Admin untuk menambahkan mata kuliah.</p>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    // Loading/no selection state
    if (!selectedMatkul) {
        return (
            <DashboardLayout>
                <div className="dashboard-page animate-fadeIn">
                    <div className="page-header">
                        <div>
                            <h1 className="page-title">Nilai Akhir Semester</h1>
                            <p className="page-subtitle">Perhitungan nilai akhir dengan bobot komponen</p>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-body text-center" style={{ padding: '64px 32px' }}>
                            <BookOpen size={64} style={{ marginBottom: '16px', opacity: 0.4, color: 'var(--color-text-muted)' }} />
                            <h3 style={{ marginBottom: '8px' }}>Memuat Data...</h3>
                            <p className="text-muted">Silakan tunggu atau pilih mata kuliah.</p>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Nilai Akhir Semester</h1>
                        <p className="page-subtitle">Perhitungan nilai akhir dengan bobot komponen</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-outline" onClick={handlePrintNilaiAkhir}>
                            <Printer size={18} />
                            Cetak Nilai
                        </button>
                        <button className="btn btn-primary" onClick={handleExportExcel}>
                            <FileSpreadsheet size={18} />
                            Export Excel
                        </button>
                    </div>
                </div>

                {/* Matkul Selector */}
                <div className="card mb-4">
                    <div className="card-body">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <label style={{ fontWeight: '500' }}>Mata Kuliah:</label>
                            <select
                                className="form-input"
                                value={selectedMatkul.id}
                                onChange={e => handleMatkulChange(e.target.value)}
                                style={{ minWidth: '300px' }}
                            >
                                {matkulList.map(mk => (
                                    <option key={mk.id} value={mk.id}>
                                        {mk.nama} - {mk.kode}
                                    </option>
                                ))}
                            </select>
                            <label style={{ fontWeight: '500' }}>Kelas:</label>
                            <select
                                className="form-input"
                                value={kelasFilter}
                                onChange={e => setKelasFilter(e.target.value)}
                                style={{ minWidth: '160px' }}
                            >
                                <option value="all">Semua Kelas</option>
                                {kelasList.map(k => (
                                    <option key={k.id} value={k.id}>{k.nama} ({k.angkatan})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Bobot Info - Dynamic based on matkul */}
                <div className="card mb-4 info-box">
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Info size={18} className="info-icon" />
                        <div>
                            <strong>Rumus Nilai:</strong>
                            <span style={{ marginLeft: '8px' }}>
                                {hasPraktek
                                    ? 'NT (10%) + NUTS (20%) + NP (20%) + UAS (50%) = NAK'
                                    : 'NT (10%) + NUTS (30%) + UAS (60%) = NAK'
                                }
                            </span>
                        </div>
                    </div>
                </div>

                {/* Grade Conversion Table */}
                <div className="card mb-4">
                    <div className="card-header">
                        <h4>Konversi Nilai</h4>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            <span className="badge badge-success">A (&gt;80) = 4.0</span>
                            <span className="badge badge-success">AB (&gt;75-80) = 3.5</span>
                            <span className="badge badge-warning">B (&gt;69-75) = 3.0</span>
                            <span className="badge badge-warning">BC (&gt;60-69) = 2.5</span>
                            <span className="badge badge-info">C (&gt;55-60) = 2.0</span>
                            <span className="badge badge-error">D (&gt;44-55) = 1.0</span>
                            <span className="badge badge-error">E (&lt;44) = 0</span>
                        </div>
                    </div>
                </div>

                {/* Grades Table */}
                <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3>Daftar Nilai Mahasiswa</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Cari mahasiswa..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none' }}
                            />
                        </div>
                    </div>
                    <div className="card-body">
                        {filteredGrades.length === 0 ? (
                            <div className="text-center" style={{ padding: '48px' }}>
                                <Award size={48} style={{ opacity: 0.4, marginBottom: '16px', color: 'var(--color-text-muted)' }} />
                                <h4>Belum Ada Data Nilai</h4>
                                <p className="text-muted">Data nilai mahasiswa akan muncul setelah ujian selesai dikoreksi.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>No</th>
                                            <th>Nama</th>
                                            <th>NIM</th>
                                            <th className="text-center">NT<br /><small>10%</small></th>
                                            <th className="text-center">NUTS<br /><small>{hasPraktek ? '20%' : '30%'}</small></th>
                                            {hasPraktek && <th className="text-center">NP<br /><small>20%</small></th>}
                                            <th className="text-center">UAS<br /><small>{hasPraktek ? '50%' : '60%'}</small></th>
                                            <th className="text-center">NAK</th>
                                            <th className="text-center">NH</th>
                                            <th className="text-center">Score</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredGrades.map((student, index) => {
                                            const isEditing = editingStudent === student.id
                                            const nak = calculateNAK(student, hasPraktek)
                                            const nh = getNilaiHuruf(nak)
                                            const score = getScoreAkhir(nak)
                                            return (
                                                <tr key={student.id}>
                                                    <td>{index + 1}</td>
                                                    <td>{student.name}</td>
                                                    <td>{student.nim}</td>
                                                    <td className="text-center">
                                                        {isEditing ? (
                                                            <input
                                                                type="number"
                                                                className="form-input"
                                                                style={{ width: '60px', textAlign: 'center', padding: '4px' }}
                                                                value={editValues.nt}
                                                                onChange={e => setEditValues({ ...editValues, nt: e.target.value })}
                                                                min={0}
                                                                max={100}
                                                            />
                                                        ) : (
                                                            student.nt ?? <span style={{ color: 'var(--text-muted)' }}>-</span>
                                                        )}
                                                    </td>
                                                    <td className="text-center">
                                                        {isEditing ? (
                                                            <input
                                                                type="number"
                                                                className="form-input"
                                                                style={{ width: '60px', textAlign: 'center', padding: '4px' }}
                                                                value={editValues.nuts}
                                                                onChange={e => setEditValues({ ...editValues, nuts: e.target.value })}
                                                                min={0}
                                                                max={100}
                                                            />
                                                        ) : (
                                                            student.nuts ?? <span style={{ color: 'var(--text-muted)' }}>-</span>
                                                        )}
                                                    </td>
                                                    {hasPraktek && (
                                                        <td className="text-center">
                                                            {isEditing ? (
                                                                <input
                                                                    type="number"
                                                                    className="form-input"
                                                                    style={{ width: '60px', textAlign: 'center', padding: '4px' }}
                                                                    value={editValues.np}
                                                                    onChange={e => setEditValues({ ...editValues, np: e.target.value })}
                                                                    min={0}
                                                                    max={100}
                                                                />
                                                            ) : (
                                                                student.np ?? <span style={{ color: 'var(--text-muted)' }}>-</span>
                                                            )}
                                                        </td>
                                                    )}
                                                    <td className="text-center">
                                                        {isEditing ? (
                                                            <input
                                                                type="number"
                                                                className="form-input"
                                                                style={{ width: '60px', textAlign: 'center', padding: '4px' }}
                                                                value={editValues.uas}
                                                                onChange={e => setEditValues({ ...editValues, uas: e.target.value })}
                                                                min={0}
                                                                max={100}
                                                            />
                                                        ) : (
                                                            student.uas ?? <span style={{ color: 'var(--text-muted)' }}>-</span>
                                                        )}
                                                    </td>
                                                    <td className="text-center"><strong>{isNaN(nak) ? '-' : nak.toFixed(1)}</strong></td>
                                                    <td className="text-center">
                                                        {isNaN(nak) ? '-' : <span className={`badge badge-${getGradeColor(nh)}`}>{nh}</span>}
                                                    </td>
                                                    <td className="text-center"><strong>{isNaN(nak) ? '-' : score}</strong></td>
                                                    <td>
                                                        {isEditing ? (
                                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                                <button className="btn btn-sm btn-primary" onClick={() => handleSaveEdit(student)}>
                                                                    <Check size={14} />
                                                                </button>
                                                                <button className="btn btn-sm btn-ghost" onClick={handleCancelEdit}>
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button className="btn btn-sm btn-ghost" onClick={() => handleStartEdit(student)} title="Edit NT/NP">
                                                                <Edit2 size={14} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .mb-4 { margin-bottom: 16px; }
                .text-center { text-align: center; }
                .btn-sm { padding: 4px 8px; font-size: 12px; }
                
                /* Info Box Styling */
                .info-box {
                    background: var(--info-50);
                    border: 1px solid var(--info-200);
                }
                .info-box .card-body {
                    color: var(--info-700);
                }
                .info-box .info-icon {
                    color: var(--info-600);
                }
                .info-box strong {
                    color: var(--info-800);
                }
                
                /* Dark Mode Info Box */
                [data-theme="dark"] .info-box {
                    background: rgba(59, 130, 246, 0.1);
                    border-color: rgba(59, 130, 246, 0.3);
                }
                [data-theme="dark"] .info-box .card-body,
                [data-theme="dark"] .info-box strong,
                [data-theme="dark"] .info-box span {
                    color: #93c5fd;
                }
                [data-theme="dark"] .info-box .info-icon {
                    color: #60a5fa;
                }
            `}</style>
        </DashboardLayout>
    )
}

export default NilaiAkhirPage
