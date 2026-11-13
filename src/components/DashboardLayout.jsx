import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { useSettings } from '../contexts/SettingsContext'
import { useConfirm } from './ConfirmDialog'
import { getActiveAcademicYear } from '../utils/academicYear'
import { isRealSeb, sebQuitUrl } from '../utils/sebGate'
import {
    Home,
    Users,
    BookOpen,
    FileText,
    Settings,
    LogOut,
    GraduationCap,
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
    Shield,
    Download,
    ChevronDown,
    Power
} from 'lucide-react'
import { useState, useEffect, useRef, Fragment } from 'react'
import './DashboardLayout.css'
import { useTableCards } from '../utils/tableCards'

// Navigation items per role
// Icon tile colors for the boxed sidebar menu (cycled per item)
const NAV_TILE_COLORS = [
    ['#3b82f6', '#2563eb'], // blue
    ['#14b8a6', '#0d9488'], // teal
    ['#f59e0b', '#d97706'], // amber
    ['#8b5cf6', '#7c3aed'], // violet
    ['#ec4899', '#db2777'], // pink
    ['#22c55e', '#16a34a'], // green
    ['#f97316', '#ea580c'], // orange
    ['#06b6d4', '#0891b2'], // cyan
    ['#6366f1', '#4f46e5'], // indigo
    ['#ef4444', '#dc2626']  // red
]

const NAV_ITEMS = {
    superadmin: [
        { path: '/superadmin', icon: Home, label: 'Dashboard', end: true, group: 'Utama' },
        { path: '/superadmin/users', icon: Users, label: 'Manajemen User', group: 'Data Master' },
        { path: '/superadmin/prodi', icon: Building2, label: 'Program Studi', group: 'Data Master' },
        { path: '/superadmin/kelas', icon: Layers, label: 'Kelas', group: 'Data Master' },
        { path: '/superadmin/matkul', icon: BookMarked, label: 'Mata Kuliah', group: 'Data Master' },
        { path: '/superadmin/jadwal-ujian', icon: Calendar, label: 'Jadwal Ujian', group: 'Ujian' },
        { path: '/superadmin/student-card', icon: CreditCard, label: 'Cetak Kartu', group: 'Ujian' },
        { path: '/superadmin/exam-room', icon: Layout, label: 'Ruang Ujian', group: 'Ujian' },
        { path: '/superadmin/rekap-nilai', icon: Award, label: 'Rekap Nilai Ujian', group: 'Rekap & Laporan' },
        { path: '/superadmin/rekap-kehadiran', icon: ClipboardCheck, label: 'Rekap Kehadiran', group: 'Rekap & Laporan' },
        { path: '/superadmin/rekap-nilai-mahasiswa', icon: BarChart3, label: 'Kartu Hasil Semester (KHS)', group: 'Rekap & Laporan' },
        { path: '/superadmin/ekspor-data', icon: Download, label: 'Ekspor Data', group: 'Rekap & Laporan' },
        { path: '/superadmin/settings', icon: Settings, label: 'Pengaturan', group: 'Sistem' }
    ],
    admin_prodi: [
        { path: '/admin-prodi', icon: Home, label: 'Dashboard', end: true, group: 'Utama' },
        { path: '/admin-prodi/users', icon: Users, label: 'Manajemen User', group: 'Data Master' },
        { path: '/admin-prodi/kelas', icon: Layers, label: 'Kelas', group: 'Data Master' },
        { path: '/admin-prodi/matkul', icon: BookMarked, label: 'Mata Kuliah', group: 'Data Master' },
        { path: '/admin-prodi/jadwal-ujian', icon: Calendar, label: 'Jadwal Ujian', group: 'Ujian' },
        { path: '/admin-prodi/student-card', icon: CreditCard, label: 'Cetak Kartu', group: 'Ujian' },
        { path: '/admin-prodi/exam-room', icon: Layout, label: 'Ruang Ujian', group: 'Ujian' },
        { path: '/admin-prodi/rekap-nilai', icon: Award, label: 'Rekap Nilai Ujian', group: 'Rekap & Nilai' },
        { path: '/admin-prodi/rekap-kehadiran', icon: ClipboardCheck, label: 'Rekap Kehadiran', group: 'Rekap & Nilai' },
        { path: '/admin-prodi/rekap-berita-acara', icon: FileText, label: 'Rekap Berita Acara', group: 'Rekap & Nilai' },
        { path: '/admin-prodi/nilai-akhir', icon: Award, label: 'Nilai Akhir', group: 'Rekap & Nilai' },
        { path: '/admin-prodi/rekap-nilai-mahasiswa', icon: BarChart3, label: 'Kartu Hasil Semester (KHS)', group: 'Rekap & Nilai' },
        { path: '/admin-prodi/ekspor-data', icon: Download, label: 'Ekspor Data', group: 'Rekap & Nilai' },
        { path: '/admin-prodi/settings', icon: Settings, label: 'Pengaturan', group: 'Sistem' }
    ],
    admin: [
        { path: '/admin', icon: Home, label: 'Dashboard', end: true, group: 'Utama' },
        { path: '/admin/users', icon: Users, label: 'Manajemen User', group: 'Data Master' },
        { path: '/admin/prodi', icon: Building2, label: 'Program Studi', group: 'Data Master' },
        { path: '/admin/kelas', icon: Layers, label: 'Kelas', group: 'Data Master' },
        { path: '/admin/matkul', icon: BookMarked, label: 'Mata Kuliah', group: 'Data Master' },
        { path: '/admin/student-card', icon: CreditCard, label: 'Cetak Kartu', group: 'Ujian' },
        { path: '/admin/exam-room', icon: Layout, label: 'Ruang Ujian', group: 'Ujian' },
        { path: '/admin/reports', icon: BarChart3, label: 'Laporan', group: 'Laporan' },
        { path: '/admin/settings', icon: Settings, label: 'Pengaturan', group: 'Sistem' }
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
    ],
    pusbangkatar: [
        { path: '/pusbangkatar', icon: Home, label: 'Dashboard', end: true },
        { path: '/pusbangkatar/nilai-kondite', icon: ClipboardList, label: 'Nilai Kondite' },
        { path: '/pusbangkatar/nilai-semapta', icon: Award, label: 'Nilai Semapta' }
    ]
}

