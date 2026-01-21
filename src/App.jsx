import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, createContext, useContext } from 'react'
import { SettingsProvider } from './contexts/SettingsContext'
import { ConfirmProvider } from './components/ConfirmDialog'
import authService from './services/authService'

// Pages
import Login from './pages/Login'

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard'
import AdminUsers from './pages/admin/Users'
import AdminProdi from './pages/admin/Prodi'
import AdminKelas from './pages/admin/Kelas'
import AdminMataKuliah from './pages/admin/MataKuliah'
import AdminReports from './pages/admin/Reports'
import AdminSettings from './pages/admin/Settings'
import AdminStudentCard from './pages/admin/StudentCard'
import AdminExamRoom from './pages/admin/ExamRoom'
import RekapNilai from './pages/admin/RekapNilai'
import RekapKehadiran from './pages/admin/RekapKehadiran'
import RekapBeritaAcara from './pages/admin/RekapBeritaAcara'
import AdminProdiDashboard from './pages/admin/AdminProdiDashboard'
import AdminProdiSettings from './pages/admin/AdminProdiSettings'
import JadwalUjian from './pages/admin/JadwalUjian'
import EksporData from './pages/admin/EksporData'

// Dosen Pages
import DosenDashboard from './pages/dosen/Dashboard'
import BuatSoal from './pages/dosen/BuatSoal'
import KoreksiUjian from './pages/dosen/KoreksiUjian'
import NilaiUAS from './pages/dosen/NilaiUAS'
import NilaiAkhir from './pages/dosen/NilaiAkhir'

// Mahasiswa Pages
import MahasiswaDashboard from './pages/mahasiswa/Dashboard'
import TakeExam from './pages/mahasiswa/TakeExam'
import UjianPage from './pages/mahasiswa/UjianMendatang'
import HasilUjian from './pages/mahasiswa/HasilUjian'
import SEBInstructions from './pages/mahasiswa/SEBInstructions'

// Pengawas Pages
import PengawasDashboard from './pages/pengawas/Dashboard'
import MonitorUjian from './pages/pengawas/MonitorUjian'
import PengawasAttendance from './pages/pengawas/Attendance'
import PengawasBeritaAcara from './pages/pengawas/BeritaAcara'

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
  const [theme, setTheme] = useState('light')
  const [sessionMessage, setSessionMessage] = useState(null)

  // Check for existing session on mount using authService
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Get current user from authService
        const currentUser = await authService.getCurrentUser()
        if (currentUser) {
          setUser(currentUser)
        }

        // Load theme preference
        const savedTheme = localStorage.getItem('cat_theme') || 'light'
        setTheme(savedTheme)
        document.documentElement.setAttribute('data-theme', savedTheme)
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

  // Session validation interval - check every 30 seconds
  useEffect(() => {
    if (!user) return

    const checkSession = async () => {
      const result = await authService.validateSession()
      if (!result.valid && result.reason === 'session_invalidated') {
        // Session was invalidated (user logged in elsewhere)
        setSessionMessage('Akun Anda telah login di perangkat lain. Anda akan logout otomatis.')

        // Auto logout after showing message
        setTimeout(async () => {
          await authService.signOut()
          setUser(null)
          setSessionMessage(null)
        }, 3000)
      }
    }

    // Check immediately and then every 30 seconds
    checkSession()
    const interval = setInterval(checkSession, 30000)

    return () => clearInterval(interval)
  }, [user])

  const login = async (nimNip, password) => {
    const { data, error } = await authService.signInWithNimNip(nimNip, password)
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

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('cat_theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const authValue = {
    user,
    isLoading,
    login,
    logout,
    theme,
    toggleTheme,
    sessionMessage
  }

  return (
    <SettingsProvider>
      <ConfirmProvider>
        <AuthContext.Provider value={authValue}>
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
                <RekapNilai />
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
                <RekapNilai />
              </ProtectedRoute>
            } />
            <Route path="/admin-prodi/ekspor-data" element={
              <ProtectedRoute allowedRoles={['admin_prodi']}>
                <EksporData />
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

            {/* Default Redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>

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
      </ConfirmProvider>
    </SettingsProvider>
  )
}

export default App
