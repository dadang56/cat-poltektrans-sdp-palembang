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
  Layout,
  Loader2
} from 'lucide-react'
import '../admin/Dashboard.css'

import { jadwalService, matkulService, ruangService, hasilUjianService } from '../../services/supabaseService'

function PengawasDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [jadwalList, setJadwalList] = useState([])
  const [matkulList, setMatkulList] = useState([])
  const [examRooms, setExamRooms] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [jadwalData, matkulData, ruanganData] = await Promise.all([
          jadwalService.getAll(),
          matkulService.getAll(),
          ruangService.getAll()
        ])

        setJadwalList(jadwalData || [])
        setMatkulList(matkulData || [])
        setExamRooms(ruanganData || [])
      } catch (error) {
        console.error('[PengawasDashboard] Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const now = new Date()

  // Check if there are active jadwal (for time info)
  const activeJadwal = jadwalList.filter(j => {
    const tanggal = j.tanggal || j.exam_date
    const waktuMulai = j.waktu_mulai || j.waktuMulai
    const waktuSelesai = j.waktu_selesai || j.waktuSelesai
    if (!tanggal || !waktuMulai || !waktuSelesai) return false

    const examStart = new Date(`${tanggal}T${waktuMulai}`)
    let examEnd = new Date(`${tanggal}T${waktuSelesai}`)
    if (examEnd <= examStart) examEnd = new Date(examEnd.getTime() + 24 * 60 * 60 * 1000)
    return now >= examStart && now <= examEnd
  })

  // Get time from first active jadwal
  const firstJadwal = activeJadwal[0]
  const startTime = firstJadwal?.waktu_mulai || firstJadwal?.waktuMulai || '08:00'
  const endTime = firstJadwal?.waktu_selesai || firstJadwal?.waktuSelesai || '10:00'

  // Show allocated rooms (unused currently, activeJadwal is used instead)
  const activeExams = examRooms.map(room => ({
    id: room.id,
    name: room.nama || room.name || `Ruangan ${room.id}`,
    room: room.nama || room.name,
    participants: room.kapasitas || room.students?.length || 0,
    startTime: startTime,
    endTime: endTime
  }))

  // Helper: get room name for a jadwal
  const getRoomName = (j) => {
    const roomId = j.ruangan?.id || j.ruangan_id
    if (roomId) {
      const room = examRooms.find(r => String(r.id) === String(roomId))
      if (room) return room.nama || room.name
    }
    // Fallback to text field (if ruangan is a string, not an object)
    if (typeof j.ruangan === 'string' && j.ruangan) return j.ruangan
    if (j.ruangan?.nama) return j.ruangan.nama
    return '-'
  }

  // Calculate stats dynamically
  const totalParticipants = examRooms.reduce((sum, room) => sum + (room.kapasitas || room.students?.length || 0), 0)
  const STATS = [
    { label: 'Ujian Berlangsung', value: String(activeJadwal.length), icon: Monitor, color: 'primary' },
    { label: 'Ruangan Aktif', value: String(examRooms.length), icon: Users, color: 'success' },
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

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', gap: '1rem' }}>
            <Loader2 size={40} className="spin" style={{ color: 'var(--primary)' }} />
            <p style={{ color: 'var(--text-muted)' }}>Memuat data...</p>
          </div>
        ) : (
          <>
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
                  {activeJadwal.length === 0 ? (
                    <div className="empty-state" style={{ padding: '32px', textAlign: 'center', opacity: 0.6 }}>
                      <Monitor size={48} style={{ marginBottom: '16px' }} />
                      <h4 style={{ margin: '0 0 8px' }}>Tidak Ada Ujian Berlangsung</h4>
                      <p style={{ margin: 0 }}>Saat ini tidak ada ujian yang sedang berjalan.</p>
                    </div>
                  ) : (
                    <div className="monitor-cards">
                      {activeJadwal.map(jadwal => {
                        const matkulName = matkulList.find(m => String(m.id) === String(jadwal.matkul_id))?.nama || jadwal.nama_matkul || 'Ujian'
                        return (
                          <div key={jadwal.id} className="monitor-card">
                            <div className="monitor-card-header">
                              <div>
                                <h4 className="monitor-exam-name">{matkulName}</h4>
                                <p className="monitor-exam-room">{jadwal.tipe || jadwal.tipe_ujian || 'UTS'} • {getRoomName(jadwal)}</p>
                              </div>
                              <span className="badge badge-success animate-pulse">LIVE</span>
                            </div>
                            <div className="monitor-stats">
                              <div className="monitor-stat">
                                <Clock size={16} />
                                <span>{jadwal.waktu_mulai || jadwal.waktuMulai} - {jadwal.waktu_selesai || jadwal.waktuSelesai}</span>
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
                        )
                      })}
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
          </>
        )}
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

