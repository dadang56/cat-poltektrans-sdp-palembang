import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { hasilUjianService, soalService, jadwalService, matkulService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    CheckSquare,
    Clock,
    Users,
    AlertTriangle,
    CheckCircle,
    X,
    Save,
    ChevronRight,
    Edit2,
    Eye,
    FileText
} from 'lucide-react'
import '../admin/Dashboard.css'

// Data kosong - akan diisi dari data nyata
const EXAMS_TO_CORRECT = []
const STUDENT_ANSWERS = []
const QUESTIONS = []

function CorrectionModal({ isOpen, onClose, student, questions, onSave }) {
    const [answers, setAnswers] = useState(student?.answers || [])

    // Reset answers when student changes
    useEffect(() => {
        if (student?.answers) {
            setAnswers(student.answers)
        }
    }, [student])

    const handlePointChange = (index, points) => {
        const newAnswers = [...answers]
        newAnswers[index] = { ...newAnswers[index], earnedPoints: Math.min(points, newAnswers[index].maxPoints) }
        setAnswers(newAnswers)
    }

    const handleSave = () => {
        const totalScore = answers.reduce((sum, a) => sum + (a.earnedPoints || 0), 0)
        onSave({ ...student, answers, totalScore })
        onClose()
    }

    if (!isOpen || !student) return null

    // Calculate current total and max points
    const currentTotal = answers.reduce((sum, a) => sum + (a.earnedPoints || 0), 0)
    const maxTotal = answers.reduce((sum, a) => sum + (a.maxPoints || 0), 0)

    // Get essay questions that need grading
    const essayAnswers = answers
        .map((a, idx) => ({ ...a, originalIndex: idx }))
        .filter(a => a.type === 'essay')

    // Get all auto-graded answers
    const autoGradedAnswers = answers
        .map((a, idx) => ({ ...a, originalIndex: idx }))
        .filter(a => a.type !== 'essay')

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h3>Koreksi Jawaban</h3>
                        <p className="modal-subtitle">{student.studentName} - {student.nim}</p>
                    </div>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body correction-body-simple" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    {/* Auto-graded answers summary */}
                    {autoGradedAnswers.length > 0 && (
                        <div className="auto-graded-section">
                            <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
                                Soal Pilihan Ganda / Benar-Salah ({autoGradedAnswers.length} soal)
                            </h4>
                            <div className="answer-summary-grid">
                                {autoGradedAnswers.map((answer, idx) => {
                                    const question = questions.find(q => q.id === answer.questionId)
                                    const isCorrect = answer.isCorrect
                                    return (
                                        <div key={idx} className={`answer-summary-item ${isCorrect ? 'correct' : 'incorrect'}`}>
                                            <div className="answer-summary-header">
                                                <span className="answer-summary-num">Soal {answer.originalIndex + 1}</span>
                                                <span className={`answer-summary-badge ${isCorrect ? 'correct' : 'incorrect'}`}>
                                                    {isCorrect ? '✓ Benar' : '✗ Salah'}
                                                </span>
                                            </div>
                                            <p className="answer-summary-question">{question?.text?.substring(0, 100) || 'Soal tidak ditemukan'}...</p>
                                            <div className="answer-summary-detail">
                                                <span>Jawaban: <strong>{answer.type === 'pilihan_ganda' ? String.fromCharCode(65 + (answer.answer || 0)) : (answer.answer === true ? 'Benar' : 'Salah')}</strong></span>
                                                <span>Nilai: <strong>{answer.earnedPoints || 0}/{answer.maxPoints}</strong></span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Essay grading section */}
                    {essayAnswers.length > 0 ? (
                        <div className="essay-section" style={{ marginTop: '20px' }}>
                            <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
                                Soal Essay - Perlu Dikoreksi Manual ({essayAnswers.length} soal)
                            </h4>
                            <div className="essay-grading-list">
                                {essayAnswers.map((answer, idx) => {
                                    const question = questions.find(q => q.id === answer.questionId)
                                    return (
                                        <div key={idx} className="essay-grading-item">
                                            <div className="essay-q-header">
                                                <span className="essay-q-label">Soal Essay {idx + 1}</span>
                                                <span className="essay-max-points">Maks: {answer.maxPoints} poin</span>
                                            </div>
                                            <p className="essay-question-text">{question?.text || 'Soal tidak ditemukan'}</p>
                                            <div className="essay-answer-box">
                                                <strong>Jawaban:</strong>
                                                <p>{answer.answer || '(Tidak dijawab)'}</p>
                                            </div>
                                            <div className="essay-score-input">
                                                <label>Nilai:</label>
                                                <input
                                                    type="number"
                                                    className="form-input points-input-simple"
                                                    value={answer.earnedPoints ?? ''}
                                                    onChange={e => handlePointChange(answer.originalIndex, parseInt(e.target.value) || 0)}
                                                    min={0}
                                                    max={answer.maxPoints}
                                                    placeholder="0"
                                                />
                                                <span className="points-max-label">/ {answer.maxPoints}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="no-essay-message" style={{ marginTop: autoGradedAnswers.length > 0 ? '20px' : '0' }}>
                            <p>Tidak ada soal essay yang perlu dikoreksi manual.</p>
                            <p>Semua soal telah dikoreksi otomatis.</p>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <div className="total-score-simple">
                        Total: <strong className="score-value">{currentTotal}</strong> / {maxTotal}
                    </div>
                    <div className="modal-actions">
                        <button className="btn btn-ghost" onClick={onClose}>Batal</button>
                        <button className="btn btn-primary" onClick={handleSave}>
                            <Save size={16} />
                            Simpan Koreksi
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                .answer-summary-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: var(--space-3);
                }
                .answer-summary-item {
                    padding: var(--space-3);
                    border-radius: var(--radius-md);
                    border: 1px solid var(--border-color);
                    background: var(--bg-tertiary);
                }
                .answer-summary-item.correct {
                    border-left: 3px solid var(--success-500);
                }
                .answer-summary-item.incorrect {
                    border-left: 3px solid var(--error-500);
                }
                .answer-summary-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--space-2);
                }
                .answer-summary-num {
                    font-weight: var(--font-semibold);
                    font-size: var(--font-size-sm);
                }
                .answer-summary-badge {
                    font-size: var(--font-size-xs);
                    padding: 2px 8px;
                    border-radius: var(--radius-full);
                }
                .answer-summary-badge.correct {
                    background: var(--success-100);
                    color: var(--success-700);
                }
                .answer-summary-badge.incorrect {
                    background: var(--error-100);
                    color: var(--error-700);
                }
                .answer-summary-question {
                    font-size: var(--font-size-sm);
                    color: var(--text-secondary);
                    margin-bottom: var(--space-2);
                    line-height: 1.4;
                }
                .answer-summary-detail {
                    display: flex;
                    justify-content: space-between;
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
                .modal-lg {
                    max-width: 800px;
                }
            `}</style>
        </div>
    )
}

function KoreksiUjianPage() {
    const { user } = useAuth()
    const [examResults, setExamResults] = useState([])
    const [selectedExam, setSelectedExam] = useState(null)
    const [correctionModal, setCorrectionModal] = useState({ open: false, student: null })
    const [soalList, setSoalList] = useState([])
    const [loading, setLoading] = useState(true)

    // Load exam results from Supabase (with localStorage fallback)
    useEffect(() => {
        const loadData = async () => {
            try {
                if (isSupabaseConfigured()) {
                    // Load from Supabase
                    let hasilData = []

                    // If user is Dosen, use specialized fetch to respect RLS and Logic
                    if (user.role === 'dosen') {
                        console.log('[KoreksiUjian] Fetching for Dosen:', user.id)
                        hasilData = await hasilUjianService.getByDosen(user.id)
                    } else {
                        // Admin can see all
                        hasilData = await hasilUjianService.getAll()
                    }

                    const soalData = await soalService.getAll()

                    setSoalList(soalData)

                    // Group results by jadwal (exam)
                    const examGroups = {}
                    hasilData.forEach(hasil => {
                        const jadwalId = hasil.jadwal_id
                        if (!jadwalId) return

                        const jadwal = hasil.jadwal
                        const mahasiswa = hasil.mahasiswa

                        if (!examGroups[jadwalId]) {
                            examGroups[jadwalId] = {
                                id: jadwalId,
                                name: `${jadwal?.tipe || 'Ujian'} ${jadwal?.matkul?.nama || 'Mata Kuliah'}`,
                                matkul: jadwal?.matkul?.nama || 'N/A',
                                date: jadwal?.tanggal || 'N/A',
                                deadline: jadwal?.tanggal ? new Date(new Date(jadwal.tanggal).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : 'N/A',
                                students: [],
                                totalStudents: 0,
                                corrected: 0,
                                status: 'in_progress'
                            }
                        }

                        // Parse answers_detail if exists
                        let answers = []
                        try {
                            if (hasil.answers_detail) {
                                answers = typeof hasil.answers_detail === 'string'
                                    ? JSON.parse(hasil.answers_detail)
                                    : hasil.answers_detail
                            }
                        } catch (e) {
                            console.error('Error parsing answers:', e)
                        }

                        const isFullyCorrected = hasil.status === 'graded'

                        examGroups[jadwalId].students.push({
                            id: hasil.id,
                            resultId: hasil.id,
                            studentName: mahasiswa?.nama || 'N/A',
                            nim: mahasiswa?.nim_nip || 'N/A',
                            submittedAt: hasil.waktu_selesai ? new Date(hasil.waktu_selesai).toLocaleString('id-ID') : 'N/A',
                            answers: answers,
                            totalScore: hasil.nilai_total,
                            maxScore: answers.reduce((sum, a) => sum + (a.maxPoints || 0), 0) || 100,
                            hasEssay: answers.some(a => a.type === 'essay'),
                            isFullyCorrected
                        })

                        examGroups[jadwalId].totalStudents = examGroups[jadwalId].students.length
                        examGroups[jadwalId].corrected = examGroups[jadwalId].students.filter(s => s.isFullyCorrected).length
                    })

                    setExamResults(Object.values(examGroups))
                    console.log('[KoreksiUjian] Loaded', Object.keys(examGroups).length, 'exams from Supabase')
                } else {
                    // Fallback to localStorage
                    loadFromLocalStorage()
                }
            } catch (error) {
                console.error('[KoreksiUjian] Error loading from Supabase:', error)
                // Fallback to localStorage
                loadFromLocalStorage()
            }
            setLoading(false)
        }

        const loadFromLocalStorage = () => {
            const EXAM_RESULTS_KEY = 'cat_exam_results'
            const SOAL_KEY = 'cat_soal_data'
            const JADWAL_KEY = 'cat_jadwal_data'
            const MATKUL_KEY = 'cat_matkul_data'

            const results = JSON.parse(localStorage.getItem(EXAM_RESULTS_KEY) || '[]')
            const soal = JSON.parse(localStorage.getItem(SOAL_KEY) || '[]')
            const jadwal = JSON.parse(localStorage.getItem(JADWAL_KEY) || '[]')
            const matkul = JSON.parse(localStorage.getItem(MATKUL_KEY) || '[]')

            setSoalList(soal)

            const examGroups = {}
            results.forEach(result => {
                const examJadwal = jadwal.find(j => j.id === result.examId)

                if (!examGroups[result.examId]) {
                    const mk = examJadwal ? matkul.find(m => m.id === examJadwal.matkulId) : null
                    examGroups[result.examId] = {
                        id: result.examId,
                        name: result.examName || `Ujian ${result.examId}`,
                        matkul: mk?.nama || result.matkulName || 'N/A',
                        date: examJadwal?.tanggal || 'N/A',
                        deadline: examJadwal ? new Date(new Date(examJadwal.tanggal).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : 'N/A',
                        students: [],
                        totalStudents: 0,
                        corrected: 0,
                        status: 'in_progress'
                    }
                }

                examGroups[result.examId].students.push({
                    id: result.id,
                    resultId: result.id,
                    studentName: result.mahasiswaName,
                    nim: result.nim,
                    submittedAt: result.submittedAtDisplay || new Date(result.submittedAt).toLocaleString('id-ID'),
                    answers: result.answers,
                    totalScore: result.isFullyCorrected ? result.totalScore : null,
                    maxScore: result.maxScore,
                    hasEssay: result.hasEssay,
                    isFullyCorrected: result.isFullyCorrected
                })

                examGroups[result.examId].totalStudents = examGroups[result.examId].students.length
                examGroups[result.examId].corrected = examGroups[result.examId].students.filter(s => s.isFullyCorrected).length
            })

            setExamResults(Object.values(examGroups))
        }

        loadData()
    }, [])

    const handleSelectExam = (exam) => {
        setSelectedExam(exam)
    }

    const handleOpenCorrection = (student) => {
        setCorrectionModal({ open: true, student })
    }

    const handleSaveCorrection = async (updatedStudent) => {
        try {
            // 1. Update in Supabase
            if (isSupabaseConfigured()) {
                await hasilUjianService.update(updatedStudent.resultId, {
                    nilai_total: Number(updatedStudent.totalScore),
                    answers_detail: updatedStudent.answers, // Send object directly (Supabase handles JSON)
                    status: 'graded'
                })
                console.log('Saved correction to Supabase')
            }

            // 2. Update student in state
            const updatedStudents = selectedExam.students.map(s =>
                s.id === updatedStudent.id ? updatedStudent : s
            )
            setSelectedExam({ ...selectedExam, students: updatedStudents })

            // 3. Update in examResults
            setExamResults(prev => prev.map(exam =>
                exam.id === selectedExam.id
                    ? { ...exam, students: updatedStudents, corrected: updatedStudents.filter(s => s.totalScore !== null).length }
                    : exam
            ))

            // 4. Save back to localStorage (Backup/Sync)
            const EXAM_RESULTS_KEY = 'cat_exam_results'
            const existingResults = JSON.parse(localStorage.getItem(EXAM_RESULTS_KEY) || '[]')
            const updatedResults = existingResults.map(r => {
                if (r.id === updatedStudent.resultId) {
                    return {
                        ...r,
                        answers: updatedStudent.answers,
                        totalScore: updatedStudent.totalScore,
                        isFullyCorrected: true
                    }
                }
                return r
            })
            localStorage.setItem(EXAM_RESULTS_KEY, JSON.stringify(updatedResults))

        } catch (error) {
            console.error('Failed to save correction:', error)
            alert('Gagal menyimpan nilai ke database. Periksa koneksi internet Anda.')
        }
    }

    const getDaysRemaining = (deadline) => {
        const today = new Date()
        const deadlineDate = new Date(deadline)
        const diff = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24))
        return diff
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'completed':
                return <span className="badge badge-success">Selesai</span>
            case 'in_progress':
                return <span className="badge badge-warning">Berlangsung</span>
            default:
                return <span className="badge badge-info">Pending</span>
        }
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Koreksi Ujian</h1>
                        <p className="page-subtitle">Koreksi jawaban ujian mahasiswa</p>
                    </div>
                </div>

                {!selectedExam ? (
                    <>
                        {/* Exam List */}
                        <div className="card">
                            <div className="card-header">
                                <h3>Ujian Perlu Dikoreksi</h3>
                            </div>
                            <div className="card-body">
                                {examResults.length === 0 ? (
                                    <div className="text-center" style={{ padding: '48px', opacity: 0.6 }}>
                                        <FileText size={48} style={{ marginBottom: '16px' }} />
                                        <h4 style={{ margin: '0 0 8px' }}>Tidak Ada Ujian</h4>
                                        <p style={{ margin: 0 }}>Belum ada ujian yang perlu dikoreksi saat ini.</p>
                                    </div>
                                ) : (
                                    <div className="exam-list">
                                        {examResults.map(exam => {
                                            const daysRemaining = getDaysRemaining(exam.deadline)
                                            const isUrgent = daysRemaining <= 2 && exam.status !== 'completed'
                                            return (
                                                <div
                                                    key={exam.id}
                                                    className={`exam-item ${isUrgent ? 'urgent' : ''}`}
                                                    onClick={() => handleSelectExam(exam)}
                                                >
                                                    <div className="exam-info">
                                                        <h4>{exam.name}</h4>
                                                        <p>{exam.matkul} - Kelas {exam.kelas}</p>
                                                        <p className="exam-date">Tanggal: {exam.date}</p>
                                                    </div>
                                                    <div className="exam-meta">
                                                        {getStatusBadge(exam.status)}
                                                        <div className="correction-progress">
                                                            <div className="progress-bar-container">
                                                                <div
                                                                    className="progress-bar-fill"
                                                                    style={{ width: `${(exam.corrected / exam.totalStudents) * 100}%` }}
                                                                />
                                                            </div>
                                                            <span>{exam.corrected}/{exam.totalStudents}</span>
                                                        </div>
                                                        <div className={`deadline ${isUrgent ? 'urgent' : ''}`}>
                                                            <Clock size={14} />
                                                            {daysRemaining > 0 ? (
                                                                <span>{daysRemaining} hari lagi</span>
                                                            ) : daysRemaining === 0 ? (
                                                                <span>Hari ini!</span>
                                                            ) : (
                                                                <span className="overdue">Terlambat {Math.abs(daysRemaining)} hari</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <ChevronRight size={20} className="chevron" />
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Back Button */}
                        <button
                            className="btn btn-ghost mb-4"
                            onClick={() => setSelectedExam(null)}
                        >
                            ← Kembali ke Daftar Ujian
                        </button>

                        {/* Exam Header */}
                        <div className="exam-detail-header card mb-4">
                            <div className="card-body">
                                <div className="exam-detail-info">
                                    <h2>{selectedExam.name}</h2>
                                    <p>{selectedExam.matkul} - Kelas {selectedExam.kelas}</p>
                                </div>
                                <div className="exam-detail-stats">
                                    <div className="stat-item">
                                        <Users size={18} />
                                        <span>{selectedExam.totalStudents} Peserta</span>
                                    </div>
                                    <div className="stat-item">
                                        <CheckSquare size={18} />
                                        <span>{selectedExam.corrected} Terkoreksi</span>
                                    </div>
                                    <div className="stat-item">
                                        <Clock size={18} />
                                        <span>Deadline: {selectedExam.deadline}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Student List */}
                        <div className="card">
                            <div className="card-header">
                                <h3>Daftar Jawaban Mahasiswa</h3>
                            </div>
                            <div className="card-body">
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>No</th>
                                                <th>Nama</th>
                                                <th>NIM</th>
                                                <th>Submit</th>
                                                <th>Status</th>
                                                <th>Nilai</th>
                                                <th>Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedExam.students.map((student, index) => {
                                                const hasEssayPending = student.answers.some(a => a.type === 'essay' && a.earnedPoints === null)
                                                return (
                                                    <tr key={student.id}>
                                                        <td>{index + 1}</td>
                                                        <td className="font-medium">{student.studentName}</td>
                                                        <td>{student.nim}</td>
                                                        <td className="text-muted">{student.submittedAt}</td>
                                                        <td>
                                                            {student.totalScore !== null ? (
                                                                <span className="badge badge-success">Selesai</span>
                                                            ) : hasEssayPending ? (
                                                                <span className="badge badge-warning">Essay Pending</span>
                                                            ) : (
                                                                <span className="badge badge-info">Auto-corrected</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {student.totalScore !== null ? (
                                                                <span className="score-badge">{student.totalScore}</span>
                                                            ) : (
                                                                <span className="text-muted">-</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="btn btn-primary btn-sm"
                                                                onClick={() => handleOpenCorrection(student)}
                                                            >
                                                                {student.totalScore !== null ? (
                                                                    <>
                                                                        <Eye size={14} />
                                                                        Lihat
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Edit2 size={14} />
                                                                        Koreksi
                                                                    </>
                                                                )}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <CorrectionModal
                    isOpen={correctionModal.open}
                    onClose={() => setCorrectionModal({ open: false, student: null })}
                    student={correctionModal.student}
                    questions={soalList}
                    onSave={handleSaveCorrection}
                />
            </div>

            <style>{`
                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    flex-wrap: wrap;
                    gap: var(--space-4);
                    margin-bottom: var(--space-6);
                }
                .card-header {
                    padding: var(--space-4) var(--space-5);
                    border-bottom: 1px solid var(--border-color);
                }
                .card-header h3 {
                    margin: 0;
                    font-size: var(--font-size-lg);
                }
                .exam-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3);
                }
                .exam-item {
                    display: flex;
                    align-items: center;
                    gap: var(--space-4);
                    padding: var(--space-4);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-lg);
                    border: 2px solid transparent;
                    cursor: pointer;
                    transition: all var(--transition-fast);
                }
                .exam-item:hover {
                    border-color: var(--primary-300);
                }
                .exam-item.urgent {
                    border-color: var(--warning-300);
                    background: var(--warning-50);
                }
                .exam-info {
                    flex: 1;
                }
                .exam-info h4 {
                    margin: 0 0 var(--space-1);
                    font-size: var(--font-size-base);
                }
                .exam-info p {
                    margin: 0;
                    font-size: var(--font-size-sm);
                    color: var(--text-secondary);
                }
                .exam-date {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
                .exam-meta {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2);
                    align-items: flex-end;
                }
                .correction-progress {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    font-size: var(--font-size-xs);
                }
                .progress-bar-container {
                    width: 60px;
                    height: 6px;
                    background: var(--border-color);
                    border-radius: 3px;
                    overflow: hidden;
                }
                .progress-bar-fill {
                    height: 100%;
                    background: var(--primary-500);
                    border-radius: 3px;
                }
                .deadline {
                    display: flex;
                    align-items: center;
                    gap: var(--space-1);
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
                .deadline.urgent {
                    color: var(--warning-600);
                }
                .deadline .overdue {
                    color: var(--error-500);
                }
                .chevron {
                    color: var(--text-muted);
                }
                .mb-4 {
                    margin-bottom: var(--space-4);
                }
                .exam-detail-header .card-body {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: var(--space-4);
                }
                .exam-detail-info h2 {
                    margin: 0 0 var(--space-1);
                }
                .exam-detail-info p {
                    margin: 0;
                    color: var(--text-secondary);
                }
                .exam-detail-stats {
                    display: flex;
                    gap: var(--space-4);
                }
                .stat-item {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    padding: var(--space-2) var(--space-4);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-md);
                    font-size: var(--font-size-sm);
                }
                .score-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 36px;
                    padding: var(--space-1) var(--space-2);
                    background: var(--success-100);
                    color: var(--success-700);
                    font-weight: var(--font-bold);
                    border-radius: var(--radius-md);
                }
                .modal-xl {
                    max-width: 900px;
                    max-height: 90vh;
                }
                .modal-subtitle {
                    margin: var(--space-1) 0 0;
                    font-size: var(--font-size-sm);
                    color: var(--text-muted);
                }
                .correction-body {
                    max-height: 60vh;
                    overflow-y: auto;
                }
                .correction-item {
                    padding: var(--space-4);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-lg);
                    margin-bottom: var(--space-4);
                    position: relative;
                }
                .correction-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--space-3);
                }
                .correction-q-info {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                }
                .q-number {
                    font-weight: var(--font-bold);
                    color: var(--text-secondary);
                }
                .correction-points {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                }
                .points-input {
                    width: 60px;
                    padding: var(--space-2);
                    border: 2px solid var(--border-color);
                    border-radius: var(--radius-md);
                    font-size: var(--font-size-base);
                    font-weight: var(--font-bold);
                    text-align: center;
                }
                .points-input:focus {
                    border-color: var(--primary-500);
                    outline: none;
                }
                .max-points {
                    font-size: var(--font-size-sm);
                    color: var(--text-muted);
                }
                .correction-question {
                    font-weight: var(--font-medium);
                    margin-bottom: var(--space-3);
                }
                .correction-answer {
                    padding: var(--space-3);
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                }
                .answer-label {
                    display: block;
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                    margin-bottom: var(--space-2);
                }
                .answer-content {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-1);
                }
                .answer-content .correct {
                    color: var(--success-600);
                }
                .answer-content .incorrect {
                    color: var(--error-600);
                }
                .correct-answer {
                    font-size: var(--font-size-sm);
                    color: var(--success-600);
                    font-style: italic;
                }
                .essay-answer {
                    padding: var(--space-3);
                    background: white;
                    border-radius: var(--radius-md);
                    border: 1px solid var(--border-color);
                }
                .essay-answer p {
                    margin: 0;
                    line-height: 1.6;
                }
                .matching-answer {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2);
                }
                .match-item {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    font-size: var(--font-size-sm);
                }
                .match-item .correct {
                    color: var(--success-600);
                }
                .match-item .incorrect {
                    color: var(--error-600);
                }
                .auto-correct-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: var(--space-1);
                    position: absolute;
                    top: var(--space-3);
                    right: var(--space-3);
                    font-size: var(--font-size-xs);
                    color: var(--success-600);
                    background: var(--success-50);
                    padding: var(--space-1) var(--space-2);
                    border-radius: var(--radius-full);
                }
                .modal-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .total-score {
                    font-size: var(--font-size-lg);
                }
                .total-score strong {
                    color: var(--primary-600);
                }
                .modal-actions {
                    display: flex;
                    gap: var(--space-2);
                }
                /* Simplified Essay Grading Styles */
                .correction-body-simple {
                    padding: var(--space-4);
                    max-height: 60vh;
                    overflow-y: auto;
                }
                .essay-grading-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4);
                }
                .essay-grading-item {
                    background: var(--gray-50);
                    border: 1px solid var(--gray-200);
                    border-radius: var(--radius-lg);
                    padding: var(--space-4);
                }
                .essay-q-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--space-2);
                }
                .essay-q-label {
                    font-weight: 600;
                    color: var(--primary-600);
                }
                .essay-max-points {
                    font-size: var(--font-size-sm);
                    color: var(--accent-600);
                    font-weight: 500;
                    background: var(--accent-50);
                    padding: var(--space-1) var(--space-2);
                    border-radius: var(--radius-full);
                }
                .essay-question-text {
                    font-size: var(--font-size-sm);
                    color: var(--gray-700);
                    margin-bottom: var(--space-3);
                    line-height: 1.5;
                }
                .essay-answer-box {
                    background: white;
                    border: 1px solid var(--gray-200);
                    border-radius: var(--radius-md);
                    padding: var(--space-3);
                    margin-bottom: var(--space-3);
                }
                .essay-answer-box strong {
                    font-size: var(--font-size-sm);
                    color: var(--gray-500);
                    display: block;
                    margin-bottom: var(--space-1);
                }
                .essay-answer-box p {
                    font-size: var(--font-size-sm);
                    color: var(--gray-800);
                    line-height: 1.6;
                }
                .essay-score-input {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                }
                .essay-score-input label {
                    font-weight: 500;
                    font-size: var(--font-size-sm);
                    color: var(--gray-600);
                }
                .points-input-simple {
                    width: 80px;
                    text-align: center;
                    font-weight: 600;
                    font-size: var(--font-size-lg);
                }
                .points-max-label {
                    font-size: var(--font-size-sm);
                    color: var(--gray-500);
                }
                .no-essay-message {
                    text-align: center;
                    padding: var(--space-8);
                    color: var(--gray-500);
                }
                .no-essay-message p {
                    margin: var(--space-1) 0;
                }
                .total-score-simple {
                    font-size: var(--font-size-lg);
                    display: flex;
                    align-items: center;
                    gap: var(--space-1);
                }
                .total-score-simple .score-value {
                    color: var(--primary-600);
                    font-size: var(--font-size-xl);
                }
                @media (max-width: 768px) {
                    .exam-item {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    .exam-meta {
                        align-items: flex-start;
                    }
                    .exam-detail-stats {
                        flex-wrap: wrap;
                    }
                }
            `}</style>
        </DashboardLayout>
    )
}

export default KoreksiUjianPage
