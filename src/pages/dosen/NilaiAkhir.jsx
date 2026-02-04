import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { exportArrayToXLSX } from '../../utils/excelUtils'
import { hasilUjianService, isSupabaseConfigured } from '../../services/supabaseService'
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
    BookOpen
} from 'lucide-react'
import '../admin/Dashboard.css'

// Grade calculation helper functions
const calculateNAK = (student, hasPraktek) => {
    if (hasPraktek) {
        // NT 10% + NUTS 20% + NP 20% + UAS 50%
        return (student.nt * 0.1) + (student.nuts * 0.2) + (student.np * 0.2) + (student.uas * 0.5)
    } else {
        // NT 10% + NUTS 30% + UAS 60%
        return (student.nt * 0.1) + (student.nuts * 0.3) + (student.uas * 0.6)
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
    const [matkulList, setMatkulList] = useState([])
    const [selectedMatkul, setSelectedMatkul] = useState(null)
    const [grades, setGrades] = useState({})
    const [search, setSearch] = useState('')
    const [editingStudent, setEditingStudent] = useState(null)
    const [editValues, setEditValues] = useState({})
    const [saving, setSaving] = useState(false)

    // Storage key for manual grades
    const GRADES_STORAGE_KEY = 'cat_nilai_akhir'

    // Load matkul and exam results from Supabase
    useEffect(() => {
        const loadData = async () => {
            if (!user?.id) return

            try {
                // 1. Get all exam results for this lecturer
                const results = await hasilUjianService.getByDosen(user.id)
                console.log('NilaiAkhir results:', results)

                // 2. Extract unique matkuls from results
                const matkulMap = new Map()
                results.forEach(r => {
                    const m = r.jadwal?.matkul
                    if (m && !matkulMap.has(m.id)) {
                        matkulMap.set(m.id, m)
                    }
                })
                const uniqueMatkuls = Array.from(matkulMap.values())
                setMatkulList(uniqueMatkuls)

                // Set default selection
                if (uniqueMatkuls.length > 0 && !selectedMatkul) {
                    setSelectedMatkul(uniqueMatkuls[0])
                }

                // 3. Load manual grades (NT, NP) from localStorage (kept as local drafts)
                const manualGrades = JSON.parse(localStorage.getItem(GRADES_STORAGE_KEY) || '{}')

                // 4. Process grades
                const gradesByMatkul = {}

                results.forEach(r => {
                    const matkulId = r.jadwal?.matkul_id
                    const mahasiswaId = r.mahasiswa_id
                    const tipeUjian = r.jadwal?.tipe // 'UTS' or 'UAS'

                    if (!matkulId || !mahasiswaId) return

                    if (!gradesByMatkul[matkulId]) {
                        gradesByMatkul[matkulId] = {}
                    }

                    // Init student entry if not exists
                    if (!gradesByMatkul[matkulId][mahasiswaId]) {
                        const savedGrade = manualGrades[matkulId]?.[mahasiswaId] || {}
                        gradesByMatkul[matkulId][mahasiswaId] = {
                            id: mahasiswaId,
                            resultId: r.id, // Store hasil_ujian ID for updates
                            nim: r.mahasiswa?.nim_nip || '-',
                            name: r.mahasiswa?.nama || 'Unknown',
                            nt: r.nilai_tugas ?? savedGrade.nt ?? null, // Use DB value first
                            nuts: savedGrade.nuts ?? null, // Will override with DB if exists
                            np: r.nilai_praktek ?? savedGrade.np ?? null, // Use DB value first
                            uas: savedGrade.uas ?? null, // Will override with DB if exists
                            nak: null,
                            nh: null
                        }
                    } else {
                        // Update resultId if we have newer data
                        gradesByMatkul[matkulId][mahasiswaId].resultId = r.id
                    }

                    // Update UTS or UAS score from DB
                    // Assume nilai_total is the score (0-100)
                    const dbScore = Number(r.nilai_total || 0)

                    if (tipeUjian === 'UTS') {
                        gradesByMatkul[matkulId][mahasiswaId].nuts = dbScore
                    } else if (tipeUjian === 'UAS') {
                        gradesByMatkul[matkulId][mahasiswaId].uas = dbScore
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

    const filteredGrades = currentGrades.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.nim.includes(search)
    )

    const handleMatkulChange = (matkulId) => {
        const matkul = matkulList.find(m => m.id === parseInt(matkulId))
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

        // Save to Supabase if available
        if (isSupabaseConfigured() && student.resultId) {
            try {
                await hasilUjianService.update(student.resultId, {
                    nilai_tugas: nt,
                    nilai_praktek: np
                })
                console.log('[NilaiAkhir] Saved to Supabase:', student.resultId)
            } catch (error) {
                console.error('[NilaiAkhir] Save to Supabase failed:', error)
                alert('Gagal menyimpan ke database. Nilai disimpan lokal saja.')
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

        // Save to localStorage as backup
        const savedGrades = JSON.parse(localStorage.getItem(GRADES_STORAGE_KEY) || '{}')
        if (!savedGrades[selectedMatkul.id]) savedGrades[selectedMatkul.id] = {}
        savedGrades[selectedMatkul.id][String(student.id)] = { nt, nuts, np, uas }
        localStorage.setItem(GRADES_STORAGE_KEY, JSON.stringify(savedGrades))
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
                    <button className="btn btn-primary" onClick={handleExportExcel}>
                        <FileSpreadsheet size={18} />
                        Export Nilai
                    </button>
                </div>

                {/* Matkul Selector */}
                <div className="card mb-4">
                    <div className="card-body">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
