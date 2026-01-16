import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { useSettings } from '../contexts/SettingsContext'
import {
    Home,
    Users,
    BookOpen,
    FileText,
    Settings,
    LogOut,
    GraduationCap,
    Moon,
    Sun,
    Menu,
    X,
    ClipboardList,
    ClipboardCheck,
    CheckSquare,
    Eye,
    BarChart3,
    Calendar,
    History,
    Building2,
    Layers,
    BookMarked,
    CreditCard,
    Layout,
    Award,
    Shield
} from 'lucide-react'
import { useState } from 'react'
import './DashboardLayout.css'

// Navigation items per role
const NAV_ITEMS = {
    superadmin: [
        { path: '/superadmin', icon: Home, label: 'Dashboard', end: true },
        { path: '/superadmin/users', icon: Users, label: 'Manajemen User' },
        { path: '/superadmin/prodi', icon: Building2, label: 'Program Studi' },
        { path: '/superadmin/kelas', icon: Layers, label: 'Kelas' },
        { path: '/superadmin/matkul', icon: BookMarked, label: 'Mata Kuliah' },
        { path: '/superadmin/jadwal-ujian', icon: Calendar, label: 'Jadwal Ujian' },
        { path: '/superadmin/student-card', icon: CreditCard, label: 'Cetak Kartu' },
        { path: '/superadmin/exam-room', icon: Layout, label: 'Ruang Ujian' },
        { path: '/superadmin/rekap-nilai', icon: Award, label: 'Rekap Nilai' },
        { path: '/superadmin/rekap-kehadiran', icon: ClipboardCheck, label: 'Rekap Kehadiran' },
        { path: '/superadmin/rekap-nilai-mahasiswa', icon: BarChart3, label: 'Rekap Nilai Mahasiswa' },
        { path: '/superadmin/settings', icon: Settings, label: 'Pengaturan' }
    ],
    admin_prodi: [
        { path: '/admin-prodi', icon: Home, label: 'Dashboard', end: true },
        { path: '/admin-prodi/users', icon: Users, label: 'Manajemen User' },
        { path: '/admin-prodi/kelas', icon: Layers, label: 'Kelas' },
        { path: '/admin-prodi/matkul', icon: BookMarked, label: 'Mata Kuliah' },
        { path: '/admin-prodi/jadwal-ujian', icon: Calendar, label: 'Jadwal Ujian' },
        { path: '/admin-prodi/student-card', icon: CreditCard, label: 'Cetak Kartu' },
        { path: '/admin-prodi/exam-room', icon: Layout, label: 'Ruang Ujian' },
        { path: '/admin-prodi/rekap-nilai', icon: Award, label: 'Rekap Nilai' },
        { path: '/admin-prodi/rekap-kehadiran', icon: ClipboardCheck, label: 'Rekap Kehadiran' },
        { path: '/admin-prodi/rekap-berita-acara', icon: FileText, label: 'Rekap Berita Acara' },
        { path: '/admin-prodi/rekap-nilai-mahasiswa', icon: BarChart3, label: 'Rekap Nilai Mahasiswa' },
        { path: '/admin-prodi/settings', icon: Settings, label: 'Pengaturan' }
    ],
    admin: [
        { path: '/admin', icon: Home, label: 'Dashboard', end: true },
        { path: '/admin/users', icon: Users, label: 'Manajemen User' },
        { path: '/admin/prodi', icon: Building2, label: 'Program Studi' },
        { path: '/admin/kelas', icon: Layers, label: 'Kelas' },
        { path: '/admin/matkul', icon: BookMarked, label: 'Mata Kuliah' },
        { path: '/admin/student-card', icon: CreditCard, label: 'Cetak Kartu' },
        { path: '/admin/exam-room', icon: Layout, label: 'Ruang Ujian' },
        { path: '/admin/reports', icon: BarChart3, label: 'Laporan' },
        { path: '/admin/settings', icon: Settings, label: 'Pengaturan' }
    ],
    dosen: [
        { path: '/dosen', icon: Home, label: 'Dashboard', end: true },
        { path: '/dosen/buat-soal', icon: BookOpen, label: 'Buat Soal' },
        { path: '/dosen/koreksi', icon: CheckSquare, label: 'Koreksi Ujian' },
        { path: '/dosen/nilai-ujian', icon: FileText, label: 'Nilai Ujian' },
        { path: '/dosen/nilai-akhir', icon: Award, label: 'Nilai Akhir' }
    ],
    mahasiswa: [
        { path: '/mahasiswa', icon: Home, label: 'Dashboard', end: true },
        { path: '/mahasiswa/ujian', icon: ClipboardList, label: 'Ujian' },
        { path: '/mahasiswa/hasil', icon: Award, label: 'Hasil Ujian' },
        { path: '/mahasiswa/seb-instructions', icon: Shield, label: 'Safe Exam Browser' }
    ],
    pengawas: [
        { path: '/pengawas', icon: Home, label: 'Dashboard', end: true },
        { path: '/pengawas/monitor', icon: Eye, label: 'Monitor Ujian' },
        { path: '/pengawas/attendance', icon: ClipboardCheck, label: 'Kehadiran' },
        { path: '/pengawas/berita-acara', icon: FileText, label: 'Berita Acara' }
    ]
}

// Role labels
const ROLE_LABELS = {
    superadmin: 'Super Administrator',
    admin_prodi: 'Admin Prodi',
    admin: 'Administrator',
    dosen: 'Dosen',
    mahasiswa: 'Mahasiswa',
    pengawas: 'Pengawas'
}

function DashboardLayout({ children }) {
    const { user, logout, theme, toggleTheme } = useAuth()
    const { settings } = useSettings()
    const navigate = useNavigate()
    const [sidebarOpen, setSidebarOpen] = useState(false)

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    const navItems = NAV_ITEMS[user?.role] || []

    return (
        <div className="dashboard-layout">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo">
                        {settings?.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className="logo-image" />
                        ) : (
                            <div className="logo-icon">
                                <GraduationCap size={24} />
                            </div>
                        )}
                        <div className="logo-text">
                            <span className="logo-title">{settings?.appName?.split(' ')[0] || 'CAT'}</span>
                            <span className="logo-subtitle">{settings?.appName?.split(' ').slice(1).join(' ') || 'POLTEKTRANS'}</span>
                        </div>
                    </div>
                    <button
                        className="btn btn-icon btn-ghost sidebar-close"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section">
                        <span className="nav-section-title">Menu Utama</span>
                        {navItems.map(item => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.end}
                                className={({ isActive }) =>
                                    `sidebar-nav-item ${isActive ? 'active' : ''}`
                                }
                                onClick={() => setSidebarOpen(false)}
                            >
                                <item.icon size={20} />
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </div>
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="avatar">
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-details">
                            <span className="user-name">{user?.name}</span>
                            <span className="user-role">{ROLE_LABELS[user?.role]}</span>
                        </div>
                    </div>
                    <button
                        className="btn btn-ghost btn-sm logout-btn"
                        onClick={handleLogout}
                    >
                        <LogOut size={18} />
                        <span>Keluar</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <header className="main-header">
                    <div className="header-left">
                        <button
                            className="btn btn-icon btn-ghost mobile-menu-btn"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu size={20} />
                        </button>
                    </div>
                    <div className="header-right">
                        <button
                            className="btn btn-icon btn-ghost"
                            onClick={toggleTheme}
                            title={theme === 'light' ? 'Mode Gelap' : 'Mode Terang'}
                        >
                            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                        </button>
                    </div>
                </header>

                <div className="main-body">
                    {children}
                </div>
            </main>
        </div>
    )
}

export default DashboardLayout
