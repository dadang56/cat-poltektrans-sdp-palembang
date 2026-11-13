import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, createContext, useContext, lazy, Suspense, Component } from 'react'
import { SettingsProvider } from './contexts/SettingsContext'
import { ConfirmProvider } from './components/ConfirmDialog'
import { ToastContainer, toast } from './components/Toast'
import { useSettings } from './contexts/SettingsContext'
import { isBlockedHere } from './utils/sebGate'
import authService from './services/authService'

import Login from './pages/Login'

// Every other page is its own file, downloaded only when opened, so a
// student on a phone doesn't download the admin pages. lazyPage reloads
// once if a file is gone after a new deploy (old hashed files are removed).
const pageLoaders = []
function lazyPage(load, folder) {
  pageLoaders.push({ load, folder })
  const key = 'cat_chunk_reload'
  return lazy(() => load().then(mod => {
    sessionStorage.removeItem(key)
    return mod
  }, err => {
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1')
      window.location.reload()
      return new Promise(() => {})
    }
    throw err
  }))
}

const AdminDashboard = lazyPage(() => import('./pages/admin/Dashboard'), 'admin')
const AdminUsers = lazyPage(() => import('./pages/admin/Users'), 'admin')
const AdminProdi = lazyPage(() => import('./pages/admin/Prodi'), 'admin')
const AdminKelas = lazyPage(() => import('./pages/admin/Kelas'), 'admin')
const AdminMataKuliah = lazyPage(() => import('./pages/admin/MataKuliah'), 'admin')
const AdminReports = lazyPage(() => import('./pages/admin/Reports'), 'admin')
const AdminSettings = lazyPage(() => import('./pages/admin/Settings'), 'admin')
const AdminStudentCard = lazyPage(() => import('./pages/admin/StudentCard'), 'admin')
const AdminExamRoom = lazyPage(() => import('./pages/admin/ExamRoom'), 'admin')
const RekapNilai = lazyPage(() => import('./pages/admin/RekapNilai'), 'admin')
const RekapKehadiran = lazyPage(() => import('./pages/admin/RekapKehadiran'), 'admin')
const RekapBeritaAcara = lazyPage(() => import('./pages/admin/RekapBeritaAcara'), 'admin')
const AdminProdiDashboard = lazyPage(() => import('./pages/admin/AdminProdiDashboard'), 'admin')
const AdminProdiSettings = lazyPage(() => import('./pages/admin/AdminProdiSettings'), 'admin')
const AdminNilaiAkhir = lazyPage(() => import('./pages/admin/AdminNilaiAkhir'), 'admin')
const JadwalUjian = lazyPage(() => import('./pages/admin/JadwalUjian'), 'admin')
const EksporData = lazyPage(() => import('./pages/admin/EksporData'), 'admin')
const KHS = lazyPage(() => import('./pages/admin/KHS'), 'admin')
const DosenDashboard = lazyPage(() => import('./pages/dosen/Dashboard'), 'dosen')
const BuatSoal = lazyPage(() => import('./pages/dosen/BuatSoal'), 'dosen')
const KoreksiUjian = lazyPage(() => import('./pages/dosen/KoreksiUjian'), 'dosen')
const NilaiUAS = lazyPage(() => import('./pages/dosen/NilaiUAS'), 'dosen')
const NilaiAkhir = lazyPage(() => import('./pages/dosen/NilaiAkhir'), 'dosen')
const MahasiswaDashboard = lazyPage(() => import('./pages/mahasiswa/Dashboard'), 'mahasiswa')
const TakeExam = lazyPage(() => import('./pages/mahasiswa/TakeExam'), 'mahasiswa')
const UjianPage = lazyPage(() => import('./pages/mahasiswa/UjianMendatang'), 'mahasiswa')
const HasilUjian = lazyPage(() => import('./pages/mahasiswa/HasilUjian'), 'mahasiswa')
const SEBInstructions = lazyPage(() => import('./pages/mahasiswa/SEBInstructions'), 'mahasiswa')
const PengawasDashboard = lazyPage(() => import('./pages/pengawas/Dashboard'), 'pengawas')
const MonitorUjian = lazyPage(() => import('./pages/pengawas/MonitorUjian'), 'pengawas')
const PengawasAttendance = lazyPage(() => import('./pages/pengawas/Attendance'), 'pengawas')
const PengawasBeritaAcara = lazyPage(() => import('./pages/pengawas/BeritaAcara'), 'pengawas')
const PusbangkatarDashboard = lazyPage(() => import('./pages/pusbangkatar/Dashboard'), 'pusbangkatar')
const NilaiKondite = lazyPage(() => import('./pages/pusbangkatar/NilaiKondite'), 'pusbangkatar')
const NilaiSemapta = lazyPage(() => import('./pages/pusbangkatar/NilaiSemapta'), 'pusbangkatar')