// Titles for pages that are not in the menu
const EXTRA_PAGE_TITLES = {
    '/monitor-ujian': 'Monitor Ujian',
    '/reports': 'Laporan',
    '/take-exam': 'Ujian',
    '/ujian/': 'Ujian'
}

// Role labels
const ROLE_LABELS = {
    superadmin: 'Super Administrator',
    admin_prodi: 'Admin Prodi',
    admin: 'Administrator',
    dosen: 'Dosen',
    mahasiswa: 'Mahasiswa',
    pengawas: 'Pengawas',
    pusbangkatar: 'Admin Pusbangkatar'
}

function DashboardLayout({ children }) {
    const { user, logout } = useAuth()
    const { settings } = useSettings()
    const activeAcademicYear = getActiveAcademicYear(settings, user)
    const navigate = useNavigate()
    const location = useLocation()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    // The content area is the scroll container (header stays put), so a new
    // page must start at the top instead of the previous page's position
    const mainRef = useRef(null)
    useEffect(() => {
        if (mainRef.current) mainRef.current.scrollTop = 0
    }, [location.pathname])

    // Lock the page itself while the dashboard is shown. body/#root use
    // min-height 100vh, which on phone browsers is taller than the visible
    // screen (address bar), so the whole page could scroll and push the top
    // bar with the menu button off screen. Only .main-content scrolls now.
    useEffect(() => {
        const root = document.documentElement
        root.classList.add('dashboard-locked')
        window.scrollTo(0, 0)
        return () => root.classList.remove('dashboard-locked')
    }, [])

    // Menu scroll hint: on short screens (phones) some menu items sit below
    // the fold. Show a fade + "Menu lainnya" button until the list is
    // scrolled to the end, so users know there is more to scroll.
    const navRef = useRef(null)
    const [navHasMore, setNavHasMore] = useState(false)
    const [navScrolled, setNavScrolled] = useState(false)
    const updateNavHint = () => {
        const el = navRef.current
        if (!el) return
        setNavHasMore(el.scrollHeight - el.scrollTop - el.clientHeight > 8)
        setNavScrolled(el.scrollTop > 4)
    }
    useEffect(() => {
        updateNavHint()
        // The sidebar slides in; measure again once it is in place
        const t = setTimeout(updateNavHint, 320)
        window.addEventListener('resize', updateNavHint)
        return () => {
            clearTimeout(t)
            window.removeEventListener('resize', updateNavHint)
        }
    }, [sidebarOpen, user?.role])
    const scrollNavDown = () => {
        const el = navRef.current
        if (el) el.scrollBy({ top: Math.round(el.clientHeight * 0.7), behavior: 'smooth' })
    }

    const { showConfirm } = useConfirm()
    const handleLogout = () => {
        showConfirm({
            title: 'Keluar dari Si-PANDU?',
            message: 'Anda akan keluar dari akun ini dan perlu login lagi untuk masuk.',
            confirmText: 'Ya, Keluar',
            confirmVariant: 'error',
            onConfirm: () => {
                logout()
                navigate('/login')
            }
        })
    }

    const navItems = NAV_ITEMS[user?.role] || []
    const activeItem = navItems
        .filter(item => location.pathname === item.path || (!item.end && location.pathname.startsWith(`${item.path}/`)))
        .sort((a, b) => b.path.length - a.path.length)[0]
    // Pages reached from a button, not the menu, still get a proper title
    const pageTitle = activeItem?.label
        || Object.entries(EXTRA_PAGE_TITLES).find(([suffix]) => location.pathname.includes(suffix))?.[1]
        || 'Si-PANDU'
    useTableCards(mainRef, pageTitle)

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
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Navigasi utama">
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

                <nav
                    className={`sidebar-nav ${navScrolled ? 'is-scrolled' : ''}`}
                    ref={navRef}
                    onScroll={updateNavHint}
                >
                    <div className="nav-section">
                        {!navItems[0]?.group && <span className="nav-section-title">Menu Utama</span>}
                        {navItems.map((item, i) => {
                            const [c1, c2] = NAV_TILE_COLORS[i % NAV_TILE_COLORS.length]
                            // Long admin menus are split into labelled groups
                            const groupTitle = item.group && item.group !== navItems[i - 1]?.group ? item.group : null
                            return (
                                <Fragment key={item.path}>
                                {groupTitle && (
                                    <span className={`nav-section-title ${i > 0 ? 'nav-group-title' : ''}`}>{groupTitle}</span>
                                )}
                                <NavLink
                                    to={item.path}
                                    end={item.end}
                                    className={({ isActive }) =>
                                        `sidebar-nav-item ${isActive ? 'active' : ''}`
                                    }
                                    style={{ '--tile-1': c1, '--tile-2': c2 }}
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    <span className="nav-icon-tile" aria-hidden="true">
                                        <item.icon size={18} />
                                    </span>
                                    <span className="nav-label">{item.label}</span>
                                </NavLink>
                                </Fragment>
                            )
                        })}
                    </div>
                </nav>
                <div className={`nav-scroll-hint ${navHasMore ? 'visible' : ''}`} aria-hidden={!navHasMore}>
                    <button
                        type="button"
                        className="nav-scroll-hint-btn"
                        onClick={scrollNavDown}
                        tabIndex={navHasMore ? 0 : -1}
                    >
                        Menu lainnya
                        <ChevronDown size={16} />
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content" ref={mainRef}>
                <header className="main-header">
                    <div className="header-left">
                        <button
                            className="btn btn-icon btn-ghost mobile-menu-btn"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu size={20} />
                        </button>

                        {/* Logo and App Name as symbol */}
                        <div className="header-brand">
                            {settings?.logoUrl ? (
                                <img src={settings.logoUrl} alt="Logo" className="header-logo-image" />
                            ) : (
                                <div className="header-logo-icon">
                                    <GraduationCap size={20} />
                                </div>
                            )}
                            <div className="header-logo-text">
                                <span className="header-logo-title">{settings?.appName?.split(' ')[0] || 'Si-PANDU'}</span>
                                <span className="header-logo-subtitle">{settings?.appName?.split(' ').slice(1).join(' ') || ''}</span>
                            </div>
                        </div>
                        <div className="header-page-context" aria-live="polite">
                            <span className="header-page-eyebrow">{ROLE_LABELS[user?.role] || 'Portal Akademik'}</span>
                            <span className="header-page-title">{pageTitle}</span>
                            <span className="header-page-year"><span className="header-year-prefix">Tahun Akademik · </span>{activeAcademicYear || 'belum dipilih'}</span>
                        </div>
                    </div>
                    <div className="header-right">
                        {/* User Info */}
                        <div className="header-user-info">
                            <div className="avatar avatar-sm">
                                {user?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="header-user-details">
                                <span className="header-user-name">{user?.name}</span>
                                <span className="header-user-role">{ROLE_LABELS[user?.role]}</span>
                            </div>
                        </div>

                        {/* Logout Button */}
                        {user?.role === 'mahasiswa' && isRealSeb() && (
                            // quitURL in the SEB config: SEB asks "Quit Session?"
                            // and closes without the quit password
                            <a
                                href={sebQuitUrl()}
                                className="btn btn-sm header-seb-quit-btn"
                                title="Tutup Safe Exam Browser (tanpa password)"
                            >
                                <Power size={18} />
                                <span className="seb-quit-text">Tutup SEB</span>
                            </a>
                        )}

                        <button
                            className="btn btn-ghost btn-sm header-logout-btn"
                            onClick={handleLogout}
                            title="Keluar"
                        >
                            <LogOut size={18} />
                            <span className="logout-text">Keluar</span>
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
