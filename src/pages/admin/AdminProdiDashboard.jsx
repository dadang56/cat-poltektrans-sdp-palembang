import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useSettings } from '../../contexts/SettingsContext'
import { userService, jadwalService, matkulService, soalService, hasilUjianService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    Users,
    FileText,
    CheckCircle,
    AlertTriangle,
    TrendingUp,
    Calendar,
    Clock,
    ChevronRight,
    Eye,
    Play,
    BookOpen,
    CheckCircle2,
    XCircle,
    ToggleLeft,
    ToggleRight,
    Search,
    Filter,
    Percent
} from 'lucide-react'
import './Dashboard.css'


// Generate Tahun Akademik options
const generateTahunAjaranOptions = () => {
    const options = []
    const currentYear = new Date().getFullYear()
    for (let year = currentYear + 1; year >= currentYear - 2; year--) {
        options.push(`${year}/${year + 1} Ganjil`)
        options.push(`${year}/${year + 1} Genap`)
    }
    return options
}

const TAHUN_AJARAN_OPTIONS = generateTahunAjaranOptions()

function AdminProdiDashboard() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { settings, saveSettings } = useSettings()
    const [selectedTahunAkademik, setSelectedTahunAkademik] = useState('')

    const [koreksiProgress, setKoreksiProgress] = useState([])
    const [koreksiSearch, setKoreksiSearch] = useState('')
    const [koreksiFilter, setKoreksiFilter] = useState('all')

    const [stats, setStats] = useState([
        { label: 'Total User', value: '0', icon: Users, color: 'primary', trend: '-' },
        { label: 'Ujian Aktif', value: '0', icon: FileText, color: 'accent', trend: '-' },
        { label: 'Selesai Hari Ini', value: '0', icon: CheckCircle, color: 'success', trend: '-' },
        { label: 'Perlu Perhatian', value: '0', icon: AlertTriangle, color: 'warning', trend: '-' }
    ])
    const [jadwalUjian, setJadwalUjian] = useState([])
    const [ujianBerlangsung, setUjianBerlangsung] = useState([])
    const [soalReadiness, setSoalReadiness] = useState([])

    // Load tahun akademik from settings
    useEffect(() => {
        if (settings?.tahunAkademik) {
            setSelectedTahunAkademik(settings.tahunAkademik)
        } else if (TAHUN_AJARAN_OPTIONS.length > 0) {
            setSelectedTahunAkademik(TAHUN_AJARAN_OPTIONS[0])
        }
    }, [settings])

    // Handle tahun akademik change
    const handleTahunAkademikChange = (value) => {
        setSelectedTahunAkademik(value)
        saveSettings({ tahunAkademik: value })
    }

    const getUserProdi = (u) => u.prodi_id || u.prodiId
    const getJadwalMatkul = (j) => j.matkul_id || j.matkulId
    const getJadwalProdi = (j) => j.prodi_id || j.prodiId
    const getJadwalTipe = (j) => j.tipe_ujian || j.tipeUjian
    const getJadwalWaktuMulai = (j) => j.waktu_mulai || j.waktuMulai
    const getJadwalWaktuSelesai = (j) => j.waktu_selesai || j.waktuSelesai
    const getJadwalRuang = (j) => j.ruangan?.nama || (typeof j.ruangan === 'string' ? j.ruangan : null) || j.ruang || 'Lab'
    const getJadwalTahunAkademik = (j) => j.tahun_akademik || j.tahunAkademik

    // Load dynamic data
    useEffect(() => {
        const loadData = async () => {
            try {
                let usersList = []
                let jadwalList = []
                let matkulList = []

                if (isSupabaseConfigured()) {
                    // Load from Supabase with server-side TA filter
                    const jadwalFilters = selectedTahunAkademik ? { tahun_akademik: selectedTahunAkademik } : {}
                    const [usersData, jadwalData, matkulData, soalData] = await Promise.all([
                        userService.getAll(),
                        jadwalService.getAll(jadwalFilters),
                        matkulService.getAll(),
                        soalService.getAll()
                    ])
                    usersList = usersData
                    jadwalList = jadwalData
                    matkulList = matkulData
                    
                    // Build soal readiness data
                    const now = new Date()
                    const upcomingJadwal = jadwalList.filter(j => {
                        const examStart = new Date(`${j.tanggal}T${getJadwalWaktuMulai(j)}`)
                        if (examStart <= now) return false
                        if (j.tipe !== 'UTS' && j.tipe !== 'UAS') return false
                        // Filter by prodi - only show jadwal for this admin's prodi
                        if (user?.prodiId) {
                            const matkulProdiId = j.matkul?.prodi_id
                            if (matkulProdiId && String(matkulProdiId) !== String(user.prodiId)) return false
                        }
                        return true
                    })
                    
                    const readiness = upcomingJadwal.map(j => {
                        const mk = matkulData.find(m => String(m.id) === String(getJadwalMatkul(j)))
                        const dosenId = j.dosen_id || j.dosen?.id
                        const dosenName = j.dosen?.nama || usersData.find(u => String(u.id) === String(dosenId))?.nama || '-'
                        const tipe = (j.tipe || 'UTS').toUpperCase()
                        
                        // Count soal for this matkul + tipe by this dosen
                        const jadwalMatkulId = String(getJadwalMatkul(j))
                        // Try strict match first: matkul + tipe + dosen
                        let matchingSoal = (soalData || []).filter(s => {
                            return String(s.matkul_id) === jadwalMatkulId &&
                                (s.tipe_ujian || '').toUpperCase() === tipe &&
                                String(s.dosen_id) === String(dosenId)
                        })
                        // Fallback: if no strict match, try by matkul + tipe only
                        // This handles cases where dosen_id may not match exactly
                        if (matchingSoal.length === 0 && dosenId) {
                            matchingSoal = (soalData || []).filter(s => {
                                return String(s.matkul_id) === jadwalMatkulId &&
                                    (s.tipe_ujian || '').toUpperCase() === tipe
                            })
                        }
                        const totalSoal = matchingSoal.length
                        // Calculate effective points (cluster-aware: only count 1 per cluster)
                        const totalPoin = (() => {
                            let total = 0
                            const seenClusterIds = new Set()
                            const seenClusterLabels = new Set()
                            for (const s of matchingSoal) {
                                const cId = s.cluster_id
                                const cLabel = (s.cluster_label || '').trim()
                                if (cId) {
                                    if (!seenClusterIds.has(String(cId))) {
                                        seenClusterIds.add(String(cId))
                                        total += (s.bobot || 0)
                                    }
                                } else if (cLabel) {
                                    if (!seenClusterLabels.has(cLabel)) {
                                        seenClusterLabels.add(cLabel)
                                        total += (s.bobot || 0)
                                    }
                                } else {
                                    total += (s.bobot || 0)
                                }
                            }
                            return total
                        })()
                        
                        return {
                            id: j.id,
                            matkul: mk?.nama || '-',
                            tipe,
                            tanggal: j.tanggal,
                            dosenName,
                            dosenId,
                            totalSoal,
                            totalPoin,
                            isReady: totalSoal > 0 && totalPoin === 100
                        }
                    }).sort((a, b) => {
                        // Sort: not ready first, then by date
                        if (a.isReady !== b.isReady) return a.isReady ? 1 : -1
                        return a.tanggal.localeCompare(b.tanggal)
                    })
                    setSoalReadiness(readiness)
                } else {
                    usersList = users ? JSON.parse(users) : []
                    jadwalList = jadwal ? JSON.parse(jadwal) : []
                    matkulList = matkul ? JSON.parse(matkul) : []
                }

                // Filter by prodi for admin_prodi
                const userProdiId = user?.prodiId || user?.prodi_id
                if (userProdiId) {
                    jadwalList = jadwalList.filter(j => {
                        // jadwal doesn't have prodi_id directly - check via matkul relation
                        const matkulProdiId = j.matkul?.prodi_id
                        if (!matkulProdiId) return true // include if no prodi info (legacy data)
                        return String(matkulProdiId) === String(userProdiId)
                    })
                }

                // Filter by tahun akademik (strict: only match, never include NULL)
                if (selectedTahunAkademik && !isSupabaseConfigured()) {
                    jadwalList = jadwalList.filter(j => {
                        const jTA = getJadwalTahunAkademik(j)
                        return jTA === selectedTahunAkademik
                    })
                }

                // Fetch hasil_ujian for all jadwal to calculate correction progress
                let hasilList = []
                if (isSupabaseConfigured() && jadwalList.length > 0) {
                    const jadwalIds = jadwalList.map(j => j.id)
                    hasilList = await hasilUjianService.getByJadwalIds(jadwalIds)
                }

                // Filter for UTS/UAS schedules only
                const utsUasJadwal = jadwalList.filter(j => {
                    const tipe = (j.tipe || j.tipe_ujian || '').toUpperCase()
                    return tipe === 'UTS' || tipe === 'UAS'
                })

                const progressList = utsUasJadwal.map(j => {
                    const mk = matkulList.find(m => String(m.id) === String(getJadwalMatkul(j)))
                    const dosenId = j.dosen_id || j.dosen?.id
                    const dosenName = j.dosen?.nama || usersList.find(u => String(u.id) === String(dosenId))?.nama || '-'
                    const tipe = (j.tipe || j.tipe_ujian || 'UTS').toUpperCase()
                    const hasPraktek = (mk?.sks_praktek > 0) || (mk?.sksPraktek > 0)

                    // Find all hasil_ujian for this jadwal
                    const resultsForJadwal = hasilList.filter(h => String(h.jadwal_id) === String(j.id))

                    // Find students in this class
                    const classStudents = usersList.filter(u => u.role === 'mahasiswa' && String(u.kelas_id || u.kelasId) === String(j.kelas_id))
                    const totalExpected = classStudents.length

                    // Count submissions (status is submitted or graded)
                    const submittedCount = resultsForJadwal.filter(r => r.status === 'submitted' || r.status === 'graded').length

                    // Count graded submissions (status is graded)
                    const gradedCount = resultsForJadwal.filter(r => r.status === 'graded').length

                    // Count complete final grades
                    const completeCount = resultsForJadwal.filter(r => {
                        const hasNt = r.nilai_tugas !== null && r.nilai_tugas !== undefined
                        const hasNuts = r.nilai_uts !== null && r.nilai_uts !== undefined
                        const hasNuas = r.nilai_uas !== null && r.nilai_uas !== undefined
                        const hasNp = !hasPraktek || (r.nilai_praktek !== null && r.nilai_praktek !== undefined)
                        return hasNt && hasNuts && hasNuas && hasNp
                    }).length

                    return {
                        id: j.id,
                        matkulNama: mk?.nama || '-',
                        matkulKode: mk?.kode || '-',
                        kelasNama: j.kelas?.nama || '-',
                        tipe,
                        dosenName,
                        totalExpected,
                        submittedCount,
                        gradedCount,
                        completeCount,
                        hasPraktek
                    }
                })
                setKoreksiProgress(progressList)

                const now = new Date()
                // Use local date (WIB) instead of UTC
                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

                // Calculate stats - Admin Prodi sees all users except superadmin and admin_prodi
                // This matches the behavior of Users.jsx page
                const prodiUsers = usersList.filter(u => {
                    const userRole = u.role
                    // Admin Prodi cannot see superadmin or other admin_prodi users
                    if (userRole === 'superadmin' || userRole === 'admin_prodi') {
                        return false
                    }
                    return true
                })
                const activeExams = jadwalList.filter(j => {
                    const examStart = new Date(`${j.tanggal}T${getJadwalWaktuMulai(j)}`)
                    const examEnd = new Date(`${j.tanggal}T${getJadwalWaktuSelesai(j)}`)
                    return now >= examStart && now <= examEnd
                }).length
                const completedToday = jadwalList.filter(j => {
                    const examEnd = new Date(`${j.tanggal}T${getJadwalWaktuSelesai(j)}`)
                    return j.tanggal === today && now > examEnd
                }).length

                setStats([
                    { label: 'Total User', value: String(prodiUsers.length), icon: Users, color: 'primary', trend: '-' },
                    { label: 'Ujian Aktif', value: String(activeExams), icon: FileText, color: 'accent', trend: '-' },
                    { label: 'Selesai Hari Ini', value: String(completedToday), icon: CheckCircle, color: 'success', trend: '-' },
                    { label: 'Perlu Perhatian', value: '0', icon: AlertTriangle, color: 'warning', trend: '-' }
                ])

                // Upcoming jadwal
                const upcoming = jadwalList
                    .filter(j => new Date(`${j.tanggal}T${getJadwalWaktuMulai(j)}`) > now)
                    .sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal))
                    .slice(0, 5)
                    .map(j => {
                        const mk = matkulList.find(m => String(m.id) === String(getJadwalMatkul(j)))
                        const tipe = j.tipe || j.tipe_ujian || 'Ujian'
                            return {
                            id: j.id,
                            name: `${tipe.toUpperCase()} ${mk?.nama || 'Ujian'}`,
                            date: j.tanggal,
                            time: `${getJadwalWaktuMulai(j)} - ${getJadwalWaktuSelesai(j)}`,
                            room: getJadwalRuang(j),
                            participants: '-'
                        }
                    })
                setJadwalUjian(upcoming)

                // Ujian hari ini (exclude completed/cancelled, exclude ended > 30min ago)
                const berlangsung = jadwalList.filter(j => {
                    if (j.tanggal !== today) return false
                    if (j.status === 'completed' || j.status === 'cancelled') return false
                    // Exclude exams that ended more than 30 minutes ago
                    const examEnd = new Date(`${j.tanggal}T${getJadwalWaktuSelesai(j) || '23:59'}`)
                    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000)
                    if (examEnd < thirtyMinAgo) return false
                    return true
                }).map(j => {
                    const mk = matkulList.find(m => String(m.id) === String(getJadwalMatkul(j)))
                    const tipe = j.tipe || j.tipe_ujian || 'Ujian'
                    return {
                        id: j.id,
                        name: `${tipe.toUpperCase()} ${mk?.nama || 'Ujian'}`,
                        startTime: getJadwalWaktuMulai(j),
                        endTime: getJadwalWaktuSelesai(j),
                        room: getJadwalRuang(j),
                        participants: 0,
                        online: 0,
                        pengawas: '-',
                        jadwalStatus: j.status || 'scheduled',
                        isActivated: j.status === 'ongoing'
                    }
                })
                setUjianBerlangsung(berlangsung)
            } catch (err) {
                console.error('Error loading dashboard data:', err)
                const usersList = users ? JSON.parse(users) : []
                // Same filter as above - exclude superadmin and admin_prodi
                const prodiUsers = usersList.filter(u =>
                    u.role !== 'superadmin' && u.role !== 'admin_prodi'
                )
                setStats([
                    { label: 'Total User', value: String(prodiUsers.length), icon: Users, color: 'primary', trend: '-' },
                    { label: 'Ujian Aktif', value: '0', icon: FileText, color: 'accent', trend: '-' },
                    { label: 'Selesai Hari Ini', value: '0', icon: CheckCircle, color: 'success', trend: '-' },
                    { label: 'Perlu Perhatian', value: '0', icon: AlertTriangle, color: 'warning', trend: '-' }
                ])
            }
        }

        if (selectedTahunAkademik) {
            loadData()
        }
    }, [user, selectedTahunAkademik])

    const getDaysUntil = (dateStr) => {
        const today = new Date()
        const examDate = new Date(dateStr)
        const diffTime = examDate - today
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays
    }

    const filteredKoreksiProgress = koreksiProgress.filter(item => {
        const matchesSearch = item.matkulNama.toLowerCase().includes(koreksiSearch.toLowerCase()) || 
                              item.dosenName.toLowerCase().includes(koreksiSearch.toLowerCase()) ||
                              item.matkulKode.toLowerCase().includes(koreksiSearch.toLowerCase())
        
        if (!matchesSearch) return false

        const hasSubmissions = item.submittedCount > 0
        if (koreksiFilter === 'incomplete') {
            return hasSubmissions && item.gradedCount < item.submittedCount
        }
        if (koreksiFilter === 'complete') {
            return hasSubmissions && item.gradedCount === item.submittedCount
        }
        if (koreksiFilter === 'na_complete') {
            return item.totalExpected > 0 && item.completeCount === item.totalExpected
        }
        return true
    })

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                {/* Premium Welcome Banner */}
                <div className="welcome-banner-card animate-fadeIn">
                    <div className="welcome-banner-text">
                        <h1 className="welcome-title">Dashboard Admin Prodi</h1>
                        <p className="welcome-subtitle">Selamat datang kembali, <strong>{user?.name || 'Admin Prodi'}</strong>! Berikut adalah rangkuman aktivitas prodi Anda.</p>
                    </div>
                    <div className="tahun-akademik-selector-premium">
                        <Calendar size={16} />
                        <select
                            value={selectedTahunAkademik}
                            onChange={(e) => handleTahunAkademikChange(e.target.value)}
                        >
                            {TAHUN_AJARAN_OPTIONS.map(ta => (
                                <option key={ta} value={ta}>{ta}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="stats-grid">
                    {stats.map((stat, index) => (
                        <div key={index} className={`stat-card stat-${stat.color}`}>
                            <div className="stat-icon">
                                <stat.icon size={24} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{stat.value}</span>
                                <span className="stat-label">{stat.label}</span>
                            </div>
                            <div className="stat-trend">
                                <TrendingUp size={14} />
                                <span>{stat.trend}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Content Grid */}
                <div className="dashboard-grid">
                    {/* Jadwal Ujian - Full Width */}
                    <div className="card card-wide">
                        <div className="card-header">
                            <div className="flex items-center gap-3">
                                <Calendar size={20} className="text-secondary" />
                                <h3 className="font-semibold">Jadwal Ujian</h3>
                            </div>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => navigate('/admin-prodi/jadwal-ujian')}
                            >
                                Kelola Jadwal
                            </button>
                        </div>
                        <div className="card-body">
                            {jadwalUjian.length > 0 ? (
                                <div className="jadwal-list">
                                    {jadwalUjian.map(exam => {
                                        const daysLeft = getDaysUntil(exam.date)
                                        return (
                                            <div
                                                key={exam.id}
                                                className={`jadwal-item ${daysLeft <= 2 ? 'urgent' : daysLeft <= 5 ? 'soon' : ''}`}
                                            >
                                                <div className="jadwal-date">
                                                    <span className="day">{new Date(exam.date).getDate()}</span>
                                                    <span className="month">{new Date(exam.date).toLocaleDateString('id-ID', { month: 'short' })}</span>
                                                </div>
                                                <div className="jadwal-info">
                                                    <h4>{exam.name}</h4>
                                                    <p>
                                                        <Clock size={12} />
                                                        {exam.time} • {exam.room} • {exam.participants} peserta
                                                    </p>
                                                </div>
                                                <div className="jadwal-countdown">
                                                    {daysLeft === 0 ? (
                                                        <span className="today">Hari Ini</span>
                                                    ) : daysLeft === 1 ? (
                                                        <span className="tomorrow">Besok</span>
                                                    ) : (
                                                        <span>{daysLeft} hari lagi</span>
                                                    )}
                                                </div>
                                                <ChevronRight size={18} className="chevron" />
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <Calendar size={32} className="text-muted" />
                                    <p>Tidak ada jadwal ujian mendatang</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Ujian Hari Ini + Activation Toggle */}
                    <div className="card card-wide">
                        <div className="card-header">
                            <div className="flex items-center gap-3">
                                <Play size={20} className="text-success" />
                                <h3 className="font-semibold">Ujian Hari Ini</h3>
                                <span className="badge badge-success">{ujianBerlangsung.filter(e => e.isActivated).length} Aktif</span>
                                <span className="badge badge-warning">{ujianBerlangsung.filter(e => !e.isActivated).length} Belum Aktif</span>
                            </div>
                        </div>
                        <div className="card-body">
                            {ujianBerlangsung.length > 0 ? (
                                <div className="exam-ongoing-list">
                                    {ujianBerlangsung.map(exam => (
                                        <div key={exam.id} className="exam-ongoing-item">
                                            <div className="exam-ongoing-indicator" style={{
                                                background: exam.isActivated ? 'var(--success-500)' : 'var(--warning-400)'
                                            }}></div>
                                            <div className="exam-ongoing-info">
                                                <h4>{exam.name}</h4>
                                                <div className="exam-ongoing-meta">
                                                    <span><Clock size={12} /> {exam.startTime} - {exam.endTime}</span>
                                                    <span>• {exam.room}</span>
                                                </div>
                                            </div>
                                            <button
                                                className={`btn btn-sm ${exam.isActivated ? 'btn-success' : 'btn-outline'}`}
                                                onClick={async () => {
                                                    const newStatus = exam.isActivated ? 'scheduled' : 'ongoing'
                                                    const actionText = exam.isActivated ? 'menonaktifkan' : 'mengaktifkan'
                                                    if (!window.confirm(`Apakah Anda yakin ingin ${actionText} ujian "${exam.name}"?`)) return
                                                    try {
                                                        await jadwalService.update(exam.id, { status: newStatus })
                                                        setUjianBerlangsung(prev => prev.map(e => {
                                                            if (e.id === exam.id) return { ...e, isActivated: !e.isActivated, jadwalStatus: newStatus }
                                                            return e
                                                        }))
                                                    } catch (err) {
                                                        alert('Gagal mengubah status: ' + err.message)
                                                    }
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    minWidth: '140px',
                                                    justifyContent: 'center',
                                                    background: exam.isActivated ? 'var(--success-500)' : 'transparent',
                                                    color: exam.isActivated ? 'white' : 'var(--text-secondary)',
                                                    border: exam.isActivated ? 'none' : '2px dashed var(--border-color)'
                                                }}
                                            >
                                                {exam.isActivated ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                                {exam.isActivated ? '✓ Aktif' : '○ Aktifkan'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <Play size={32} className="text-muted" />
                                    <p>Tidak ada ujian hari ini</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Kesiapan Soal Dosen */}
                    <div className="card card-wide">
                        <div className="card-header">
                            <div className="flex items-center gap-3">
                                <BookOpen size={20} className="text-warning" />
                                <h3 className="font-semibold">Kesiapan Soal Dosen</h3>
                                <span className="badge badge-warning">
                                    {soalReadiness.filter(s => !s.isReady).length} Belum Siap
                                </span>
                            </div>
                        </div>
                        <div className="card-body">
                            {soalReadiness.length > 0 ? (
                                <div className="soal-readiness-list">
                                    {soalReadiness.map(item => (
                                        <div key={item.id} className={`soal-readiness-item ${item.isReady ? 'ready' : 'not-ready'}`}>
                                            <div className="soal-readiness-status">
                                                {item.isReady ? (
                                                    <CheckCircle2 size={20} style={{ color: 'var(--success-500)' }} />
                                                ) : (
                                                    <XCircle size={20} style={{ color: 'var(--error-500)' }} />
                                                )}
                                            </div>
                                            <div className="soal-readiness-info">
                                                <h4>{item.tipe} {item.matkul}</h4>
                                                <p>
                                                    <span>Dosen: {item.dosenName}</span>
                                                    <span>• {item.tanggal}</span>
                                                </p>
                                            </div>
                                            <div className="soal-readiness-detail">
                                                <span className="soal-count">{item.totalSoal} soal</span>
                                                <span className={`soal-points ${item.totalPoin === 100 ? 'complete' : item.totalPoin > 0 ? 'partial' : 'empty'}`}>
                                                    {item.totalPoin}/100 poin
                                                </span>
                                            </div>
                                            <div className="soal-readiness-badge">
                                                {item.isReady ? (
                                                    <span className="badge badge-success">Siap</span>
                                                ) : item.totalSoal === 0 ? (
                                                    <span className="badge badge-error">Belum Buat</span>
                                                ) : (
                                                    <span className="badge badge-warning">Belum Lengkap</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <BookOpen size={32} className="text-muted" />
                                    <p>Tidak ada jadwal ujian mendatang</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Progres Koreksi & Nilai Akhir (UTS & UAS) */}
                    <div className="card card-wide">
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            <div className="flex items-center gap-3">
                                <Percent size={20} className="text-primary" />
                                <h3 className="font-semibold">Progres Koreksi & Nilai Akhir (UTS & UAS)</h3>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                                {/* Search input */}
                                <div style={{ position: 'relative' }}>
                                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Cari matkul / dosen..."
                                        value={koreksiSearch}
                                        onChange={(e) => setKoreksiSearch(e.target.value)}
                                        style={{ paddingLeft: '32px', minWidth: '200px', height: '38px', fontSize: 'var(--font-size-sm)' }}
                                    />
                                </div>
                                {/* Filter dropdown */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Filter size={16} className="text-muted" />
                                    <select
                                        className="form-input"
                                        value={koreksiFilter}
                                        onChange={(e) => setKoreksiFilter(e.target.value)}
                                        style={{ minWidth: '170px', height: '38px', fontSize: 'var(--font-size-sm)' }}
                                    >
                                        <option value="all">Semua Status</option>
                                        <option value="incomplete">Belum Selesai</option>
                                        <option value="complete">Selesai Koreksi</option>
                                        <option value="na_complete">Nilai Akhir Selesai</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="card-body">
                            {filteredKoreksiProgress.length > 0 ? (
                                <div className="table-responsive">
                                    <table className="table-clean" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left', padding: '12px', color: 'var(--text-muted)', fontWeight: 'var(--font-semibold)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', borderBottom: '2px solid var(--border-color)' }}>Mata Kuliah / Kelas</th>
                                                <th style={{ textAlign: 'left', padding: '12px', color: 'var(--text-muted)', fontWeight: 'var(--font-semibold)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', borderBottom: '2px solid var(--border-color)' }}>Dosen Pengampu / Tipe</th>
                                                <th style={{ textAlign: 'left', padding: '12px', color: 'var(--text-muted)', fontWeight: 'var(--font-semibold)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', borderBottom: '2px solid var(--border-color)' }}>Progres Koreksi (Nilai Ujian)</th>
                                                <th style={{ textAlign: 'left', padding: '12px', color: 'var(--text-muted)', fontWeight: 'var(--font-semibold)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', borderBottom: '2px solid var(--border-color)' }}>Progres Nilai Akhir</th>
                                                <th style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontWeight: 'var(--font-semibold)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', borderBottom: '2px solid var(--border-color)' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredKoreksiProgress.map((item) => {
                                                const hasSubmissions = item.submittedCount > 0
                                                const koreksiPercent = hasSubmissions ? Math.round((item.gradedCount / item.submittedCount) * 100) : 0
                                                const naPercent = item.totalExpected > 0 ? Math.round((item.completeCount / item.totalExpected) * 100) : 0
                                                
                                                // Status determination
                                                let statusBadge = { text: 'Belum Ada Ujian', class: 'badge-muted' }
                                                if (hasSubmissions) {
                                                    if (item.gradedCount < item.submittedCount) {
                                                        statusBadge = { text: 'Sedang Dikoreksi', class: 'badge-warning' }
                                                    } else if (item.completeCount === item.totalExpected && item.totalExpected > 0) {
                                                        statusBadge = { text: 'Nilai Akhir Selesai', class: 'badge-success' }
                                                    } else {
                                                        statusBadge = { text: 'Selesai Koreksi', class: 'badge-info' }
                                                    }
                                                }

                                                return (
                                                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <td style={{ padding: '12px' }}>
                                                            <div style={{ fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>{item.matkulNama}</div>
                                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{item.matkulKode} • Kelas {item.kelasNama}</div>
                                                        </td>
                                                        <td style={{ padding: '12px' }}>
                                                            <div style={{ color: 'var(--text-primary)' }}>{item.dosenName}</div>
                                                            <div style={{ fontSize: 'var(--font-size-xs)', marginTop: '4px' }}>
                                                                <span className={`badge ${item.tipe === 'UTS' ? 'badge-primary' : 'badge-accent'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                                                                    {item.tipe}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px', minWidth: '180px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '4px', color: 'var(--text-muted)' }}>
                                                                <span>{item.gradedCount} / {item.submittedCount} Ujian</span>
                                                                <span style={{ fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>{koreksiPercent}%</span>
                                                            </div>
                                                            <div className="progress-bar-container">
                                                                <div className="progress-bar-fill" style={{ 
                                                                    width: `${koreksiPercent}%`, 
                                                                    background: koreksiPercent === 100 ? 'var(--success-500)' : 'var(--primary-500)' 
                                                                }}></div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px', minWidth: '180px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '4px', color: 'var(--text-muted)' }}>
                                                                <span>{item.completeCount} / {item.totalExpected} Mahasiswa</span>
                                                                <span style={{ fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>{naPercent}%</span>
                                                            </div>
                                                            <div className="progress-bar-container">
                                                                <div className="progress-bar-fill" style={{ 
                                                                    width: `${naPercent}%`, 
                                                                    background: naPercent === 100 ? 'var(--success-500)' : naPercent > 0 ? 'var(--warning-500)' : 'var(--border-color)'
                                                                }}></div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                                            <span className={`badge ${statusBadge.class}`} style={{ whiteSpace: 'nowrap' }}>
                                                                {statusBadge.text}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <Percent size={32} className="text-muted" />
                                    <p>Tidak ada data progres koreksi</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .jadwal-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3);
                }
                .jadwal-item {
                    display: flex;
                    align-items: center;
                    gap: var(--space-4);
                    padding: var(--space-3) var(--space-4);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-lg);
                    border-left: 4px solid var(--border-color);
                    transition: all var(--transition-fast);
                    cursor: pointer;
                }
                .jadwal-item:hover {
                    background: var(--bg-secondary);
                }
                .jadwal-item.urgent {
                    border-left-color: var(--error-500);
                    background: var(--error-50);
                }
                .jadwal-item.soon {
                    border-left-color: var(--warning-500);
                    background: var(--warning-50);
                }
                .jadwal-date {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    min-width: 50px;
                    padding: var(--space-2);
                    background: var(--primary-100);
                    border-radius: var(--radius-md);
                }
                .jadwal-date .day {
                    font-size: var(--font-size-xl);
                    font-weight: var(--font-bold);
                    color: var(--primary-600);
                    line-height: 1;
                }
                .jadwal-date .month {
                    font-size: var(--font-size-xs);
                    color: var(--primary-500);
                    text-transform: uppercase;
                }
                .jadwal-info {
                    flex: 1;
                }
                .jadwal-info h4 {
                    margin: 0 0 var(--space-1);
                    font-size: var(--font-size-sm);
                }
                .jadwal-info p {
                    display: flex;
                    align-items: center;
                    gap: var(--space-1);
                    margin: 0;
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
                .jadwal-countdown {
                    font-size: var(--font-size-sm);
                    font-weight: var(--font-medium);
                    color: var(--text-secondary);
                }
                .jadwal-countdown .today {
                    color: var(--error-600);
                    font-weight: var(--font-bold);
                }
                .jadwal-countdown .tomorrow {
                    color: var(--warning-600);
                    font-weight: var(--font-bold);
                }
                .chevron {
                    color: var(--text-muted);
                }
                [data-theme="dark"] .jadwal-date {
                    background: rgba(99, 102, 241, 0.15);
                }
                [data-theme="dark"] .jadwal-item.urgent {
                    background: rgba(239, 68, 68, 0.1);
                }
                [data-theme="dark"] .jadwal-item.soon {
                    background: rgba(245, 158, 11, 0.1);
                }
                /* Exam Ongoing Styles */
                .exam-ongoing-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4);
                }
                .exam-ongoing-item {
                    display: flex;
                    align-items: center;
                    gap: var(--space-4);
                    padding: var(--space-4);
                    background: linear-gradient(135deg, var(--success-50) 0%, var(--bg-tertiary) 100%);
                    border: 1px solid var(--success-200);
                    border-radius: var(--radius-lg);
                }
                [data-theme="dark"] .exam-ongoing-item {
                    background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, var(--bg-tertiary) 100%);
                    border-color: rgba(34, 197, 94, 0.3);
                }
                .exam-ongoing-indicator {
                    width: 12px;
                    height: 12px;
                    background: var(--success-500);
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.1); }
                }
                .exam-ongoing-info {
                    flex: 1;
                }
                .exam-ongoing-info h4 {
                    margin: 0 0 var(--space-1);
                    font-weight: var(--font-semibold);
                }
                .exam-ongoing-meta {
                    display: flex;
                    gap: var(--space-2);
                    font-size: var(--font-size-sm);
                    color: var(--text-muted);
                }
                .exam-ongoing-meta span {
                    display: flex;
                    align-items: center;
                    gap: var(--space-1);
                }
                .exam-ongoing-stats {
                    text-align: center;
                }
                .exam-ongoing-stats .stat-number {
                    display: block;
                    font-size: var(--font-size-lg);
                    font-weight: var(--font-bold);
                    color: var(--success-600);
                }
                .exam-ongoing-stats .stat-text {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
                .exam-ongoing-pengawas {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    padding: var(--space-2) var(--space-3);
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    font-size: var(--font-size-sm);
                    color: var(--text-secondary);
                }
                .empty-state {
                    text-align: center;
                    padding: var(--space-8);
                    color: var(--text-muted);
                }
                .empty-state p {
                    margin-top: var(--space-2);
                }
                /* Soal Readiness */
                .soal-readiness-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3);
                }
                .soal-readiness-item {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                    padding: var(--space-3) var(--space-4);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-lg);
                    border-left: 4px solid var(--border-color);
                    transition: all 0.15s ease;
                }
                .soal-readiness-item.ready {
                    border-left-color: var(--success-500);
                }
                .soal-readiness-item.not-ready {
                    border-left-color: var(--error-500);
                    background: var(--error-50);
                }
                [data-theme="dark"] .soal-readiness-item.not-ready {
                    background: rgba(239, 68, 68, 0.08);
                }
                .soal-readiness-info {
                    flex: 1;
                    min-width: 0;
                }
                .soal-readiness-info h4 {
                    margin: 0 0 2px;
                    font-size: var(--font-size-sm);
                    font-weight: var(--font-semibold);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .soal-readiness-info p {
                    display: flex;
                    gap: var(--space-2);
                    margin: 0;
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
                .soal-readiness-detail {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 2px;
                    min-width: 80px;
                }
                .soal-count {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
                .soal-points {
                    font-size: var(--font-size-sm);
                    font-weight: var(--font-semibold);
                }
                .soal-points.complete { color: var(--success-600); }
                .soal-points.partial { color: var(--warning-600); }
                .soal-points.empty { color: var(--error-600); }

                /* Correction Progress Section Styling */
                .progress-bar-container {
                    width: 100%;
                    height: 8px;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-full);
                    overflow: hidden;
                    margin-top: 4px;
                }
                .progress-bar-fill {
                    height: 100%;
                    border-radius: var(--radius-full);
                    transition: width 0.3s ease;
                }
                .badge-muted {
                    background: var(--bg-secondary) !important;
                    color: var(--text-muted) !important;
                    border: 1px solid var(--border-color);
                }
                .badge-info {
                    background: var(--primary-100) !important;
                    color: var(--primary-700) !important;
                }
                [data-theme="dark"] .badge-info {
                    background: rgba(14, 165, 233, 0.15) !important;
                    color: var(--primary-300) !important;
                }
                .badge-accent {
                    background: var(--accent-100) !important;
                    color: var(--accent-700) !important;
                }
                [data-theme="dark"] .badge-accent {
                    background: rgba(147, 51, 234, 0.15) !important;
                    color: var(--accent-300) !important;
                }

                /* Premium Welcome Banner Styling */
                .welcome-banner-card {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 28px 36px;
                    background: linear-gradient(135deg, var(--color-primary-dark, var(--primary-700)) 0%, var(--color-primary, var(--primary-600)) 100%);
                    border-radius: var(--radius-2xl);
                    color: white;
                    margin-bottom: var(--space-6);
                    box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.3);
                    position: relative;
                    overflow: hidden;
                    flex-wrap: wrap;
                    gap: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .welcome-banner-card::after {
                    content: '';
                    position: absolute;
                    right: -10%;
                    top: -50%;
                    width: 350px;
                    height: 350px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 70%);
                    pointer-events: none;
                }

                .welcome-title {
                    font-size: var(--font-size-2xl);
                    font-weight: 800;
                    color: white !important;
                    margin: 0 0 8px;
                    letter-spacing: -0.5px;
                }

                .welcome-subtitle {
                    font-size: var(--font-size-sm);
                    color: rgba(255, 255, 255, 0.85);
                    margin: 0;
                }

                .tahun-akademik-selector-premium {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    background: rgba(255, 255, 255, 0.12);
                    border: 1px solid rgba(255, 255, 255, 0.18);
                    border-radius: var(--radius-xl);
                    color: white;
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .tahun-akademik-selector-premium:hover {
                    background: rgba(255, 255, 255, 0.2);
                    border-color: rgba(255, 255, 255, 0.35);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                }

                .tahun-akademik-selector-premium select {
                    background: transparent;
                    border: none;
                    color: white;
                    font-size: var(--font-size-sm);
                    font-weight: 600;
                    cursor: pointer;
                    outline: none;
                    padding: 4px 8px;
                }

                .tahun-akademik-selector-premium select option {
                    color: var(--text-primary);
                    background: var(--bg-secondary);
                }

                /* Premium Stat Cards Overrides */
                .stat-card {
                    background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%) !important;
                    border: 1px solid var(--border-color) !important;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01) !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }

                .stat-card:hover {
                    transform: translateY(-4px) !important;
                    border-color: var(--border-hover-color, var(--color-primary-dark)) !important;
                }

                .stat-primary { --border-hover-color: var(--primary-400); }
                .stat-accent { --border-hover-color: var(--accent-400); }
                .stat-success { --border-hover-color: var(--success-400); }
                .stat-warning { --border-hover-color: var(--warning-400); }

                .stat-primary:hover { box-shadow: 0 12px 24px -10px rgba(99, 102, 241, 0.15) !important; }
                .stat-accent:hover { box-shadow: 0 12px 24px -10px rgba(147, 51, 234, 0.15) !important; }
                .stat-success:hover { box-shadow: 0 12px 24px -10px rgba(34, 197, 94, 0.15) !important; }
                .stat-warning:hover { box-shadow: 0 12px 24px -10px rgba(245, 158, 11, 0.15) !important; }

                .stat-icon {
                    width: 48px !important;
                    height: 48px !important;
                    border-radius: 12px !important;
                    background: transparent !important;
                    transition: all 0.3s ease !important;
                }

                .stat-primary .stat-icon {
                    background: rgba(99, 102, 241, 0.08) !important;
                    color: var(--primary-600) !important;
                }
                [data-theme="dark"] .stat-primary .stat-icon {
                    background: rgba(99, 102, 241, 0.2) !important;
                    color: var(--primary-300) !important;
                }

                .stat-accent .stat-icon {
                    background: rgba(147, 51, 234, 0.08) !important;
                    color: var(--accent-600) !important;
                }
                [data-theme="dark"] .stat-accent .stat-icon {
                    background: rgba(147, 51, 234, 0.2) !important;
                    color: var(--accent-300) !important;
                }

                .stat-success .stat-icon {
                    background: rgba(34, 197, 94, 0.08) !important;
                    color: var(--success-600) !important;
                }
                [data-theme="dark"] .stat-success .stat-icon {
                    background: rgba(34, 197, 94, 0.2) !important;
                    color: var(--success-300) !important;
                }

                .stat-warning .stat-icon {
                    background: rgba(245, 158, 11, 0.08) !important;
                    color: var(--warning-600) !important;
                }
                [data-theme="dark"] .stat-warning .stat-icon {
                    background: rgba(245, 158, 11, 0.2) !important;
                    color: var(--warning-300) !important;
                }

                .stat-trend {
                    background: rgba(34, 197, 94, 0.08) !important;
                    color: var(--success-600) !important;
                }
                [data-theme="dark"] .stat-trend {
                    background: rgba(34, 197, 94, 0.15) !important;
                    color: var(--success-300) !important;
                }

                /* Premium Card and Table Layouts */
                .card {
                    border: 1px solid var(--border-color) !important;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02) !important;
                    transition: all 0.3s ease !important;
                }

                .card:hover {
                    box-shadow: 0 10px 20px -8px rgba(0, 0, 0, 0.04) !important;
                }

                [data-theme="dark"] .card {
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
                }

                .card-header {
                    border-bottom: 1px solid var(--border-color) !important;
                    padding: var(--space-4) var(--space-5) !important;
                }

                .card-body {
                    padding: var(--space-5) !important;
                }

                /* Premium Lists */
                .jadwal-item {
                    background: var(--bg-secondary) !important;
                    border: 1px solid var(--border-color) !important;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02) !important;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }

                .jadwal-item:hover {
                    transform: translateX(4px) !important;
                    border-color: var(--color-primary, var(--primary-500)) !important;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04) !important;
                    background: var(--bg-tertiary) !important;
                }

                .soal-readiness-item {
                    background: var(--bg-secondary) !important;
                    border: 1px solid var(--border-color) !important;
                    border-left: 4px solid var(--border-color) !important;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02) !important;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }

                .soal-readiness-item:hover {
                    transform: translateX(4px) !important;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04) !important;
                    background: var(--bg-tertiary) !important;
                }

                .soal-readiness-item.ready {
                    border-left-color: var(--success-500) !important;
                }

                .soal-readiness-item.not-ready {
                    border-left-color: var(--error-500) !important;
                    background: rgba(239, 68, 68, 0.02) !important;
                }
                [data-theme="dark"] .soal-readiness-item.not-ready {
                    background: rgba(239, 68, 68, 0.05) !important;
                }

                /* Empty State Premium */
                .empty-state {
                    padding: var(--space-10) var(--space-6) !important;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-xl);
                    border: 2px dashed var(--border-color);
                    margin: var(--space-2) 0;
                }
            `}</style>
        </DashboardLayout >
    )
}

export default AdminProdiDashboard
