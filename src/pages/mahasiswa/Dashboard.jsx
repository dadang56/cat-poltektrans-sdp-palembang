import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  ArrowRight,
  Award,
  FileText,
  AlertTriangle
} from 'lucide-react'
import '../admin/Dashboard.css'

const JADWAL_STORAGE_KEY = 'cat_jadwal_data'
const MATKUL_STORAGE_KEY = 'cat_matkul_data'

function MahasiswaDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Load from localStorage
  const [jadwalList, setJadwalList] = useState([])
  const [matkulList, setMatkulList] = useState([])

  useEffect(() => {
    const jadwal = localStorage.getItem(JADWAL_STORAGE_KEY)
    const matkul = localStorage.getItem(MATKUL_STORAGE_KEY)
    if (jadwal) setJadwalList(JSON.parse(jadwal))
    if (matkul) setMatkulList(JSON.parse(matkul))
  }, [])

  // Filter jadwal untuk kelas mahasiswa
  const mahasiswaKelasId = user?.kelasId
  const now = new Date()
  const oneDayMs = 24 * 60 * 60 * 1000

  // Get upcoming exams (not expired more than 1 day)
  const upcomingExams = jadwalList
    .filter(j => {
      if (j.kelasId !== mahasiswaKelasId) return false
      // Hide exams expired more than 1 day ago
      const examEnd = new Date(`${j.tanggal}T${j.waktuSelesai}`)
      return (now - examEnd) < oneDayMs
    })
    .map(j => {
      const matkul = matkulList.find(m => m.id === j.matkulId)
      const examEnd = new Date(`${j.tanggal}T${j.waktuSelesai}`)
      const examStart = new Date(`${j.tanggal}T${j.waktuMulai}`)
      let status = 'upcoming'
      if (now >= examStart && now <= examEnd) status = 'active'
      else if (now > examEnd) status = 'expired'

      return {
        ...j,
        matkulName: matkul?.nama || 'Mata Kuliah',
        status
      }
    })
    .sort((a, b) => {
      if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal)
      return a.waktuMulai.localeCompare(b.waktuMulai)
    })
    .slice(0, 2) // Show only 2 upcoming exams

  // Calculate stats
  const activeExams = upcomingExams.filter(e => e.status === 'active').length
  const pendingExams = upcomingExams.filter(e => e.status === 'upcoming').length

  const STATS = [
    { label: 'Ujian Selesai', value: '0', icon: CheckCircle, color: 'success' },
    { label: 'Ujian Mendatang', value: String(pendingExams), icon: Calendar, color: 'primary' },
    { label: 'Sedang Aktif', value: String(activeExams), icon: Clock, color: 'accent' },
    { label: 'Menunggu Hasil', value: '0', icon: Award, color: 'warning' }
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-page animate-fadeIn">
        <div className="page-header">
          <h1 className="page-title">Dashboard Mahasiswa</h1>
          <p className="page-subtitle">Selamat datang, {user?.name}! NIM: {user?.nim}</p>
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
          {/* Upcoming Exams */}
          <div className="card card-wide">
            <div className="card-header">
              <div className="flex items-center gap-3">
                <ClipboardList size={20} className="text-secondary" />
                <h3 className="font-semibold">Ujian Mendatang</h3>
              </div>
            </div>
            <div className="card-body">
              {upcomingExams.length > 0 ? (
                <div className="exam-cards">
                  {upcomingExams.map(exam => (
                    <div key={exam.id} className={`exam-card ${exam.status === 'active' ? 'exam-active' : ''}`}>
                      <div className="exam-card-header">
                        <span className="exam-subject">{exam.matkulName}</span>
                        <span className={`badge badge-${exam.status === 'active' ? 'success' : 'primary'}`}>
                          {exam.status === 'active' ? 'Aktif' : 'Mendatang'}
                        </span>
                      </div>
                      <h4 className="exam-name">{exam.tipeUjian} {exam.matkulName}</h4>
                      <div className="exam-details">
                        <div className="exam-detail">
                          <Calendar size={14} />
                          <span>{exam.tanggal}</span>
                        </div>
                        <div className="exam-detail">
                          <Clock size={14} />
                          <span>{exam.waktuMulai} | {exam.durasi || '-'} menit</span>
                        </div>
                      </div>
                      <button
                        className="btn btn-primary btn-sm exam-start-btn"
                        onClick={() => navigate('/mahasiswa/ujian')}
                      >
                        Lihat Detail
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <AlertCircle size={48} className="text-muted" />
                  <p>Tidak ada ujian mendatang</p>
                </div>
              )}
            </div>
          </div>

          {/* Hasil Ujian */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-secondary" />
                <h3 className="font-semibold">Hasil Ujian Terbaru</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/mahasiswa/hasil-ujian')}>Lihat Semua</button>
            </div>
            <div className="card-body">
              <div className="empty-state" style={{ padding: '32px' }}>
                <FileText size={32} style={{ opacity: 0.5, marginBottom: '8px' }} />
                <p>Belum ada hasil ujian</p>
              </div>
            </div>
          </div>

          {/* Peraturan Ujian */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} className="text-warning" />
                <h3 className="font-semibold">Peraturan Ujian</h3>
              </div>
            </div>
            <div className="card-body">
              <ul className="rules-list">
                <li><strong>1.</strong> Mahasiswa wajib hadir 15 menit sebelum ujian dimulai</li>
                <li><strong>2.</strong> Dilarang membawa alat komunikasi ke dalam ruang ujian</li>
                <li><strong>3.</strong> Dilarang membuka tab/aplikasi lain selama ujian berlangsung</li>
                <li><strong>4.</strong> Jawaban yang sudah dikumpulkan tidak dapat diubah</li>
                <li><strong>5.</strong> Pelanggaran akan mengakibatkan diskualifikasi</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .exam-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: var(--space-4);
        }
        
        .exam-card {
          padding: var(--space-5);
          background: linear-gradient(135deg, var(--primary-50) 0%, var(--accent-50) 100%);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          transition: all var(--transition-normal);
        }
        
        [data-theme="dark"] .exam-card {
          background: linear-gradient(135deg, rgba(59, 103, 159, 0.1) 0%, rgba(0, 168, 168, 0.1) 100%);
        }

        .exam-card.exam-active {
          border-color: var(--success-500);
          background: linear-gradient(135deg, var(--success-50) 0%, var(--accent-50) 100%);
        }
        
        [data-theme="dark"] .exam-card.exam-active {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(0, 168, 168, 0.1) 100%);
        }
        
        .exam-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
        }
        
        .exam-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-2);
        }
        
        .exam-subject {
          font-size: var(--font-size-xs);
          font-weight: var(--font-semibold);
          color: var(--primary-600);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .exam-name {
          font-size: var(--font-size-lg);
          font-weight: var(--font-semibold);
          color: var(--text-primary);
          margin-bottom: var(--space-3);
        }
        
        .exam-details {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          margin-bottom: var(--space-4);
        }
        
        .exam-detail {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
        }
        
        .exam-start-btn {
          width: 100%;
        }
        
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-8);
          text-align: center;
          color: var(--text-muted);
        }
        
        .rules-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        
        .rules-list li {
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
          padding: var(--space-2) var(--space-3);
          background: var(--warning-50);
          border-left: 3px solid var(--warning-500);
          border-radius: 0 var(--radius-md) var(--radius-md) 0;
        }
        
        [data-theme="dark"] .rules-list li {
          background: rgba(245, 158, 11, 0.1);
        }
        
        .rules-list li strong {
          color: var(--warning-600);
          margin-right: var(--space-2);
        }
      `}</style>
    </DashboardLayout>
  )
}

export default MahasiswaDashboard
