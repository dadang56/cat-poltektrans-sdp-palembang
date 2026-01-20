import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useNavigate } from 'react-router-dom'
import { matkulService, jadwalService, soalService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    BookOpen,
    FileText,
    Users,
    PlusCircle,
    Clock,
    CheckCircle,
    AlertTriangle,
    ChevronRight,
    Award,
    Calendar
} from 'lucide-react'
import '../admin/Dashboard.css'

function DosenDashboard() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [matkulList, setMatkulList] = useState([])
    const [questionCount, setQuestionCount] = useState(0)
    const [examDeadlines, setExamDeadlines] = useState([])
    const [perluKoreksi, setPerluKoreksi] = useState(0)
    const [ujianSelesai, setUjianSelesai] = useState(0)

    // Load data from Supabase or localStorage
    useEffect(() => {
        const loadData = async () => {
            try {
                // Get matkulIds from logged-in user (stored from login)
                const catUser = JSON.parse(localStorage.getItem('cat_user') || '{}')

                // Parse matkul_ids - could be array or JSON string
                let dosenMatkulIds = []
                const matkulIdsSource = catUser.matkulIds || catUser.matkul_ids || []
                if (typeof matkulIdsSource === 'string') {
                    try {
                        dosenMatkulIds = JSON.parse(matkulIdsSource).map(id => String(id))
                    } catch {
                        dosenMatkulIds = []
                    }
                } else if (Array.isArray(matkulIdsSource)) {
                    dosenMatkulIds = matkulIdsSource.map(id => String(id))
                }

                console.log('[DosenDashboard] User matkulIds:', dosenMatkulIds)

                if (isSupabaseConfigured()) {
                    // Load from Supabase
                    const [allMatkul, allSoal] = await Promise.all([
                        matkulService.getAll(),
                        soalService.getAll({ dosen_id: catUser.id })
                    ])

                    // Filter mata kuliah by dosen's matkulIds
                    const filteredMatkul = dosenMatkulIds.length > 0
                        ? allMatkul.filter(m => dosenMatkulIds.includes(String(m.id)))
                        : []

                    console.log('[DosenDashboard] Filtered matkul:', filteredMatkul.length)
                    setMatkulList(filteredMatkul)

                    // Count soal for this dosen
                    const dosenSoal = allSoal.filter(s =>
                        dosenMatkulIds.includes(String(s.matkul_id)) &&
                        (String(s.dosen_id) === String(catUser.id))
                    )
                    setQuestionCount(dosenSoal.length)
                } else {
                    // Fallback to localStorage
                    const savedMatkul = localStorage.getItem('cat_matkul_data')
                    const savedSoal = localStorage.getItem('cat_soal_data')

                    if (savedMatkul) {
                        const allMatkul = JSON.parse(savedMatkul)
                        const filteredMatkul = dosenMatkulIds.length > 0
                            ? allMatkul.filter(m => dosenMatkulIds.includes(String(m.id)))
                            : []
                        setMatkulList(filteredMatkul)
                    }

                    if (savedSoal) {
                        const allSoal = JSON.parse(savedSoal)
                        const dosenSoal = allSoal.filter(s =>
                            dosenMatkulIds.includes(String(s.matkulId)) &&
                            (String(s.dosenId) === String(catUser.id) || s.dosenId === catUser.username)
                        )
                        setQuestionCount(dosenSoal.length)
                    }
                }

                // Load exam results and calculate deadlines (from localStorage for now)
                const savedResults = localStorage.getItem('cat_exam_results')
                const savedJadwal = localStorage.getItem('cat_jadwal_data')
                const savedMatkul = localStorage.getItem('cat_matkul_data')

                if (savedResults && savedJadwal && savedMatkul) {
                    const results = JSON.parse(savedResults)
                    const jadwal = JSON.parse(savedJadwal)
                    const matkul = JSON.parse(savedMatkul)

                    // Group results by examId
                    const examGroups = {}
                    results.forEach(r => {
                        const examJadwal = jadwal.find(j => j.id === r.examId)
                        if (!examJadwal) return

                        // Filter by dosen's matkul
                        if (dosenMatkulIds.length > 0 && !dosenMatkulIds.includes(String(examJadwal.matkulId))) return

                        if (!examGroups[r.examId]) {
                            const mk = matkul.find(m => m.id === examJadwal.matkulId)
                            examGroups[r.examId] = {
                                id: r.examId,
                                name: r.examName,
                                matkul: mk?.nama || r.matkulName,
                                deadline: examJadwal.deadlineKoreksi || new Date(new Date(examJadwal.tanggal).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                                totalStudents: 0,
                                corrected: 0
                            }
                        }
                        examGroups[r.examId].totalStudents++
                        if (r.isFullyCorrected) examGroups[r.examId].corrected++
                    })

                    // Calculate stats
                    const examsWithResults = Object.values(examGroups)
                    const needsCorrection = examsWithResults.filter(e => e.corrected < e.totalStudents)
                    const fullyGraded = examsWithResults.filter(e => e.corrected === e.totalStudents && e.totalStudents > 0)

                    setPerluKoreksi(needsCorrection.length)
                    setUjianSelesai(fullyGraded.length)
                    setExamDeadlines(needsCorrection.slice(0, 5))
                }
            } catch (err) {
                console.error('[DosenDashboard] Error loading data:', err)
            }
        }

        loadData()
    }, [user])

    // Stats dinamis
    const STATS = [
        { label: 'Mata Kuliah', value: matkulList.length.toString(), icon: BookOpen, color: 'primary' },
        { label: 'Total Soal', value: questionCount.toString(), icon: FileText, color: 'accent' },
        { label: 'Ujian Selesai', value: ujianSelesai.toString(), icon: CheckCircle, color: 'success' },
        { label: 'Perlu Koreksi', value: perluKoreksi.toString(), icon: Clock, color: 'warning' }
    ]

    const getDeadlineColor = (daysLeft) => {
        if (daysLeft <= 2) return 'urgent'
        if (daysLeft <= 4) return 'warning'
        return 'normal'
    }

    const getDaysLeft = (deadline) => {
        const today = new Date()
        const dl = new Date(deadline)
        return Math.ceil((dl - today) / (1000 * 60 * 60 * 24))
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <h1 className="page-title">Dashboard Dosen</h1>
                    <p className="page-subtitle">Selamat datang, {user?.name}!</p>
                </div>

                {/* Stats Grid */}
                <div className="stats-grid">
                    {STATS.map((stat, index) => (
                        <div key={index} className={`stat-card stat-${stat.color}`}>
                            <div className="stat-icon">
                                <stat.icon size={24} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{stat.value}</span>
                                <span className="stat-label">{stat.label}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Grid */}
                <div className="dashboard-grid">
                    {/* Correction Deadlines - URGENT */}
                    <div className="card card-wide">
                        <div className="card-header">
                            <div className="flex items-center gap-3">
                                <AlertTriangle size={20} className="text-warning" />
                                <h3 className="font-semibold">Deadline Koreksi Ujian</h3>
                            </div>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => navigate('/dosen/koreksi')}
                            >
                                Koreksi Sekarang
                            </button>
                        </div>
                        <div className="card-body">
                            <div className="deadline-list">
                                {examDeadlines.length === 0 ? (
                                    <div className="text-center" style={{ padding: '24px', opacity: 0.6 }}>
                                        <Calendar size={40} style={{ marginBottom: '12px' }} />
                                        <p>Tidak ada deadline koreksi saat ini</p>
                                    </div>
                                ) : (
                                    examDeadlines.map(exam => {
                                        const daysLeft = getDaysLeft(exam.deadline)
                                        return (
                                            <div
                                                key={exam.id}
                                                className={`deadline-item ${getDeadlineColor(daysLeft)}`}
                                                onClick={() => navigate('/dosen/koreksi')}
                                            >
                                                <div className="deadline-info">
                                                    <h4>{exam.name}</h4>
                                                    <p>{exam.matkul} • {exam.corrected}/{exam.totalStudents} terkoreksi</p>
                                                </div>
                                                <div className="deadline-meta">
                                                    <div className="deadline-date">
                                                        <Clock size={14} />
                                                        {daysLeft <= 0 ? (
                                                            <span className="overdue">Terlambat {Math.abs(daysLeft)} hari</span>
                                                        ) : daysLeft === 1 ? (
                                                            <span>Besok</span>
                                                        ) : (
                                                            <span>{daysLeft} hari lagi</span>
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                        {new Date(exam.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>
                                                <ChevronRight size={20} className="chevron" />
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Mata Kuliah yang Diampu */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-3">
                                <BookOpen size={20} className="text-secondary" />
                                <h3 className="font-semibold">Mata Kuliah</h3>
                            </div>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => navigate('/dosen/buat-soal')}
                            >
                                Kelola Soal
                            </button>
                        </div>
                        <div className="card-body">
                            <div className="matkul-list">
                                {matkulList.length === 0 ? (
                                    <div className="text-center" style={{ padding: '24px', opacity: 0.6 }}>
                                        <BookOpen size={32} style={{ marginBottom: '8px' }} />
                                        <p style={{ fontSize: '14px' }}>Belum ada mata kuliah</p>
                                    </div>
                                ) : matkulList.slice(0, 5).map((mk) => (
                                    <div key={mk.id} className="matkul-item">
                                        <div className="matkul-info">
                                            <span className="matkul-name">{mk.nama}</span>
                                            <span className="matkul-kelas">{mk.kode}</span>
                                        </div>
                                        <span className="matkul-soal">{mk.sks} SKS</span>
                                    </div>
                                ))}
                            </div>
                            <button
                                className="btn btn-outline"
                                style={{ width: '100%', marginTop: 'var(--space-4)' }}
                                onClick={() => navigate('/dosen/buat-soal')}
                            >
                                <PlusCircle size={16} />
                                Tambah Soal
                            </button>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="font-semibold">Aksi Cepat</h3>
                        </div>
                        <div className="card-body">
                            <div className="quick-actions">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => navigate('/dosen/buat-soal')}
                                >
                                    <PlusCircle size={18} />
                                    Buat Soal Baru
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => navigate('/dosen/koreksi')}
                                >
                                    <CheckCircle size={18} />
                                    Koreksi Jawaban
                                </button>
                                <button
                                    className="btn btn-outline"
                                    onClick={() => navigate('/dosen/nilai-akhir')}
                                >
                                    <Award size={18} />
                                    Input Nilai
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .deadline-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3);
                }
                .deadline-item {
                    display: flex;
                    align-items: center;
                    gap: var(--space-4);
                    padding: var(--space-4);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-lg);
                    border-left: 4px solid var(--border-color);
                    cursor: pointer;
                    transition: all var(--transition-fast);
                }
                .deadline-item:hover {
                    background: var(--bg-secondary);
                }
                .deadline-item.urgent {
                    border-left-color: var(--error-500);
                    background: var(--error-50);
                }
                .deadline-item.warning {
                    border-left-color: var(--warning-500);
                    background: var(--warning-50);
                }
                .deadline-item.normal {
                    border-left-color: var(--success-500);
                }
                .deadline-info {
                    flex: 1;
                }
                .deadline-info h4 {
                    margin: 0 0 var(--space-1);
                    font-size: var(--font-size-sm);
                }
                .deadline-info p {
                    margin: 0;
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
                .deadline-meta {
                    text-align: right;
                }
                .deadline-date {
                    display: flex;
                    align-items: center;
                    gap: var(--space-1);
                    font-weight: var(--font-semibold);
                    margin-bottom: var(--space-1);
                }
                .deadline-item.urgent .deadline-date {
                    color: var(--error-600);
                }
                .deadline-item.warning .deadline-date {
                    color: var(--warning-600);
                }
                .deadline-date .overdue {
                    color: var(--error-600);
                }
                .chevron {
                    color: var(--text-muted);
                }
                .matkul-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3);
                }
                .matkul-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--space-3);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-lg);
                }
                .matkul-info {
                    display: flex;
                    flex-direction: column;
                }
                .matkul-name {
                    font-size: var(--font-size-sm);
                    font-weight: var(--font-medium);
                    color: var(--text-primary);
                }
                .matkul-kelas {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
                .matkul-soal {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
            `}</style>
        </DashboardLayout>
    )
}

export default DosenDashboard