// Page styles are loaded here, up front and in this order, so the theme
// below still overrides them now that the pages themselves load lazily
import './components/DashboardLayout.css'
import './pages/admin/Dashboard.css'
import './pages/mahasiswa/TakeExam.css'
import './pages/mahasiswa/TakeExamGlass.css'
// Theme loaded last so it overrides page-level styles (see file header)
import './styles/glass.css'
import './styles/mobile.css'

// After login, quietly download the user's own pages so moving between
// menu items is instant (no loading spinner)
const ROLE_FOLDERS = {
  superadmin: ['admin'], admin: ['admin'], admin_prodi: ['admin'],
  dosen: ['dosen'], mahasiswa: ['mahasiswa'], pengawas: ['pengawas'], pusbangkatar: ['pusbangkatar']
}
function prefetchRolePages(role) {
  const folders = ROLE_FOLDERS[role] || []
  const todo = pageLoaders.filter(p => folders.includes(p.folder))
  const run = () => todo.forEach(p => p.load().catch(() => {}))
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 1500)
}

class PageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="page-loading">
        <p>Halaman gagal dimuat. Periksa koneksi internet lalu muat ulang.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Muat Ulang</button>
      </div>
    )
  }
}

function PageLoading() {
  return (
    <div className="page-loading" role="status" aria-label="Memuat halaman">
      <div className="spinner-lg"></div>
    </div>
  )
}

// Auth Context
export const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-lg"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={`/${user.role.replace('_', '-')}`} replace />
  }

  return children
}

