import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { exportArrayToXLSX } from '../../utils/excelUtils'
import { hasilUjianService } from '../../services/supabaseService'
import {
    Award,
    Search,
    Download,
    ChevronDown,
    ChevronUp,
    Edit2,
    Check,
    X,
    Printer,
    Filter,
    RefreshCw,
    FileText,
    AlertTriangle,
    FileSpreadsheet,
    Eye
} from 'lucide-react'
import '../admin/Dashboard.css'

// Modal for editing student scores
function EditScoreModal({ isOpen, onClose, student, onSave }) {
    const [score, setScore] = useState(student?.score || 0)

    useEffect(() => {
        if (student) {
            setScore(student.score || 0)
        }
    }, [student])

    if (!isOpen || !student) return null

    const handleSave = () => {
        onSave(student.id || student.mahasiswaId, Number(score))
        onClose()
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Edit Nilai</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body">
                    <div className="form-group">
                        <label>Mahasiswa</label>
                        <p><strong>{student.name}</strong> ({student.nim})</p>
                    </div>
                    <div className="form-group">
                        <label>Nilai (0-100)</label>
                        <input
                            type="number"
                            className="form-input"
                            value={score}
                            onChange={e => setScore(e.target.value)}
                            min={0}
                            max={100}
                        />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose}>Batal</button>
                    <button className="btn btn-primary" onClick={handleSave}>
                        <Check size={16} />
                        Simpan
                    </button>
                </div>
            </div>
        </div>
    )
}

