import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useSettings } from '../../contexts/SettingsContext'
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
    Play
} from 'lucide-react'
import './Dashboard.css'

// LocalStorage keys
const USERS_STORAGE_KEY = 'cat_users_data'
const JADWAL_STORAGE_KEY = 'cat_jadwal_data'
const MATKUL_STORAGE_KEY = 'cat_matkul_data'

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

    const [stats, setStats] = useState([
        { label: 'Total User', value: '0', icon: Users, color: 'primary', trend: '-' },
        { label: 'Ujian Aktif', value: '0', icon: FileText, color: 'accent', trend: '-' },
        { label: 'Selesai Hari Ini', value: '0', icon: CheckCircle, color: 'success', trend: '-' },
        { label: 'Perlu Perhatian', value: '0', icon: AlertTriangle, color: 'warning', trend: '-' }
    ])
    const [jadwalUjian, setJadwalUjian] = useState([])
    const [ujianBerlangsung, setUjianBerlangsung] = useState([])

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
        saveSettings({ ...settings, tahunAkademik: value })
    }

    // Load dynamic data
    useEffect(() => {
        const users = localStorage.getItem(USERS_STORAGE_KEY)
        const jadwal = localStorage.getItem(JADWAL_STORAGE_KEY)
        const matkul = localStorage.getItem(MATKUL_STORAGE_KEY)

        const usersList = users ? JSON.parse(users) : []
        let jadwalList = jadwal ? JSON.parse(jadwal) : []
        const matkulList = matkul ? JSON.parse(matkul) : []

        // Filter by prodi for admin_prodi
        if (user?.prodiId) {
            jadwalList = jadwalList.filter(j =>
                !j.prodiId || String(j.prodiId) === String(user.prodiId)
            )
        }

        // Filter by tahun akademik
        if (selectedTahunAkademik) {
            jadwalList = jadwalList.filter(j =>
                !j.tahunAkademik || j.tahunAkademik === selectedTahunAkademik
            )
        }

        const now = new Date()
        const today = now.toISOString().split('T')[0]

        // Calculate stats
        const prodiUsers = user?.prodiId
            ? usersList.filter(u => String(u.prodiId) === String(user.prodiId))
            : usersList
        const activeExams = jadwalList.filter(j => {
            const examStart = new Date(`${j.tanggal}T${j.waktuMulai}`)
            const examEnd = new Date(`${j.tanggal}T${j.waktuSelesai}`)
            return now >= examStart && now <= examEnd
        }).length
        const completedToday = jadwalList.filter(j => {
            const examEnd = new Date(`${j.tanggal}T${j.waktuSelesai}`)
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
            .filter(j => new Date(`${j.tanggal}T${j.waktuMulai}`) > now)
            .sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal))
            .slice(0, 5)
            .map(j => {
                const mk = matkulList.find(m => String(m.id) === String(j.matkulId))
                return {
                    id: j.id,
                    name: `${j.tipeUjian} ${mk?.nama || 'Ujian'}`,
                    date: j.tanggal,
                    time: `${j.waktuMulai} - ${j.waktuSelesai}`,
                    room: j.ruang || 'Lab',
                    participants: '-'
                }
            })
        setJadwalUjian(upcoming)

        // Ujian berlangsung
        const berlangsung = jadwalList.filter(j => {
            const examStart = new Date(`${j.tanggal}T${j.waktuMulai}`)
            const examEnd = new Date(`${j.tanggal}T${j.waktuSelesai}`)
            return now >= examStart && now <= examEnd
        }).map(j => {
            const mk = matkulList.find(m => String(m.id) === String(j.matkulId))
            return {
                id: j.id,
                name: `${j.tipeUjian} ${mk?.nama || 'Ujian'}`,
                startTime: j.waktuMulai,
                endTime: j.waktuSelesai,
                room: j.ruang || 'Lab',
                participants: 0,
                online: 0,
                pengawas: '-'
            }
        })
        setUjianBerlangsung(berlangsung)
    }, [user, selectedTahunAkademik])

    const getDaysUntil = (dateStr) => {
        const today = new Date()
        const examDate = new Date(dateStr)
        const diffTime = examDate - today
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Dashboard Admin Prodi</h1>
                        <p className="page-subtitle">Selamat datang, {user?.name}!</p>
                    </div>
                    <div className="tahun-akademik-selector">
                        <Calendar size={18} />
                        <select
                            className="form-input"
                            value={selectedTahunAkademik}
                            onChange={(e) => handleTahunAkademikChange(e.target.value)}
                            style={{ minWidth: '180px' }}
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

                    {/* Ujian Sedang Berlangsung */}
                    <div className="card card-wide">
                        <div className="card-header">
                            <div className="flex items-center gap-3">
                                <Play size={20} className="text-success" />
                                <h3 className="font-semibold">Ujian Sedang Berlangsung</h3>
                                <span className="badge badge-success">{ujianBerlangsung.length} Aktif</span>
                            </div>
                        </div>
                        <div className="card-body">
                            {ujianBerlangsung.length > 0 ? (
                                <div className="exam-ongoing-list">
                                    {ujianBerlangsung.map(exam => (
                                        <div key={exam.id} className="exam-ongoing-item">
                                            <div className="exam-ongoing-indicator"></div>
                                            <div className="exam-ongoing-info">
                                                <h4>{exam.name}</h4>
                                                <div className="exam-ongoing-meta">
                                                    <span><Clock size={12} /> {exam.startTime} - {exam.endTime}</span>
                                                    <span>• {exam.room}</span>
                                                </div>
                                            </div>
                                            <div className="exam-ongoing-stats">
                                                <div className="stat-item">
                                                    <span className="stat-number">{exam.online}/{exam.participants}</span>
                                                    <span className="stat-text">Online</span>
                                                </div>
                                            </div>
                                            <div className="exam-ongoing-pengawas">
                                                <Eye size={14} />
                                                <span>{exam.pengawas}</span>
                                            </div>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => navigate('/admin-prodi/monitor')}
                                            >
                                                Monitor
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <Play size={32} className="text-muted" />
                                    <p>Tidak ada ujian yang sedang berlangsung</p>
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
            `}</style>
        </DashboardLayout >
    )
}

export default AdminProdiDashboard