function App() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  // Light theme only (user decision 2026-11-13): no dark mode, no toggle
  const [theme] = useState('light')
  const [sessionMessage, setSessionMessage] = useState(null)

  // Download this role's pages in the background once logged in
  useEffect(() => {
    if (user?.role) prefetchRolePages(user.role)
  }, [user?.role])

  // Check for existing session on mount using authService
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Get current user from authService
        const currentUser = await authService.getCurrentUser()
        if (currentUser) {
          setUser(currentUser)
        }

        // Always light; drop any dark preference saved earlier
        try { localStorage.removeItem('cat_theme') } catch { /* storage blocked */ }
        document.documentElement.setAttribute('data-theme', 'light')
      } catch (error) {
        console.error('[App] Auth init error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()

    // Subscribe to auth state changes
    const { data: { subscription } } = authService.onAuthStateChange((event, session) => {
      console.log('[App] Auth state change:', event)
      if (event === 'SIGNED_IN' && session?.profile) {
        setUser(session.profile)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  // Session validation interval - check every 2 minutes (optimized from 30s)
  useEffect(() => {
    if (!user) return

    const checkSession = async () => {
      try {
        const result = await authService.validateSession()
        if (!result.valid && result.reason === 'session_invalidated') {
          // Session was invalidated (user logged in elsewhere)
          setSessionMessage('Akun Anda telah login di perangkat lain. Anda akan logout otomatis.')

          // Auto logout after showing message. Local only: signOut() would clear
          // session_token in the database and so also log out the NEW device
          // that legitimately took over the account.
          setTimeout(async () => {
            await authService.signOutLocal()
            setUser(null)
            setSessionMessage(null)
          }, 3000)
        }
      } catch (e) {
        // Silently ignore validation errors to avoid flooding
      }
    }

    // Check after 5 seconds (not immediately), then every 2 minutes
    const initialTimeout = setTimeout(checkSession, 5000)
    const interval = setInterval(checkSession, 120000)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [user])

  // Inactivity auto-logout (15 minutes = 900000ms)
  useEffect(() => {
    if (!user) return

    const INACTIVITY_TIMEOUT = 15 * 60 * 1000 // 15 minutes
    let inactivityTimer = null

    const resetTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer)
      inactivityTimer = setTimeout(async () => {
        setSessionMessage('Sesi Anda telah berakhir karena tidak ada aktivitas.')
        setTimeout(async () => {
          await authService.signOut()
          setUser(null)
          setSessionMessage(null)
        }, 2000)
      }, INACTIVITY_TIMEOUT)
    }

    // Events that count as "activity"
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(event => window.addEventListener(event, resetTimer))

    // Start the timer
    resetTimer()

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer)
      events.forEach(event => window.removeEventListener(event, resetTimer))
    }
  }, [user])

  // options.sebBypassPassword: admin's "password uji coba" to open a
  // mahasiswa account outside SEB (see utils/sebGate.js)
  const login = async (nimNip, password, _tahunAkademik, options = {}) => {
    const { data, error } = await authService.signInWithNimNip(nimNip, password, options)
    if (error) {
      throw error
    }
    setUser(data)
    return data
  }

  const logout = async () => {
    await authService.signOut()
    setUser(null)
  }

  // Leave this browser only (keeps the user's session on other devices)
  const logoutLocal = async () => {
    await authService.signOutLocal()
    setUser(null)
  }

  // Kept for callers; the app is light-only
  const toggleTheme = () => {
    document.documentElement.setAttribute('data-theme', 'light')
  }

  const authValue = {
    user,
    isLoading,
    login,
    logout,
    logoutLocal,
    theme,
    toggleTheme,
    sessionMessage
  }

  return (
    <SettingsProvider>
      <ConfirmProvider>
        <AuthContext.Provider value={authValue}>
          <SebGuard />
          <ModalDragGuard />
          <PageErrorBoundary>
          <Suspense fallback={<PageLoading />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={
              user ? <Navigate to={`/${user.role.replace('_', '-')}`} replace /> : <Login />
            } />

            {/* Super Admin Routes */}
            <Route path="/superadmin" element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/users" element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <AdminUsers />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/prodi" element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <AdminProdi />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/kelas" element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <AdminKelas />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/matkul" element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <AdminMataKuliah />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/student-card" element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <AdminStudentCard />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/exam-room" element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <AdminExamRoom />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/rekap-nilai" element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <RekapNilai />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/rekap-kehadiran" element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <RekapKehadiran />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/reports" element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <AdminReports />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/settings" element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <AdminSettings />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/monitor-ujian" element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <MonitorUjian />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/rekap-nilai-mahasiswa" element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <KHS />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/jadwal-ujian" element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <JadwalUjian />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/ekspor-data" element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <EksporData />
              </ProtectedRoute>
            } />

            {/* Admin Prodi Routes */}
            <Route path="/admin-prodi" element={
              <ProtectedRoute allowedRoles={['admin_prodi']}>
                <AdminProdiDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin-prodi/users" element={
              <ProtectedRoute allowedRoles={['admin_prodi']}>
                <AdminUsers />
              </ProtectedRoute>
            } />
            <Route path="/admin-prodi/kelas" element={
              <ProtectedRoute allowedRoles={['admin_prodi']}>
                <AdminKelas />
              </ProtectedRoute>
            } />
            <Route path="/admin-prodi/matkul" element={
              <ProtectedRoute allowedRoles={['admin_prodi']}>
                <AdminMataKuliah />
              </ProtectedRoute>
            } />
            <Route path="/admin-prodi/rekap-nilai" element={
              <ProtectedRoute allowedRoles={['admin_prodi']}>
                <RekapNilai />
              </ProtectedRoute>
            } />
            <Route path="/admin-prodi/rekap-kehadiran" element={
              <ProtectedRoute allowedRoles={['admin_prodi']}>
                <RekapKehadiran />
              </ProtectedRoute>
            } />
            <Route path="/admin-prodi/rekap-berita-acara" element={
              <ProtectedRoute allowedRoles={['admin_prodi']}>
                <RekapBeritaAcara />
              </ProtectedRoute>
            } />
            <Route path="/admin-prodi/jadwal-ujian" element={
              <ProtectedRoute allowedRoles={['admin_prodi']}>
                <JadwalUjian />
              </ProtectedRoute>
            } />
            <Route path="/admin-prodi/student-card" element={
              <ProtectedRoute allowedRoles={['admin_prodi']}>
                <AdminStudentCard />
              </ProtectedRoute>
            } />
            <Route path="/admin-prodi/exam-room" element={
              <ProtectedRoute allowedRoles={['admin_prodi']}>
                <AdminExamRoom />
              </ProtectedRoute>
            } />
            <Route path="/admin-prodi/settings" element={
              <ProtectedRoute allowedRoles={['admin_prodi']}>
                <AdminProdiSettings />
              </ProtectedRoute>
            } />
            <Route path="/admin-prodi/rekap-nilai-mahasiswa" element={
              <ProtectedRoute allowedRoles={['admin_prodi']}>
                <KHS />
              </ProtectedRoute>
            } />
            <Route path="/admin-prodi/ekspor-data" element={
              <ProtectedRoute allowedRoles={['admin_prodi']}>
                <EksporData />
              </ProtectedRoute>
            } />
            <Route path="/admin-prodi/nilai-akhir" element={
              <ProtectedRoute allowedRoles={['admin_prodi']}>
                <AdminNilaiAkhir />
              </ProtectedRoute>
            } />

            {/* Legacy Admin Routes (redirect to superadmin) */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminUsers />
              </ProtectedRoute>
            } />
            <Route path="/admin/prodi" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminProdi />
              </ProtectedRoute>
            } />
            <Route path="/admin/kelas" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminKelas />
              </ProtectedRoute>
            } />
            <Route path="/admin/matkul" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminMataKuliah />
              </ProtectedRoute>
            } />
            <Route path="/admin/reports" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminReports />
              </ProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminSettings />
              </ProtectedRoute>
            } />
            <Route path="/admin/student-card" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminStudentCard />
              </ProtectedRoute>
            } />
            <Route path="/admin/exam-room" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminExamRoom />
              </ProtectedRoute>
            } />

            {/* Dosen Routes */}
            <Route path="/dosen" element={
              <ProtectedRoute allowedRoles={['dosen']}>
                <DosenDashboard />
              </ProtectedRoute>
            } />
            <Route path="/dosen/buat-soal" element={
              <ProtectedRoute allowedRoles={['dosen']}>
                <BuatSoal />
              </ProtectedRoute>
            } />
            <Route path="/dosen/koreksi" element={
              <ProtectedRoute allowedRoles={['dosen']}>
                <KoreksiUjian />
              </ProtectedRoute>
            } />
            <Route path="/dosen/nilai-uas" element={
              <ProtectedRoute allowedRoles={['dosen']}>
                <NilaiUAS />
              </ProtectedRoute>
            } />
            <Route path="/dosen/nilai-ujian" element={
              <ProtectedRoute allowedRoles={['dosen']}>
                <NilaiUAS />
              </ProtectedRoute>
            } />
            <Route path="/dosen/nilai-akhir" element={
              <ProtectedRoute allowedRoles={['dosen']}>
                <NilaiAkhir />
              </ProtectedRoute>
            } />

            {/* Mahasiswa Routes */}
            <Route path="/mahasiswa" element={
              <ProtectedRoute allowedRoles={['mahasiswa']}>
                <MahasiswaDashboard />
              </ProtectedRoute>
            } />
            <Route path="/mahasiswa/ujian/:id" element={
              <ProtectedRoute allowedRoles={['mahasiswa']}>
                <TakeExam />
              </ProtectedRoute>
            } />
            <Route path="/mahasiswa/ujian" element={
              <ProtectedRoute allowedRoles={['mahasiswa']}>
                <UjianPage />
              </ProtectedRoute>
            } />
            <Route path="/mahasiswa/hasil" element={
              <ProtectedRoute allowedRoles={['mahasiswa']}>
                <HasilUjian />
              </ProtectedRoute>
            } />
            <Route path="/mahasiswa/take-exam/:id" element={
              <ProtectedRoute allowedRoles={['mahasiswa']}>
                <TakeExam />
              </ProtectedRoute>
            } />
            <Route path="/mahasiswa/seb-instructions" element={
              <ProtectedRoute allowedRoles={['mahasiswa']}>
                <SEBInstructions />
              </ProtectedRoute>
            } />

            {/* Pengawas Routes */}
            <Route path="/pengawas" element={
              <ProtectedRoute allowedRoles={['pengawas']}>
                <PengawasDashboard />
              </ProtectedRoute>
            } />
            <Route path="/pengawas/monitor" element={
              <ProtectedRoute allowedRoles={['pengawas']}>
                <MonitorUjian />
              </ProtectedRoute>
            } />
            <Route path="/pengawas/monitor/:id" element={
              <ProtectedRoute allowedRoles={['pengawas']}>
                <MonitorUjian />
              </ProtectedRoute>
            } />
            <Route path="/pengawas/attendance" element={
              <ProtectedRoute allowedRoles={['pengawas']}>
                <PengawasAttendance />
              </ProtectedRoute>
            } />
            <Route path="/pengawas/berita-acara" element={
              <ProtectedRoute allowedRoles={['pengawas']}>
                <PengawasBeritaAcara />
              </ProtectedRoute>
            } />

            {/* Pusbangkatar Routes */}
            <Route path="/pusbangkatar" element={
              <ProtectedRoute allowedRoles={['pusbangkatar']}>
                <PusbangkatarDashboard />
              </ProtectedRoute>
            } />
            <Route path="/pusbangkatar/nilai-kondite" element={
              <ProtectedRoute allowedRoles={['pusbangkatar']}>
                <NilaiKondite />
              </ProtectedRoute>
            } />
            <Route path="/pusbangkatar/nilai-semapta" element={
              <ProtectedRoute allowedRoles={['pusbangkatar']}>
                <NilaiSemapta />
              </ProtectedRoute>
            } />

            {/* Default Redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          </Suspense>
          </PageErrorBoundary>

          {/* Session Invalidation Toast */}
          {sessionMessage && (
            <div className="session-toast">
              <div className="session-toast-content">
                <span className="session-toast-icon">⚠️</span>
                <span>{sessionMessage}</span>
              </div>
              <style>{`
                .session-toast {
                  position: fixed;
                  top: 20px;
                  left: 50%;
                  transform: translateX(-50%);
                  z-index: 10000;
                  animation: slideDown 0.3s ease-out;
                }
                .session-toast-content {
                  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
                  color: white;
                  padding: 16px 24px;
                  border-radius: 12px;
                  display: flex;
                  align-items: center;
                  gap: 12px;
                  box-shadow: 0 10px 40px rgba(220, 38, 38, 0.4);
                  font-weight: 500;
                }
                .session-toast-icon {
                  font-size: 20px;
                }
                @keyframes slideDown {
                  from {
                    opacity: 0;
                    transform: translateX(-50%) translateY(-20px);
                  }
                  to {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                  }
                }
              `}</style>
            </div>
          )}
        </AuthContext.Provider>
        <ToastContainer />
      </ConfirmProvider>
    </SettingsProvider>
  )
}

