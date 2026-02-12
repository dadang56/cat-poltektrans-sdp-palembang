import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { jadwalService, matkulService, kelasService, userService, soalService, ruangService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    ClipboardList,
    Calendar,
    Clock,
    Users,
    MapPin,
    ArrowRight,
    AlertCircle,
    CheckCircle,
    Timer,
    X,
    BookOpen,
    FileText
} from 'lucide-react'
import '../admin/Dashboard.css'

const JADWAL_STORAGE_KEY = 'cat_jadwal_data'
const MATKUL_STORAGE_KEY = 'cat_matkul_data'
const KELAS_STORAGE_KEY = 'cat_kelas_data'
const USERS_STORAGE_KEY = 'cat_users'
const SOAL_STORAGE_KEY = 'cat_soal_data'

// Helper for field compatibility (Supabase snake_case vs localStorage camelCase)
const getField = (obj, snakeCase, camelCase) => obj?.[snakeCase] || obj?.[camelCase]

// Modal konfirmasi ujian
function ConfirmExamModal({ isOpen, onClose, exam, onStart }) {
    if (!isOpen || !exam) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-md" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h3>Konfirmasi Mulai Ujian</h3>
                        <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                            Pastikan Anda siap sebelum memulai
                        </p>
                    </div>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body">
                    <div className="confirm-exam-info">
                        <div className="confirm-exam-header">
                            <span className={`badge badge-${exam.tipeUjian === 'UTS' ? 'primary' : exam.tipeUjian === 'UAS' ? 'error' : 'accent'}`}>
                                {exam.tipeUjian}
                            </span>
                            <h2>{exam.namaUjian}</h2>
                            <p>{exam.matkulName}</p>
                        </div>

                        <div className="confirm-exam-details">
                            <div className="confirm-detail-item">
                                <BookOpen size={20} />
                                <div>
                                    <span className="detail-label">Dosen Pengampu</span>
                                    <span className="detail-value">{exam.dosenName || '-'}</span>
                                </div>
                            </div>
                            <div className="confirm-detail-item">
                                <Clock size={20} />
                                <div>
                                    <span className="detail-label">Durasi Waktu</span>
                                    <span className="detail-value">{exam.durasi} menit</span>
                                </div>
                            </div>
                            <div className="confirm-detail-item">
                                <FileText size={20} />
                                <div>
                                    <span className="detail-label">Jumlah Soal</span>
                                    <span className="detail-value">{exam.jumlahSoal || '-'} soal</span>
                                </div>
                            </div>
                            <div className="confirm-detail-item">
                                <MapPin size={20} />
                                <div>
                                    <span className="detail-label">Ruangan</span>
                                    <span className="detail-value">{exam.ruang || '-'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="confirm-warning">
                            <AlertCircle size={20} />
                            <div>
                                <strong>Perhatian!</strong>
                                <p>Timer akan mulai berjalan setelah Anda menekan tombol "Mulai Ujian". Pastikan koneksi internet stabil dan Anda siap mengerjakan ujian.</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Batal</button>
                    <button className="btn btn-primary" onClick={() => onStart(exam)}>
                        <Timer size={16} />
                        Mulai Ujian Sekarang
                    </button>
                </div>
            </div>

            <style>{`
                .confirm-exam-info {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4);
                }
                .confirm-exam-header {
                    text-align: center;
                    padding-bottom: var(--space-4);
                    border-bottom: 1px solid var(--border-color);
                }
                .confirm-exam-header h2 {
                    margin: var(--space-2) 0 var(--space-1);
                    font-size: var(--font-size-xl);
                }
                .confirm-exam-header p {
                    margin: 0;
                    color: var(--text-secondary);
                }
                .confirm-exam-details {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: var(--space-3);
                }
                .confirm-detail-item {
                    display: flex;
                    align-items: flex-start;
                    gap: var(--space-3);
                    padding: var(--space-3);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-md);
                }
                .confirm-detail-item svg {
                    color: var(--primary-500);
                    flex-shrink: 0;
                }
                .confirm-detail-item > div {
                    display: flex;
                    flex-direction: column;
                }
                .confirm-detail-item .detail-label {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
                .confirm-detail-item .detail-value {
                    font-weight: var(--font-medium);
                }
                .confirm-warning {
                    display: flex;
                    gap: var(--space-3);
                    padding: var(--space-4);
                    background: var(--warning-50);
                    border: 1px solid var(--warning-200);
                    border-radius: var(--radius-md);
                }
                [data-theme="dark"] .confirm-warning {
                    background: rgba(245, 158, 11, 0.1);
                    border-color: rgba(245, 158, 11, 0.3);
                }
                .confirm-warning svg {
                    color: var(--warning-600);
                    flex-shrink: 0;
                }
                .confirm-warning strong {
                    color: var(--warning-700);
                    display: block;
                    margin-bottom: var(--space-1);
                }
                .confirm-warning p {
                    margin: 0;
                    font-size: var(--font-size-sm);
                    color: var(--text-secondary);
                }
                @media (max-width: 640px) {
                    .confirm-exam-details {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    )
}

function UjianPage() {
    const { user } = useAuth()
    const navigate = useNavigate()

    // Load data from Supabase or localStorage
    const [jadwalList, setJadwalList] = useState([])
    const [matkulList, setMatkulList] = useState([])
    const [kelasList, setKelasList] = useState([])
    const [usersList, setUsersList] = useState([])
    const [soalList, setSoalList] = useState([])
    const [ruangList, setRuangList] = useState([])
    const [confirmModal, setConfirmModal] = useState({ open: false, exam: null })

    useEffect(() => {
        const loadData = async () => {
            try {
                if (isSupabaseConfigured()) {
                    const [jadwal, matkul, kelas, users, soal, ruang] = await Promise.all([
                        jadwalService.getAll(),
                        matkulService.getAll(),
                        kelasService.getAll(),
                        userService.getAll({ role: 'dosen' }),
                        soalService.getAll(),
                        ruangService.getAll()
                    ])
                    setJadwalList(jadwal)
                    setMatkulList(matkul)
                    setKelasList(kelas)
                    setUsersList(users)
                    setSoalList(soal)
                    setRuangList(ruang)
                } else {
                    const jadwal = localStorage.getItem(JADWAL_STORAGE_KEY)
                    const matkul = localStorage.getItem(MATKUL_STORAGE_KEY)
                    const kelas = localStorage.getItem(KELAS_STORAGE_KEY)
                    const users = localStorage.getItem(USERS_STORAGE_KEY)
                    const soal = localStorage.getItem(SOAL_STORAGE_KEY)
                    if (jadwal) setJadwalList(JSON.parse(jadwal))
                    if (matkul) setMatkulList(JSON.parse(matkul))
                    if (kelas) setKelasList(JSON.parse(kelas))
                    if (users) setUsersList(JSON.parse(users))
                    if (soal) setSoalList(JSON.parse(soal))
                }
            } catch (err) {
                console.error('[UjianMendatang] Error loading data:', err)
                // Fallback to localStorage
                const jadwal = localStorage.getItem(JADWAL_STORAGE_KEY)
                const matkul = localStorage.getItem(MATKUL_STORAGE_KEY)
                const kelas = localStorage.getItem(KELAS_STORAGE_KEY)
                const users = localStorage.getItem(USERS_STORAGE_KEY)
                const soal = localStorage.getItem(SOAL_STORAGE_KEY)
                if (jadwal) setJadwalList(JSON.parse(jadwal))
                if (matkul) setMatkulList(JSON.parse(matkul))
                if (kelas) setKelasList(JSON.parse(kelas))
                if (users) setUsersList(JSON.parse(users))
                if (soal) setSoalList(JSON.parse(soal))
            }
        }
        loadData()
    }, [])

    // Get mahasiswa's kelas
    const mahasiswaKelasId = user?.kelasId || user?.kelas_id
    const now = new Date()
    const oneDayMs = 24 * 60 * 60 * 1000

    // Load exam results to check completed exams
    const examResultsData = localStorage.getItem('cat_exam_results')
    const examResults = examResultsData ? JSON.parse(examResultsData) : []

    // Filter jadwal for this mahasiswa's kelas, hide expired more than 1 day
    const exams = jadwalList
        .filter(j => {
            // Must match kelas
            const jKelasId = getField(j, 'kelas_id', 'kelasId')
            if (jKelasId !== mahasiswaKelasId) return false
            // Hide exams expired more than 1 day ago
            const waktuSelesai = getField(j, 'waktu_selesai', 'waktuSelesai')
            const examEnd = new Date(`${j.tanggal}T${waktuSelesai}`)
            if ((now - examEnd) > oneDayMs) return false
            return true
        })
        .map(j => {
            // Use nested relations from Supabase or fallback to lookup
            const matkulId = getField(j, 'matkul_id', 'matkulId')
            const matkul = j.matkul || matkulList.find(m => m.id === matkulId)
            const kelasId = getField(j, 'kelas_id', 'kelasId')
            const kelas = j.kelas || kelasList.find(k => k.id === kelasId)
            const ruanganId = getField(j, 'ruangan_id', 'ruanganId')
            const ruangan = j.ruangan || ruangList.find(r => r.id === ruanganId)

            // Get dosen from nested relation (Supabase) or fallback
            const dosenId = getField(j, 'dosen_id', 'dosenId')
            const dosen = j.dosen || usersList.find(u => u.id === dosenId)

            // Calculate duration from waktuMulai and waktuSelesai
            const waktuMulai = getField(j, 'waktu_mulai', 'waktuMulai')
            const waktuSelesai = getField(j, 'waktu_selesai', 'waktuSelesai')
            const tipeUjian = j.tipe || getField(j, 'tipe_ujian', 'tipeUjian') || 'UTS'
            const startTime = new Date(`${j.tanggal}T${waktuMulai}`)
            const endTime = new Date(`${j.tanggal}T${waktuSelesai}`)
            const durasiMenit = Math.round((endTime - startTime) / 60000)

            // Count soal for this exam
            const examSoal = soalList.filter(s => {
                const sMatkulId = getField(s, 'matkul_id', 'matkulId')
                // Fix: Check 'tipe_ujian' (Supabase) or 'examType' (LocalStorage)
                // The 'exam_type' key was incorrect for Supabase data
                const sExamType = s.tipe_ujian || s.tipeUjian || s.examType
                return String(sMatkulId) === String(matkulId) &&
                    String(sExamType || '').toUpperCase() === String(tipeUjian).toUpperCase()
            })

            // Check if mahasiswa already completed this exam
            const alreadySubmitted = examResults.some(r =>
                String(r.examId) === String(j.id) && String(r.mahasiswaId) === String(user?.id)
            )

            // Dosen Name Resolution
            // Priority: 1. Nested relation, 2. Lookup by id, 3. Match by matkul_ids
            let finalDosenName = '-'
            if (j.dosen && j.dosen.nama) {
                finalDosenName = j.dosen.nama
            } else if (dosen && dosen.nama) {
                finalDosenName = dosen.nama
            } else if (dosenId) {
                const dosenMatch = usersList.find(u => String(u.id) === String(dosenId))
                if (dosenMatch) finalDosenName = dosenMatch.nama || dosenMatch.name || '-'
            }

            // Fallback: find dosen whose matkul_ids includes this exam's matkul_id
            if (finalDosenName === '-' && matkulId) {
                const dosenByMatkul = usersList.find(u => {
                    if (u.role !== 'dosen') return false
                    let ids = u.matkul_ids || []
                    if (typeof ids === 'string') {
                        try { ids = JSON.parse(ids) } catch { ids = [] }
                    }
                    return Array.isArray(ids) && ids.map(String).includes(String(matkulId))
                })
                if (dosenByMatkul) finalDosenName = dosenByMatkul.nama || dosenByMatkul.name || '-'
            }

            return {
                ...j,
                tipeUjian,
                matkulName: matkul?.nama || 'Mata Kuliah',
                dosenName: finalDosenName,
                kelasName: kelas?.nama || '-',
                ruang: ruangan?.nama || '-', // Use room name from ruang_ujian table
                // Calculate exam time
                date: j.tanggal,
                time: waktuMulai,
                endTime: waktuSelesai,
                completed: alreadySubmitted, // Check from exam results
                // Durasi dan jumlah soal
                durasi: j.durasi || durasiMenit,
                jumlahSoal: examSoal.length
            }
        })
        .sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date)
            return (a.time || '').localeCompare(b.time || '')
        })

    const getDaysUntil = (dateStr) => {
        const examDate = new Date(dateStr)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        examDate.setHours(0, 0, 0, 0)
        const diffTime = examDate - today
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    }

    const getExamStatus = (exam) => {
        if (exam.completed) return 'completed'
        const now = new Date()
        const examStart = new Date(`${exam.date}T${exam.time}`)
        const examEnd = new Date(`${exam.date}T${exam.endTime}`)

        if (now >= examStart && now <= examEnd) return 'active'
        if (now > examEnd) return 'expired'
        return 'upcoming'
    }

    const getStatusBadge = (exam) => {
        const status = getExamStatus(exam)
        if (status === 'completed') {
            return <span className="badge badge-success"><CheckCircle size={12} /> Sudah Dikerjakan</span>
        }
        if (status === 'active') {
            return <span className="badge badge-success"><Timer size={12} /> Sedang Berlangsung</span>
        }
        if (status === 'expired') {
            return <span className="badge badge-error"><AlertCircle size={12} /> Waktu Habis</span>
        }
        const days = getDaysUntil(exam.date)
        if (days === 0) {
            return <span className="badge badge-warning"><Clock size={12} /> Hari Ini</span>
        }
        if (days <= 3) {
            return <span className="badge badge-warning"><AlertCircle size={12} /> {days} Hari Lagi</span>
        }
        return <span className="badge badge-info"><Clock size={12} /> {days} Hari Lagi</span>
    }

    const handleOpenConfirm = (exam) => {
        setConfirmModal({ open: true, exam })
    }

    const handleStartExam = (exam) => {
        setConfirmModal({ open: false, exam: null })
        // Navigate with exam data
        navigate(`/mahasiswa/take-exam/${exam.id}`, { state: { exam } })
    }

    const renderButton = (exam) => {
        const status = getExamStatus(exam)

        if (status === 'completed') {
            return (
                <button className="btn btn-outline" disabled>
                    <CheckCircle size={18} />
                    Sudah Dikerjakan
                </button>
            )
        }
        if (status === 'active') {
            return (
                <button className="btn btn-primary" onClick={() => handleOpenConfirm(exam)}>
                    <Timer size={18} />
                    Mulai Ujian
                </button>
            )
        }
        if (status === 'expired') {
            return (
                <button className="btn btn-outline" disabled>
                    <AlertCircle size={18} />
                    Waktu Habis
                </button>
            )
        }
        return (
            <button className="btn btn-outline" disabled>
                <Clock size={18} />
                Belum Tersedia
            </button>
        )
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Jadwal Ujian</h1>
                        <p className="page-subtitle">Daftar ujian yang akan dan sedang Anda ikuti</p>
                    </div>
                </div>

                {/* Stats */}
                <div className="mini-stats">
                    <div className="mini-stat">
                        <span className="mini-stat-value">{exams.length}</span>
                        <span className="mini-stat-label">Total Ujian</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">
                            {exams.filter(e => getExamStatus(e) === 'active').length}
                        </span>
                        <span className="mini-stat-label">Aktif</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">
                            {exams.filter(e => e.tipeUjian === 'UTS').length}
                        </span>
                        <span className="mini-stat-label">UTS</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">
                            {exams.filter(e => e.tipeUjian === 'UAS').length}
                        </span>
                        <span className="mini-stat-label">UAS</span>
                    </div>
                </div>

                {/* Exam List */}
                <div className="exam-list">
                    {exams.length === 0 ? (
                        <div className="card">
                            <div className="card-body text-center" style={{ padding: '48px', opacity: 0.6 }}>
                                <ClipboardList size={48} style={{ marginBottom: '16px' }} />
                                <h4 style={{ margin: '0 0 8px' }}>Tidak ada ujian</h4>
                                <p style={{ margin: 0 }}>Belum ada jadwal ujian untuk kelas Anda saat ini.</p>
                            </div>
                        </div>
                    ) : exams.map(exam => {
                        const days = getDaysUntil(exam.date)
                        const status = getExamStatus(exam)
                        const isActive = status === 'active'
                        const isExpired = status === 'expired'

                        return (
                            <div
                                key={exam.id}
                                className={`exam-card-full ${isActive ? 'exam-today' : days <= 3 && !isExpired ? 'exam-soon' : ''}`}
                            >
                                <div className="exam-card-header">
                                    <div className="exam-badges">
                                        <span className={`badge badge-${exam.tipeUjian === 'UTS' ? 'primary' : exam.tipeUjian === 'UAS' ? 'error' : 'accent'}`}>
                                            {exam.tipeUjian}
                                        </span>
                                        {getStatusBadge(exam)}
                                    </div>
                                </div>

                                <div className="exam-card-body">
                                    <h3 className="exam-title">{exam.namaUjian}</h3>
                                    <p className="exam-matkul">{exam.matkulName} • {exam.dosenName}</p>

                                    <div className="exam-details-grid">
                                        <div className="exam-detail-item">
                                            <Calendar size={16} />
                                            <div>
                                                <span className="detail-label">Tanggal</span>
                                                <span className="detail-value">{new Date(exam.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                            </div>
                                        </div>
                                        <div className="exam-detail-item">
                                            <Clock size={16} />
                                            <div>
                                                <span className="detail-label">Waktu</span>
                                                <span className="detail-value">{exam.time} - {exam.endTime} ({exam.durasi} menit)</span>
                                            </div>
                                        </div>
                                        <div className="exam-detail-item">
                                            <MapPin size={16} />
                                            <div>
                                                <span className="detail-label">Ruang</span>
                                                <span className="detail-value">{exam.ruang || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="exam-detail-item">
                                            <ClipboardList size={16} />
                                            <div>
                                                <span className="detail-label">Jumlah Soal</span>
                                                <span className="detail-value">{exam.jumlahSoal || '-'} soal</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="exam-card-footer">
                                    {renderButton(exam)}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <ConfirmExamModal
                    isOpen={confirmModal.open}
                    onClose={() => setConfirmModal({ open: false, exam: null })}
                    exam={confirmModal.exam}
                    onStart={handleStartExam}
                />
            </div>

            <style>{`
                .exam-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4);
                }
                .exam-card-full {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-xl);
                    overflow: hidden;
                    transition: all var(--transition-normal);
                }
                .exam-card-full:hover {
                    box-shadow: var(--shadow-lg);
                    transform: translateY(-2px);
                }
                .exam-today {
                    border-color: var(--success-500);
                    background: linear-gradient(135deg, var(--success-50) 0%, var(--bg-secondary) 100%);
                }
                [data-theme="dark"] .exam-today {
                    background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, var(--bg-secondary) 100%);
                }
                .exam-soon {
                    border-color: var(--warning-500);
                    background: linear-gradient(135deg, var(--warning-50) 0%, var(--bg-secondary) 100%);
                }
                [data-theme="dark"] .exam-soon {
                    background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, var(--bg-secondary) 100%);
                }
                .exam-card-header {
                    padding: var(--space-4);
                    border-bottom: 1px solid var(--border-color);
                }
                .exam-badges {
                    display: flex;
                    gap: var(--space-2);
                }
                .exam-card-body {
                    padding: var(--space-4);
                }
                .exam-title {
                    font-size: var(--font-size-xl);
                    font-weight: var(--font-bold);
                    margin-bottom: var(--space-1);
                }
                .exam-matkul {
                    font-size: var(--font-size-sm);
                    color: var(--text-secondary);
                    margin-bottom: var(--space-4);
                }
                .exam-details-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: var(--space-3);
                    margin-bottom: var(--space-4);
                }
                .exam-detail-item {
                    display: flex;
                    align-items: flex-start;
                    gap: var(--space-2);
                    padding: var(--space-3);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-md);
                }
                .exam-detail-item svg {
                    color: var(--primary-500);
                    flex-shrink: 0;
                    margin-top: 2px;
                }
                .exam-detail-item > div {
                    display: flex;
                    flex-direction: column;
                }
                .detail-label {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                    text-transform: uppercase;
                }
                .detail-value {
                    font-size: var(--font-size-sm);
                    font-weight: var(--font-medium);
                }
                .exam-card-footer {
                    padding: var(--space-4);
                    background: var(--bg-tertiary);
                    border-top: 1px solid var(--border-color);
                }
                .exam-card-footer .btn {
                    width: 100%;
                }
            `}</style>
        </DashboardLayout>
    )
}

export default UjianPage
