import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { useSettings } from '../../contexts/SettingsContext'
import {
    Users,
    FileText,
    CheckCircle,
    AlertTriangle,
    TrendingUp,
    Calendar,
    Clock,
    Activity,
    Eye,
    Play
} from 'lucide-react'
import './Dashboard.css'

// LocalStorage keys
const USERS_STORAGE_KEY = 'cat_users_data'
const JADWAL_STORAGE_KEY = 'cat_jadwal_data'
const MATKUL_STORAGE_KEY = 'cat_matkul_data'
const PRODI_STORAGE_KEY = 'cat_prodi_data'

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

function AdminDashboard() {
    const navigate = useNavigate()
    const { settings, saveSettings } = useSettings()
    const [selectedTahunAkademik, setSelectedTahunAkademik] = useState('')

    const [stats, setStats] = useState([
        { label: 'Total User', value: '0', icon: Users, color: 'primary', trend: '-' },
        { label: 'Ujian Aktif', value: '0', icon: FileText, color: 'accent', trend: '-' },
        { label: 'Selesai Hari Ini', value: '0', icon: CheckCircle, color: 'success', trend: '-' },
        { label: 'Perlu Perhatian', value: '0', icon: AlertTriangle, color: 'warning', trend: '-' }
    ])
    const [recentExams, setRecentExams] = useState([])
    const [recentUsers, setRecentUsers] = useState([])
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
        // Save to settings
        saveSettings({ ...settings, tahunAkademik: value })
    }

    useEffect(() => {
        const users = localStorage.getItem(USERS_STORAGE_KEY)
        const jadwal = localStorage.getItem(JADWAL_STORAGE_KEY)
        const matkul = localStorage.getItem(MATKUL_STORAGE_KEY)
        const prodi = localStorage.getItem(PRODI_STORAGE_KEY)

        const usersList = users ? JSON.parse(users) : []
        let jadwalList = jadwal ? JSON.parse(jadwal) : []
        const matkulList = matkul ? JSON.parse(matkul) : []
        const prodiList = prodi ? JSON.parse(prodi) : []

        // Filter jadwal by tahun akademik (if jadwal has tahunAkademik field)
        if (selectedTahunAkademik) {
            jadwalList = jadwalList.filter(j =>
                !j.tahunAkademik || j.tahunAkademik === selectedTahunAkademik
            )
        }

        const now = new Date()
        const today = now.toISOString().split('T')[0]

        // Calculate stats
        const totalUsers = usersList.length
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
            { label: 'Total User', value: String(totalUsers), icon: Users, color: 'primary', trend: '-' },
            { label: 'Ujian Aktif', value: String(activeExams), icon: FileText, color: 'accent', trend: '-' },
            { label: 'Selesai Hari Ini', value: String(completedToday), icon: CheckCircle, color: 'success', trend: '-' },
            { label: 'Perlu Perhatian', value: '0', icon: AlertTriangle, color: 'warning', trend: '-' }
        ])

        // Recent exams (last 5 by date)
        const recent = jadwalList
            .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
            .slice(0, 5)
            .map(j => {
                const mk = matkulList.find(m => String(m.id) === String(j.matkulId))
                const examEnd = new Date(`${j.tanggal}T${j.waktuSelesai}`)
                const isActive = now >= new Date(`${j.tanggal}T${j.waktuMulai}`) && now <= examEnd
                return {
                    id: j.id,
                    name: `${j.tipeUjian} ${mk?.nama || 'Ujian'}`,
                    date: j.tanggal,
                    participants: '-',
                    status: isActive ? 'active' : 'completed'
                }
            })
        setRecentExams(recent)

        // Recent users (last 5)
        const recentU = usersList.slice(-5).reverse().map(u => ({
            id: u.id,
            name: u.nama || u.name,
            role: u.role,
            nim: u.nim || '-'
        }))
        setRecentUsers(recentU)

        // Ujian berlangsung
        const berlangsung = jadwalList.filter(j => {
            const examStart = new Date(`${j.tanggal}T${j.waktuMulai}`)
            const examEnd = new Date(`${j.tanggal}T${j.waktuSelesai}`)
            return now >= examStart && now <= examEnd
        }).map(j => {
            const mk = matkulList.find(m => String(m.id) === String(j.matkulId))
            const pr = prodiList.find(p => String(p.id) === String(j.prodiId))
            return {
                id: j.id,
                name: `${j.tipeUjian} ${mk?.nama || 'Ujian'}`,
                startTime: j.waktuMulai,
                endTime: j.waktuSelesai,
                room: j.ruang || 'Lab',
                prodi: pr?.kode || '-',
                participants: 0,
                online: 0,
                pengawas: '-'
            }
        })
        setUjianBerlangsung(berlangsung)
    }, [selectedTahunAkademik])

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Dashboard Admin</h1>
                        <p className="page-subtitle">Selamat datang! Berikut ringkasan sistem hari ini.</p>
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
                    {/* Recent Exams */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-3">
                                <FileText size={20} className="text-secondary" />
                                <h3 className="font-semibold">Ujian Terbaru</h3>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/superadmin/jadwal-ujian')}>Lihat Semua</button>
                        </div>
                        <div className="card-body">
                            {recentExams.length > 0 ? (
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Nama Ujian</th>
                                                <th>Tanggal</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentExams.map(exam => (
                                                <tr key={exam.id}>
                                                    <td className="font-medium">{exam.name}</td>
                                                    <td className="text-muted">{exam.date}</td>
                                                    <td>
                                                        <span className={`badge badge-${exam.status === 'active' ? 'success' : 'primary'}`}>
                                                            {exam.status === 'active' ? 'Aktif' : 'Selesai'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <FileText size={32} className="text-muted" />
                                    <p>Belum ada data ujian</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Users */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-3">
                                <Users size={20} className="text-secondary" />
                                <h3 className="font-semibold">User Terbaru</h3>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/superadmin/users')}>Lihat Semua</button>
                        </div>
                        <div className="card-body">
                            {recentUsers.length > 0 ? (
                                <div className="user-list">
                                    {recentUsers.map(user => (
                                        <div key={user.id} className="user-item">
                                            <div className="avatar">{user.name?.charAt(0) || '?'}</div>
                                            <div className="user-item-info">
                                                <span className="user-item-name">{user.name}</span>
                                                <span className="user-item-role">{user.role} {user.nim !== '-' && `• ${user.nim}`}</span>
                                            </div>
                                            <span className="badge badge-success">Aktif</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <Users size={32} className="text-muted" />
                                    <p>Belum ada user terdaftar</p>
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
                                            <div className="exam-ongoing-prodi">
                                                <span className="badge badge-primary">{exam.prodi}</span>
                                            </div>
                                            <div className="exam-ongoing-stats">
                                                <div className="stat-item">
                                                    <span className="stat-number">{exam.online}/{exam.participants}</span>
                                                    <span className="stat-text">Online</span>
                                                </div>
                                            </div>
                                            <div className="exam-ongoing-pengawas">
                                                <Eye size={14} />
                                                <span className={exam.pengawas !== '-' ? '' : 'text-muted'}>
                                                    {exam.pengawas !== '-' ? exam.pengawas : 'Belum ada'}
                                                </span>
                                            </div>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => navigate('/superadmin/monitor-ujian')}
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
        </DashboardLayout>
    )
}

export default AdminDashboard