// Pop-ups close when their dark background is clicked. Selecting text in a
// pop-up and releasing the mouse outside it also produces a "click" on the
// background, which closed the pop-up mid-edit. A background click now only
// counts when the press also started on the background. One capture-phase
// listener covers every .modal-overlay / .confirm-overlay in the app.
function ModalDragGuard() {
  useEffect(() => {
    const isOverlay = el => !!el?.classList && (el.classList.contains('modal-overlay') || el.classList.contains('confirm-overlay'))
    let pressedOnOverlay = false
    const onDown = (e) => { pressedOnOverlay = isOverlay(e.target) }
    const onClick = (e) => {
      if (isOverlay(e.target) && !pressedOnOverlay) {
        e.stopPropagation()
        e.preventDefault()
      }
      pressedOnOverlay = false
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('click', onClick, true)
    }
  }, [])
  return null
}

// Closes a mahasiswa session that is open in a normal browser while
// "Wajib SEB" is on (e.g. logged in before the setting was turned on).
// Login itself is gated in authService; this covers restored sessions.
function SebGuard() {
  const { user, logoutLocal } = useAuth()
  const { settings } = useSettings()
  useEffect(() => {
    if (isBlockedHere(user, settings)) {
      toast.error('Akun mahasiswa hanya bisa digunakan melalui Safe Exam Browser (SEB). Sesi di browser ini ditutup.', 10000)
      logoutLocal()
    }
  }, [user, settings?.requireSEB])
  return null
}

export default App