function NilaiUASPage() {
    const { user } = useAuth()
    const [exams, setExams] = useState([])
    const [expandedExam, setExpandedExam] = useState(null)
    const [search, setSearch] = useState('')
    const [sortBy, setSortBy] = useState('name')
    const [sortOrder, setSortOrder] = useState('asc')
    const [examTypeFilter, setExamTypeFilter] = useState('all') // uts, uas, all
    const [editModal, setEditModal] = useState({ open: false, student: null, examId: null })
    const [isLoading, setIsLoading] = useState(true)

    // Load exam results from Supabase
    useEffect(() => {
        const loadData = async () => {
            if (!user?.id) return

            setIsLoading(true)
            try {
                // Fetch results for this Lecturer
                // This service already joins mahasiswa, kelas, jadwal, matkul
                const results = await hasilUjianService.getByDosen(user.id)
                console.log('Loaded results:', results)

                // Group results by examId (Jadwal ID)
                const examGroups = {}

                results.forEach(r => {
                    const jadwal = r.jadwal || {}
                    const mahasiswa = r.mahasiswa || {}
                    const matkul = jadwal.matkul || {}
                    const kelas = mahasiswa.kelas || {}

                    const examId = jadwal.id
                    if (!examId) return

                    if (!examGroups[examId]) {
                        examGroups[examId] = {
                            id: examId,
                            examName: `${jadwal.tipe || 'UJIAN'} ${matkul.nama || ''}`,
                            examType: jadwal.tipe?.toLowerCase() || 'uas',
                            matkul: matkul.nama || 'N/A',
                            kelas: kelas.nama || 'N/A',
                            date: jadwal.tanggal || 'N/A',
                            students: []
                        }
                    }

                    // Calculate score
                    // Handle case where score might be in different fields or calculated
                    // In Supabase schema: nilai_total is the raw score. 
                    // We assume max score is 100 for now or calculate from answers if needed.
                    // For simplicity, let's assume nilai_total is already the percentage 
                    // or if it's raw, we might need max score from soal count.
                    // BUT: The previous localStorage code did: percent = (total / max) * 100
                    // In Supabase `hasil_ujian`, we typically store the final calculated score or raw.
                    // Let's use `nilai_total` as the Score directly for now, assuming it's 0-100 logic or raw.
                    // Warning: If `nilai_total` is raw (e.g. 40 out of 50 questions), we need context.
                    // But `TakeExam` logic saves `nilai_total` based on `calculateScore` which usually returns 0-100.
                    // Let's verify TakeExam logic later if needed.

                    examGroups[examId].students.push({
                        id: r.id, // ID hasil_ujian
                        resultId: r.id,
                        mahasiswaId: r.mahasiswa_id,
                        name: mahasiswa.nama || 'Unknown',
                        nim: mahasiswa.nim_nip || '-',
                        score: Number(r.nilai_total || 0),
                        rawScore: r.nilai_total,
                        maxScore: 100, // Assumed
                        isFullyCorrected: true // Auto-graded usually
                    })
                })

                setExams(Object.values(examGroups))
            } catch (error) {
                console.error('Error loading grades:', error)
            } finally {
                setIsLoading(false)
            }
        }

        loadData()
    }, [user])

    const toggleExpand = (examId) => {
        setExpandedExam(expandedExam === examId ? null : examId)
    }

    // Filter exams by type
    const filteredExams = exams.filter(exam =>
        examTypeFilter === 'all' || exam.examType === examTypeFilter
    )

    const sortStudents = (students) => {
        return [...students].sort((a, b) => {
            let comparison = 0
            if (sortBy === 'name') {
                comparison = a.name.localeCompare(b.name)
            } else if (sortBy === 'score') {
                comparison = a.score - b.score
            }
            return sortOrder === 'asc' ? comparison : -comparison
        })
    }

    const filterStudents = (students) => {
        if (!search) return students
        return students.filter(s =>
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.nim.includes(search)
        )
    }

    const getAverageScore = (students) => {
        if (students.length === 0) return 0
        const total = students.reduce((sum, s) => sum + s.score, 0)
        return (total / students.length).toFixed(1)
    }

    const getScoreColor = (score) => {
        if (score >= 70) return 'success'
        if (score >= 60) return 'warning'
        return 'error'
    }

    const getMengulangCount = (students) => {
        return students.filter(s => s.score < 70).length
    }

    const handleEditScore = (student, examId) => {
        setEditModal({ open: true, student, examId })
    }

    const handleSaveScore = async (studentId, newScore) => {
        try {
            await hasilUjianService.update(studentId, {
                nilai_total: newScore // Update score in db
            })

            // Update local state
            setExams(exams.map(exam => {
                if (exam.id === editModal.examId) {
                    return {
                        ...exam,
                        students: exam.students.map(s =>
                            s.id === studentId ? { ...s, score: newScore } : s
                        )
                    }
                }
                return exam
            }))
        } catch (error) {
            console.error('Failed to update score:', error)
            alert('Gagal menyimpan nilai. Silakan coba lagi.')
        }
    }

    const handleExportExcel = (exam) => {
        // Export in XLSX format
        const rows = [
            ['No', 'NIM', 'Nama', 'Nilai', 'Keterangan'],
            ...exam.students.map((student, index) => [
                index + 1,
                student.nim,
                student.name,
                student.score,
                student.score < 70 ? 'MENGULANG' : 'LULUS'
            ])
        ]

        exportArrayToXLSX(rows, `nilai_${exam.examType}_${exam.matkul.replace(/\s/g, '_')}_${exam.kelas}`, 'Nilai')
    }

    const handleDownloadTemplate = () => {
        const headers = ['NIM', 'Nama', 'Nilai']
        const sampleRows = [
            ['2024010001', 'Contoh Mahasiswa', 85]
        ]
        downloadTemplate(headers, sampleRows, 'template_import_nilai')
    }

    const handlePrint = (exam) => {
        const printContent = `
            <html>
            <head>
                <title>Nilai ${exam.examType.toUpperCase()} - ${exam.matkul}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { font-size: 18px; margin-bottom: 5px; }
                    h2 { font-size: 14px; color: #666; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background: #f5f5f5; }
                    .mengulang { color: red; font-weight: bold; }
                </style>
            </head>
            <body>
                <h1>${exam.examName}</h1>
                <h2>${exam.matkul} - Kelas ${exam.kelas} | Tanggal: ${exam.date}</h2>
                <table>
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>NIM</th>
                            <th>Nama</th>
                            <th>Nilai</th>
                            <th>Keterangan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${exam.students.map((s, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td>${s.nim}</td>
                                <td>${s.name}</td>
                                <td>${s.score}</td>
                                <td class="${s.score < 70 ? 'mengulang' : ''}">${s.score < 70 ? 'MENGULANG' : 'LULUS'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `
        const printWindow = window.open('', '_blank')
        printWindow.document.write(printContent)
        printWindow.document.close()
        printWindow.print()
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Nilai UAS dan UTS</h1>
                        <p className="page-subtitle">Hasil nilai ujian tengah dan akhir semester</p>
                    </div>
                    <div className="header-actions">
                        <button className="btn btn-outline" onClick={handleDownloadTemplate}>
                            <Download size={16} />
                            Template Import
                        </button>
                    </div>
                </div>

                {/* Filter by exam type */}
                <div className="exam-type-tabs">
                    <button
                        className={`tab-btn ${examTypeFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setExamTypeFilter('all')}
                    >
                        Semua
                    </button>
                    <button
                        className={`tab-btn ${examTypeFilter === 'uts' ? 'active' : ''}`}
                        onClick={() => setExamTypeFilter('uts')}
                    >
                        UTS
                    </button>
                    <button
                        className={`tab-btn ${examTypeFilter === 'uas' ? 'active' : ''}`}
                        onClick={() => setExamTypeFilter('uas')}
                    >
                        UAS
                    </button>
                </div>

                {/* Exam List */}
                <div className="exam-results-list">
                    {filteredExams.length === 0 ? (
                        <div className="card">
                            <div className="card-body text-center" style={{ padding: '48px', opacity: 0.6 }}>
                                <FileText size={48} style={{ marginBottom: '16px' }} />
                                <h4 style={{ margin: '0 0 8px' }}>Belum Ada Nilai Ujian</h4>
                                <p style={{ margin: 0 }}>Data nilai ujian akan muncul setelah ujian selesai dan dikoreksi.</p>
                            </div>
                        </div>
                    ) : filteredExams.map(exam => {
                        const isExpanded = expandedExam === exam.id
                        const filteredStudents = filterStudents(exam.students)
                        const sortedStudents = sortStudents(filteredStudents)
                        const avgScore = getAverageScore(exam.students)
                        const mengulangCount = getMengulangCount(exam.students)

                        return (
                            <div key={exam.id} className="exam-result-card">
                                <div
                                    className="exam-result-header"
                                    onClick={() => toggleExpand(exam.id)}
                                >
                                    <div className="exam-result-info">
                                        <div className="exam-title-row">
                                            <span className={`badge badge-${exam.examType === 'uts' ? 'primary' : 'accent'}`}>
                                                {exam.examType.toUpperCase()}
                                            </span>
                                            <h3>{exam.examName}</h3>
                                        </div>
                                        <p>{exam.matkul} - Kelas {exam.kelas}</p>
                                    </div>
                                    <div className="exam-result-meta">
                                        <div className="meta-item">
                                            <span className="meta-label">Tanggal</span>
                                            <span className="meta-value">{exam.date}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Peserta</span>
                                            <span className="meta-value">{exam.students.length}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Rata-rata</span>
                                            <span className={`meta-value score-${getScoreColor(avgScore)}`}>{avgScore}</span>
                                        </div>
                                        {mengulangCount > 0 && (
                                            <div className="meta-item mengulang-badge">
                                                <AlertTriangle size={14} />
                                                <span>{mengulangCount} Mengulang</span>
                                            </div>
                                        )}
                                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="exam-result-body">
                                        <div className="result-toolbar">
                                            <div className="search-box">
                                                <Search size={16} />
                                                <input
                                                    type="text"
                                                    placeholder="Cari mahasiswa..."
                                                    value={search}
                                                    onChange={e => setSearch(e.target.value)}
                                                />
                                            </div>
                                            <div className="sort-controls">
                                                <select
                                                    value={sortBy}
                                                    onChange={e => setSortBy(e.target.value)}
                                                >
                                                    <option value="name">Nama</option>
                                                    <option value="score">Nilai</option>
                                                </select>
                                                <button
                                                    className="btn btn-icon btn-ghost btn-sm"
                                                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                                >
                                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                                </button>
                                            </div>
                                            <button
                                                className="btn btn-outline btn-sm"
                                                onClick={() => handleExportExcel(exam)}
                                            >
                                                <FileSpreadsheet size={14} />
                                                Export Excel
                                            </button>
                                            <button
                                                className="btn btn-outline btn-sm"
                                                onClick={() => handlePrint(exam)}
                                            >
                                                <Printer size={14} />
                                                Cetak
                                            </button>
                                        </div>

                                        <div className="table-container">
                                            <table className="table">
                                                <thead>
                                                    <tr>
                                                        <th>No</th>
                                                        <th>Nama</th>
                                                        <th>NIM</th>
                                                        <th>Nilai</th>
                                                        <th>Keterangan</th>
                                                        <th>Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sortedStudents.map((student, index) => (
                                                        <tr key={student.id}>
                                                            <td>{index + 1}</td>
                                                            <td className="font-medium">{student.name}</td>
                                                            <td>{student.nim}</td>
                                                            <td>
                                                                <span className={`score-badge score-${getScoreColor(student.score)}`}>
                                                                    {student.score}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {student.score < 70 ? (
                                                                    <span className="badge badge-error">MENGULANG</span>
                                                                ) : (
                                                                    <span className="badge badge-success">LULUS</span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <div className="action-buttons">
                                                                    <button
                                                                        className="btn btn-icon btn-ghost btn-sm"
                                                                        title="Lihat"
                                                                    >
                                                                        <Eye size={16} />
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-icon btn-ghost btn-sm"
                                                                        title="Edit"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleEditScore(student, exam.id)
                                                                        }}
                                                                    >
                                                                        <Edit2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                <EditScoreModal
                    isOpen={editModal.open}
                    onClose={() => setEditModal({ open: false, student: null, examId: null })}
                    student={editModal.student}
                    onSave={handleSaveScore}
                />
            </div>

            <style>{`
                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    flex-wrap: wrap;
                    gap: var(--space-4);
                    margin-bottom: var(--space-4);
                }
                .header-actions {
                    display: flex;
                    gap: var(--space-2);
                }
                .exam-type-tabs {
                    display: flex;
                    gap: var(--space-2);
                    margin-bottom: var(--space-5);
                    background: var(--bg-tertiary);
                    padding: var(--space-1);
                    border-radius: var(--radius-lg);
                    width: fit-content;
                }
                .tab-btn {
                    padding: var(--space-2) var(--space-4);
                    border: none;
                    background: transparent;
                    border-radius: var(--radius-md);
                    font-weight: var(--font-medium);
                    cursor: pointer;
                    transition: all var(--transition-fast);
                    color: var(--text-secondary);
                }
                .tab-btn:hover {
                    background: var(--bg-secondary);
                }
                .tab-btn.active {
                    background: var(--primary-500);
                    color: white;
                }
                .exam-results-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4);
                }
                .exam-result-card {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                }
                .exam-result-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--space-4) var(--space-5);
                    cursor: pointer;
                    transition: background var(--transition-fast);
                }
                .exam-result-header:hover {
                    background: var(--bg-tertiary);
                }
                .exam-title-row {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    margin-bottom: var(--space-1);
                }
                .exam-title-row h3 {
                    margin: 0;
                    font-size: var(--font-size-base);
                }
                .exam-result-info p {
                    margin: 0;
                    font-size: var(--font-size-sm);
                    color: var(--text-secondary);
                }
                .exam-result-meta {
                    display: flex;
                    align-items: center;
                    gap: var(--space-4);
                }
                .meta-item {
                    text-align: center;
                }
                .meta-label {
                    display: block;
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
                .meta-value {
                    font-weight: var(--font-bold);
                }
                .mengulang-badge {
                    display: flex;
                    align-items: center;
                    gap: var(--space-1);
                    background: var(--error-100);
                    color: var(--error-700);
                    padding: var(--space-1) var(--space-2);
                    border-radius: var(--radius-full);
                    font-size: var(--font-size-xs);
                    font-weight: var(--font-medium);
                }
                .score-success {
                    color: var(--success-600);
                }
                .score-warning {
                    color: var(--warning-600);
                }
                .score-error {
                    color: var(--error-600);
                }
                .exam-result-body {
                    padding: var(--space-4) var(--space-5);
                    border-top: 1px solid var(--border-color);
                    background: var(--bg-tertiary);
                }
                .result-toolbar {
                    display: flex;
                    gap: var(--space-3);
                    margin-bottom: var(--space-4);
                    flex-wrap: wrap;
                }
                .result-toolbar .search-box {
                    flex: 1;
                    min-width: 200px;
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    padding: var(--space-2) var(--space-3);
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                }
                .result-toolbar .search-box input {
                    border: none;
                    background: transparent;
                    outline: none;
                    flex: 1;
                    font-size: var(--font-size-sm);
                }
                .sort-controls {
                    display: flex;
                    gap: var(--space-2);
                    align-items: center;
                }
                .sort-controls select {
                    padding: var(--space-2) var(--space-3);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    background: var(--bg-secondary);
                    font-size: var(--font-size-sm);
                }
                .score-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 40px;
                    padding: var(--space-1) var(--space-2);
                    border-radius: var(--radius-md);
                    font-weight: var(--font-bold);
                }
                .score-badge.score-success {
                    background: var(--success-100);
                    color: var(--success-700);
                }
                .score-badge.score-warning {
                    background: var(--warning-100);
                    color: var(--warning-700);
                }
                .score-badge.score-error {
                    background: var(--error-100);
                    color: var(--error-700);
                }
                .action-buttons {
                    display: flex;
                    gap: var(--space-1);
                }
                .modal-sm {
                    max-width: 400px;
                }
                @media (max-width: 768px) {
                    .exam-result-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: var(--space-3);
                    }
                    .exam-result-meta {
                        width: 100%;
                        justify-content: space-between;
                        flex-wrap: wrap;
                    }
                }
            `}</style>
        </DashboardLayout>
    )
}

export default NilaiUASPage
