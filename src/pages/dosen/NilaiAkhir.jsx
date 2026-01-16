import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { exportArrayToXLSX } from '../../utils/excelUtils'
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

    // Storage key for manual grades
    const GRADES_STORAGE_KEY = 'cat_nilai_akhir'

    // Load matkul and exam results from localStorage
    useEffect(() => {
        const matkulSaved = localStorage.getItem('cat_matkul_data')
        const resultsSaved = localStorage.getItem('cat_exam_results')
        const jadwalSaved = localStorage.getItem('cat_jadwal_data')
        const manualGrades = localStorage.getItem(GRADES_STORAGE_KEY)
        const catUser = JSON.parse(localStorage.getItem('cat_user') || '{}')
        const dosenMatkulIds = catUser.matkulIds || []

        // Parse manual grades (NT, NP values)
        let savedManualGrades = {}
        if (manualGrades) {
            try { savedManualGrades = JSON.parse(manualGrades) } catch (e) { }
        }

        if (matkulSaved) {
            try {
                const data = JSON.parse(matkulSaved)
                // Filter by dosen's matkul if applicable
                const filteredMatkul = dosenMatkulIds.length > 0
                    ? data.filter(m => dosenMatkulIds.includes(m.id))
                    : data
                setMatkulList(filteredMatkul)
                if (filteredMatkul.length > 0) {
                    setSelectedMatkul(filteredMatkul[0])
                }
            } catch (e) {
                console.error('Error loading matkul:', e)
            }
        }

        // Load exam results and organize by matkul with proper linking
        if (resultsSaved && jadwalSaved) {
            try {
                const results = JSON.parse(resultsSaved)
                const jadwal = JSON.parse(jadwalSaved)

                // Group by matkulId, linking through jadwal
                const gradesByMatkul = {}
                results.forEach(r => {
                    // Find jadwal to get matkulId and tipeUjian
                    const examJadwal = jadwal.find(j => String(j.id) === String(r.examId))
                    if (!examJadwal) return

                    const matkulId = examJadwal.matkulId
                    const tipeUjian = examJadwal.tipeUjian

                    // Filter by dosen's matkul if applicable
                    if (dosenMatkulIds.length > 0 && !dosenMatkulIds.includes(matkulId)) return

                    if (!gradesByMatkul[matkulId]) {
                        gradesByMatkul[matkulId] = {}
                    }

                    // Use mahasiswaId as key to group UTS/UAS for same student
                    const key = String(r.mahasiswaId)
                    if (!gradesByMatkul[matkulId][key]) {
                        // Check for saved manual grades
                        const savedGrade = savedManualGrades[matkulId]?.[key] || {}
                        gradesByMatkul[matkulId][key] = {
                            id: r.mahasiswaId,
                            nim: r.nim || '-',
                            name: r.mahasiswaName || 'Unknown',
                            nt: savedGrade.nt ?? null, // Default null
                            nuts: savedGrade.nuts ?? null, // Can be manually overridden
                            np: savedGrade.np ?? null, // Default null
                            uas: savedGrade.uas ?? null, // Can be manually overridden
                            nak: null,
                            nh: null,
                            sa: null
                        }
                    }

                    // Calculate percentage score from exam result
                    const percentScore = r.maxScore > 0 ? Math.round((r.totalScore / r.maxScore) * 100) : 0
                    const savedGrade = savedManualGrades[matkulId]?.[key] || {}

                    // Only use exam result if no manual override exists
                    if (tipeUjian === 'UTS' && savedGrade.nuts === undefined) {
                        gradesByMatkul[matkulId][key].nuts = percentScore
                    } else if (tipeUjian === 'UAS' && savedGrade.uas === undefined) {
                        gradesByMatkul[matkulId][key].uas = percentScore
                    }
                })

                // Convert to array format
                const gradesArray = {}
                Object.keys(gradesByMatkul).forEach(matkulId => {
                    gradesArray[matkulId] = Object.values(gradesByMatkul[matkulId])
                })

                setGrades(gradesArray)
            } catch (e) {
                console.error('Error loading exam results:', e)
            }
        }
    }, [])

    // Check if current matkul has praktek
    const hasPraktek = selectedMatkul?.sksPraktek > 0

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

    const handleSaveEdit = (student) => {
        const nt = editValues.nt === '' ? null : Number(editValues.nt)
        const nuts = editValues.nuts === '' ? null : Number(editValues.nuts)
        const np = editValues.np === '' ? null : Number(editValues.np)
        const uas = editValues.uas === '' ? null : Number(editValues.uas)

        // Update in state
        const updatedGrades = { ...grades }
        updatedGrades[selectedMatkul.id] = updatedGrades[selectedMatkul.id].map(s =>
            s.id === student.id ? { ...s, nt, nuts, np, uas } : s
        )
        setGrades(updatedGrades)
        setEditingStudent(null)

        // Save to localStorage
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
                <div className="card mb-4" style={{ background: 'var(--info-50)', border: '1px solid var(--info-200)' }}>
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Info size={18} style={{ color: 'var(--info-600)' }} />
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
            `}</style>
        </DashboardLayout>
    )
}

export default NilaiAkhirPage
