import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import {
  Eye,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Monitor,
  Activity,
  Shield,
  XCircle,
  Layout
} from 'lucide-react'
import '../admin/Dashboard.css'

const JADWAL_STORAGE_KEY = 'cat_jadwal_data'
const MATKUL_STORAGE_KEY = 'cat_matkul_data'
const EXAM_ROOMS_KEY = 'cat_exam_rooms'

function PengawasDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Load from localStorage
  const [jadwalList, setJadwalList] = useState([])
  const [matkulList, setMatkulList] = useState([])
  const [examRooms, setExamRooms] = useState([])

  useEffect(() => {
    const jadwal = localStorage.getItem(JADWAL_STORAGE_KEY)
    const matkul = localStorage.getItem(MATKUL_STORAGE_KEY)
    const rooms = localStorage.getItem(EXAM_ROOMS_KEY)

    if (jadwal) setJadwalList(JSON.parse(jadwal))
    if (matkul) setMatkulList(JSON.parse(matkul))
    if (rooms) {
      try {
        const roomData = JSON.parse(rooms)
        setExamRooms(roomData.rooms || [])
      } catch (e) {
        console.error('Error loading exam rooms:', e)
      }
    }
  }, [])

  const now = new Date()

  // Check if there are active jadwal (for time info)
  const activeJadwal = jadwalList.filter(j => {
    const examStart = new Date(`${j.tanggal}T${j.waktuMulai}`)
    const examEnd = new Date(`${j.tanggal}T${j.waktuSelesai}`)
    return now >= examStart && now <= examEnd
  })

  // Get time from first active jadwal
  const firstJadwal = activeJadwal[0]
  const startTime = firstJadwal?.waktuMulai || '08:00'
  const endTime = firstJadwal?.waktuSelesai || '10:00'

  // Show allocated rooms (from admin) - NOT per-jadwal
  const activeExams = examRooms.map(room => ({
    id: room.id,
    name: room.name,
    room: room.name,
    participants: room.students?.length || 0,
    startTime: startTime,
    endTime: endTime
  }))

  // Calculate stats dynamically
  const totalParticipants = examRooms.reduce((sum, room) => sum + (room.students?.length || 0), 0)
  const STATS = [
    { label: 'Ujian Berlangsung', value: String(examRooms.length), icon: Monitor, color: 'primary' },
    { label: 'Peserta Aktif', value: String(totalParticipants), icon: Users, color: 'success' },
    { label: 'Peringatan', value: '0', icon: AlertTriangle, color: 'warning' },
    { label: 'Selesai Hari Ini', value: '0', icon: CheckCircle, color: 'accent' }
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-page animate-fadeIn">
        <div className="page-header">
          <h1 className="page-title">Dashboard Pengawas</h1>
          <p className="page-subtitle">Selamat datang, {user?.name}! Pantau ujian yang sedang berlangsung.</p>
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
          {/* Active Exams */}
          <div className="card card-wide">
            <div className="card-header">
              <div className="flex items-center gap-3">
                <Monitor size={20} className="text-secondary" />
                <h3 className="font-semibold">Ujian Sedang Berlangsung</h3>
              </div>
            </div>
            <div className="card-body">
              {activeExams.length === 0 ? (
                <div className="empty-state" style={{ padding: '32px', textAlign: 'center', opacity: 0.6 }}>
                  <Monitor size={48} style={{ marginBottom: '16px' }} />
                  <h4 style={{ margin: '0 0 8px' }}>Tidak Ada Ujian Berlangsung</h4>
                  <p style={{ margin: 0 }}>Saat ini tidak ada ujian yang sedang berjalan.</p>
                </div>
              ) : (
                <div className="monitor-cards">
                  {activeExams.map(exam => (
                    <div key={exam.id} className="monitor-card">
                      <div className="monitor-card-header">
                        <div>
                          <h4 className="monitor-exam-name">{exam.name}</h4>
                          <p className="monitor-exam-room">{exam.participants} Peserta</p>
                        </div>
                        <span className="badge badge-success animate-pulse">LIVE</span>
                      </div>
                      <div className="monitor-stats">
                        <div className="monitor-stat">
                          <Clock size={16} />
                          <span>{exam.startTime} - {exam.endTime}</span>
                        </div>
                        <div className="monitor-stat">
                          <Users size={16} />
                          <span>{exam.participants} Peserta</span>
                        </div>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ width: '100%' }}
                        onClick={() => navigate('/pengawas/monitor')}
                      >
                        <Eye size={16} />
                        Monitor Ujian
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-3">
                <Shield size={20} className="text-secondary" />
                <h3 className="font-semibold">Alert Terbaru</h3>
              </div>
            </div>
            <div className="card-body">
              <div className="empty-state" style={{ padding: '24px', textAlign: 'center', opacity: 0.6 }}>
                <Shield size={32} style={{ marginBottom: '8px' }} />
                <p style={{ margin: 0 }}>Belum ada alert</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        .monitor-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: var(--space-4);
        }
        
        .monitor-card {
          padding: var(--space-5);
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
        }
        
        .monitor-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--space-4);
        }
        
        .monitor-exam-name {
          font-size: var(--font-size-lg);
          font-weight: var(--font-semibold);
          color: var(--text-primary);
        }
        
        .monitor-exam-room {
          font-size: var(--font-size-sm);
          color: var(--text-muted);
        }
        
        .monitor-stats {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-4);
          margin-bottom: var(--space-4);
        }
        
        .monitor-stat {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
        }
        
        .monitor-stat.warning {
          color: var(--warning-600);
        }
      `}</style>
    </DashboardLayout>
  )
}

export default PengawasDashboard
