import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useConfirm } from '../../components/ConfirmDialog'
import { jadwalService, hasilUjianService, isSupabaseConfigured } from '../../services/supabaseService'
import {
  Eye,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Monitor,
  Activity,
  Shield,
  Search,
  RefreshCw,
  MessageSquare,
  Ban,
  MoreVertical,
  Lock,
  Unlock,
  MapPin,
  Calendar
} from 'lucide-react'
import '../admin/Dashboard.css'

// localStorage keys
const JADWAL_STORAGE_KEY = 'cat_jadwal_data'
const MATKUL_STORAGE_KEY = 'cat_matkul_data'
const EXAM_ROOMS_KEY = 'cat_exam_rooms'

function MonitorUjian() {
  const { user } = useAuth()
  const { showConfirm } = useConfirm()
  const [rooms, setRooms] = useState([])
  const [matkulList, setMatkulList] = useState([])
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [participants, setParticipants] = useState([])
  const [alerts, setAlerts] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [jadwalList, setJadwalList] = useState([])
  const [loading, setLoading] = useState(true)

  // Helper functions for status mapping
  const getDerivedStatus = (hasil) => {
    if (hasil.status === 'graded') return 'submitted'
    if (hasil.status === 'submitted') return 'submitted'
    if (hasil.status === 'kicked') return 'kicked'
    if (hasil.status === 'needs_approval') return 'needs_approval'
    if (hasil.waktu_selesai) return 'submitted'
    return 'active'
  }

  const getDerivedProgress = (hasil) => {
    if (hasil.status === 'graded' || hasil.status === 'submitted' || hasil.waktu_selesai) return 100
    // Estimate progress if answer count is available (would need BE update to really track this)
    return 5 // Default started progress
  }

  const getDetailedActivityStatus = (hasil) => {
    if (hasil.status === 'graded') return 'Selesai & Dinilai'
    if (hasil.status === 'submitted') return 'Sudah Mengumpulkan'
    if (hasil.waktu_selesai) return 'Selesai'
    return 'Sedang Mengerjakan'
  }

  // Load active exams from Supabase jadwal_ujian
  useEffect(() => {
    const loadActiveExams = async () => {
      const now = new Date()

      try {
        if (isSupabaseConfigured()) {
          // Load jadwal and ruang_ujian from Supabase
          const { ruangService } = await import('../../services/supabaseService')
          const [allJadwal, allRuang] = await Promise.all([
            jadwalService.getAll(),
            ruangService.getAll()
          ])
          setJadwalList(allJadwal)

          // Build ruang lookup
          const ruangLookup = {}
          allRuang.forEach(r => { ruangLookup[r.id] = r })

          // Filter for active/upcoming exams (30 mins before to end time)
          const activeExams = allJadwal.filter(j => {
            const waktuMulai = j.waktu_mulai || j.waktuMulai
            const waktuSelesai = j.waktu_selesai || j.waktuSelesai
            if (!j.tanggal || !waktuMulai || !waktuSelesai) return false

            const examStart = new Date(`${j.tanggal}T${waktuMulai}`)
            let examEnd = new Date(`${j.tanggal}T${waktuSelesai}`)
            // Handle cross-midnight exams (e.g. 20:18 - 00:18)
            if (examEnd <= examStart) examEnd = new Date(examEnd.getTime() + 24 * 60 * 60 * 1000)
            const thirtyMinsBefore = new Date(examStart.getTime() - 30 * 60 * 1000)
            return now >= thirtyMinsBefore && now <= examEnd
          })

          console.log('[MonitorUjian] Active exams from Supabase:', activeExams.length)

          // Group by ruangan — each room can have multiple exams
          const roomMap = {}
          activeExams.forEach(j => {
            const roomId = j.ruangan_id || j.ruanganId || 'default'
            const ruang = ruangLookup[roomId] || j.ruangan || {}
            const roomName = ruang.nama || j.ruangan?.nama || 'Ruang Ujian'
            const waktuMulai = j.waktu_mulai || j.waktuMulai
            const waktuSelesai = j.waktu_selesai || j.waktuSelesai
            const matkulName = j.matkul?.nama || 'Ujian'
            const tipe = j.tipe || j.tipe_ujian || 'UTS'
            const examLabel = `${tipe} - ${matkulName}`

            if (!roomMap[roomId]) {
              roomMap[roomId] = {
                id: roomId,
                name: roomName,
                exam: examLabel,
                exams: [examLabel],
                startTime: waktuMulai,
                endTime: waktuSelesai,
                participants: 0,
                students: [],
                status: 'available',
                pengawas: null,
                pengawasName: null,
                jadwalId: j.id,
                jadwalIds: [j.id]
              }
            } else {
              // Multiple exams in same room
              if (!roomMap[roomId].exams.includes(examLabel)) {
                roomMap[roomId].exams.push(examLabel)
                roomMap[roomId].exam = roomMap[roomId].exams.join(', ')
              }
              roomMap[roomId].jadwalIds.push(j.id)
            }
          })

          setRooms(Object.values(roomMap))
        } else {
          // Fallback to localStorage
          const savedRooms = localStorage.getItem(EXAM_ROOMS_KEY)
          const jadwal = localStorage.getItem(JADWAL_STORAGE_KEY)
          const matkul = localStorage.getItem(MATKUL_STORAGE_KEY)

          if (matkul) setMatkulList(JSON.parse(matkul))
          if (jadwal) setJadwalList(JSON.parse(jadwal))

          if (savedRooms) {
            const roomData = JSON.parse(savedRooms)
            const allocatedRooms = roomData.rooms || []
            const activeJadwal = jadwal ? JSON.parse(jadwal).filter(j => {
              const examStart = new Date(`${j.tanggal}T${j.waktuMulai}`)
              let examEnd = new Date(`${j.tanggal}T${j.waktuSelesai}`)
              // Handle cross-midnight exams
              if (examEnd <= examStart) examEnd = new Date(examEnd.getTime() + 24 * 60 * 60 * 1000)
              const thirtyMinsBefore = new Date(examStart.getTime() - 30 * 60 * 1000)
              return now >= thirtyMinsBefore && now <= examEnd
            }) : []

            const firstJadwal = activeJadwal[0]
            const startTime = firstJadwal?.waktuMulai || '08:00'
            const endTime = firstJadwal?.waktuSelesai || '10:00'

            const monitorRooms = allocatedRooms.map(room => ({
              id: room.id,
              name: room.name,
              exam: 'Ujian Bersama',
              startTime: startTime,
              endTime: endTime,
              participants: room.students?.length || 0,
              students: room.students || [],
              status: 'available',
              pengawas: null,
              pengawasName: null
            }))

            setRooms(monitorRooms)
          }
        }
      } catch (error) {
        console.error('[MonitorUjian] Error loading exams:', error)
      }
      setLoading(false)
    }

    loadActiveExams()
  }, [])

  // Check if user can access room (admin/superadmin can access any, pengawas only available rooms)
  const canAccessRoom = (room) => {
    if (['superadmin', 'admin_prodi'].includes(user?.role)) return true
    if (room.status === 'available') return true
    if (room.pengawas === user?.id) return true
    return false
  }

  const handleSelectRoom = async (room) => {
    if (!canAccessRoom(room)) {
      alert(`Ruangan ini sudah diawasi oleh ${room.pengawasName}. Pengawas lain tidak dapat mengakses.`)
      return
    }

    // Lock the room for this pengawas
    if (user?.role === 'pengawas' && room.status === 'available') {
      setRooms(prev => prev.map(r =>
        r.id === room.id
          ? { ...r, status: 'occupied', pengawas: user.id, pengawasName: user.name }
          : r
      ))
    }

    // Load participants from hasil_ujian for ALL jadwal in this room
    const allJadwalIds = room.jadwalIds || (room.jadwalId ? [room.jadwalId] : [])

    if (isSupabaseConfigured() && allJadwalIds.length > 0) {
      try {
        console.log('[MonitorUjian] Fetching participants for jadwal IDs:', allJadwalIds)

        // Fetch participants from ALL jadwal in this room
        const allResults = await Promise.all(
          allJadwalIds.map(jId => hasilUjianService.getByJadwal(jId))
        )

        // Combine and deduplicate by mahasiswa_id
        const seenStudents = new Set()
        const combinedResults = []
        allResults.forEach(resultList => {
          (resultList || []).forEach(hasil => {
            const key = hasil.mahasiswa_id
            if (!seenStudents.has(key)) {
              seenStudents.add(key)
              combinedResults.push(hasil)
            }
          })
        })

        console.log('[MonitorUjian] Total participants found:', combinedResults.length)

        const roomParticipants = combinedResults.map((hasil, idx) => ({
          id: hasil.id,
          studentId: hasil.mahasiswa_id,
          name: hasil.mahasiswa?.nama || 'Unknown',
          nim: hasil.mahasiswa?.nim_nip || '-',
          examNumber: `UJIAN-${String(idx + 1).padStart(3, '0')}`,
          status: getDerivedStatus(hasil),
          progress: getDerivedProgress(hasil),
          currentQuestion: 0,
          warnings: hasil.jumlah_pelanggaran || 0,
          lastActivity: getDetailedActivityStatus(hasil)
        }))
        setParticipants(roomParticipants)
      } catch (error) {
        console.error('[MonitorUjian] Error loading participants:', error)
        alert('Gagal memuat data peserta. Pastikan koneksi internet stabil.')
        setParticipants([])
      }
    } else if (room.students && room.students.length > 0) {
      // Fallback to localStorage room.students
      const roomParticipants = room.students.map((student, idx) => ({
        id: student.id || idx + 1,
        studentId: student.id,
        name: student.name || 'Unknown',
        nim: student.nim || '-',
        examNumber: student.examNumber || `UJIAN-${String(idx + 1).padStart(3, '0')}`,
        status: 'active',
        progress: 0,
        currentQuestion: 1,
        warnings: 0,
        lastActivity: 'Baru masuk'
      }))
      setParticipants(roomParticipants)
    } else {
      setParticipants([])
    }

    setSelectedRoom(room)
  }

  const handleLeaveRoom = () => {
    if (user?.role === 'pengawas' && selectedRoom) {
      setRooms(prev => prev.map(r =>
        r.id === selectedRoom.id
          ? { ...r, status: 'available', pengawas: null, pengawasName: null }
          : r
      ))
    }
    setSelectedRoom(null)
  }

  // Real-time polling: refresh participants from Supabase every 5 seconds
  useEffect(() => {
    if (!selectedRoom) return
    const interval = setInterval(() => {
      handleRefresh()
    }, 5000)

    return () => clearInterval(interval)
  }, [selectedRoom])

  const handleRefresh = async () => {
    setIsRefreshing(true)

    // Reload participants from ALL jadwal in this room
    const allJadwalIds = selectedRoom?.jadwalIds || (selectedRoom?.jadwalId ? [selectedRoom.jadwalId] : [])

    if (isSupabaseConfigured() && allJadwalIds.length > 0) {
      try {
        const allResults = await Promise.all(
          allJadwalIds.map(jId => hasilUjianService.getByJadwal(jId))
        )

        const seenStudents = new Set()
        const combinedResults = []
        allResults.forEach(resultList => {
          (resultList || []).forEach(hasil => {
            const key = hasil.mahasiswa_id
            if (!seenStudents.has(key)) {
              seenStudents.add(key)
              combinedResults.push(hasil)
            }
          })
        })

        console.log('[MonitorUjian] Refresh - participants found:', combinedResults.length)

        const roomParticipants = combinedResults.map((hasil, idx) => ({
          id: hasil.id,
          studentId: hasil.mahasiswa_id,
          name: hasil.mahasiswa?.nama || 'Unknown',
          nim: hasil.mahasiswa?.nim_nip || '-',
          examNumber: `UJIAN-${String(idx + 1).padStart(3, '0')}`,
          status: getDerivedStatus(hasil),
          progress: getDerivedProgress(hasil),
          currentQuestion: 0,
          warnings: hasil.jumlah_pelanggaran || 0,
          lastActivity: getDetailedActivityStatus(hasil)
        }))

        // Detect new violations by comparing with old participants
        roomParticipants.forEach(newP => {
          const oldP = participants.find(p => p.id === newP.id)
          if (oldP && newP.warnings > oldP.warnings) {
            setAlerts(prev => [{
              id: Date.now() + Math.random(),
              studentId: newP.studentId,
              student: newP.name,
              action: `Melakukan kecurangan (peringatan ke-${newP.warnings})`,
              time: new Date().toLocaleTimeString('id-ID'),
              severity: 'error'
            }, ...prev])
          }
          // Detect needs_approval (student requesting re-entry)
          if (newP.status === 'needs_approval' && (!oldP || oldP.status !== 'needs_approval')) {
            setAlerts(prev => [{
              id: Date.now() + Math.random(),
              studentId: newP.studentId,
              student: newP.name,
              action: 'Meminta izin masuk kembali ke ujian',
              time: new Date().toLocaleTimeString('id-ID'),
              severity: 'warning'
            }, ...prev])
          }
        })

        setParticipants(roomParticipants)
      } catch (error) {
        console.error('[MonitorUjian] Error refreshing participants:', error)
      }
    }

    setIsRefreshing(false)
  }

  const handleKickStudent = async (studentId) => {
    showConfirm({
      title: 'Konfirmasi Keluarkan Peserta',
      message: 'Apakah Anda yakin ingin mengeluarkan peserta ini dari ujian?',
      onConfirm: async () => {
        // Update local state first for immediate UI feedback
        setParticipants(prev => prev.map(p =>
          p.id === studentId ? { ...p, status: 'kicked' } : p
        ))

        // Persist to Supabase
        try {
          await hasilUjianService.update(studentId, { status: 'kicked' })
          console.log('[MonitorUjian] Student kicked and saved to DB:', studentId)
        } catch (error) {
          console.error('[MonitorUjian] Error saving kick status:', error)
          // Revert local state on error
          setParticipants(prev => prev.map(p =>
            p.id === studentId ? { ...p, status: 'active' } : p
          ))
        }

        setAlerts(prev => [{
          id: Date.now(),
          studentId,
          student: participants.find(p => p.id === studentId)?.name,
          action: 'Kicked by supervisor',
          time: new Date().toLocaleTimeString('id-ID'),
          severity: 'error'
        }, ...prev])
      }
    })
  }

  const handleSendWarning = (studentId) => {
    const student = participants.find(p => p.id === studentId)
    if (student) {
      setParticipants(prev => prev.map(p =>
        p.id === studentId ? { ...p, warnings: p.warnings + 1 } : p
      ))
      setAlerts(prev => [{
        id: Date.now(),
        studentId,
        student: student.name,
        action: 'Warning sent by supervisor',
        time: new Date().toLocaleTimeString('id-ID'),
        severity: 'warning'
      }, ...prev])
    }
  }

  // Approve re-entry for a student
  const handleApproveReEntry = async (studentId) => {
    const student = participants.find(p => p.id === studentId)
    setParticipants(prev => prev.map(p =>
      p.id === studentId ? { ...p, status: 'active' } : p
    ))
    try {
      await hasilUjianService.update(studentId, { status: 'in_progress' })
      console.log('[MonitorUjian] Re-entry approved:', studentId)
    } catch (error) {
      console.error('[MonitorUjian] Error approving re-entry:', error)
      setParticipants(prev => prev.map(p =>
        p.id === studentId ? { ...p, status: 'needs_approval' } : p
      ))
    }
    setAlerts(prev => [{
      id: Date.now(),
      studentId,
      student: student?.name,
      action: 'Diizinkan masuk kembali oleh pengawas',
      time: new Date().toLocaleTimeString('id-ID'),
      severity: 'info'
    }, ...prev])
  }

  // Reject re-entry (kick)
  const handleRejectReEntry = async (studentId) => {
    showConfirm({
      title: 'Tolak Masuk Kembali',
      message: 'Peserta akan dikeluarkan permanen dan tidak bisa mengerjakan ujian lagi.',
      onConfirm: async () => {
        const student = participants.find(p => p.id === studentId)
        setParticipants(prev => prev.map(p =>
          p.id === studentId ? { ...p, status: 'kicked' } : p
        ))
        try {
          await hasilUjianService.update(studentId, { status: 'kicked' })
        } catch (error) {
          console.error('[MonitorUjian] Error rejecting re-entry:', error)
        }
        setAlerts(prev => [{
          id: Date.now(),
          studentId,
          student: student?.name,
          action: 'Ditolak masuk kembali dan dikeluarkan',
          time: new Date().toLocaleTimeString('id-ID'),
          severity: 'error'
        }, ...prev])
      }
    })
  }

  // Filter participants
  const filteredParticipants = participants.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.nim.includes(search)
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Stats
  const stats = {
    total: participants.length,
    active: participants.filter(p => p.status === 'active').length,
    submitted: participants.filter(p => p.status === 'submitted').length,
    issues: participants.filter(p => p.warnings > 0 || p.status === 'disconnected' || p.status === 'warning' || p.status === 'needs_approval').length
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success'
      case 'submitted': return 'primary'
      case 'disconnected': return 'error'
      case 'warning': return 'warning'
      case 'kicked': return 'error'
      case 'needs_approval': return 'warning'
      default: return 'info'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return 'Aktif'
      case 'submitted': return 'Selesai'
      case 'disconnected': return 'Terputus'
      case 'warning': return 'Peringatan'
      case 'kicked': return 'Dikeluarkan'
      case 'needs_approval': return 'Minta Izin Masuk'
      default: return status
    }
  }

  return (
    <DashboardLayout>
      <div className="dashboard-page animate-fadeIn">
        {!selectedRoom ? (
          /* Room Selection */
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Pilih Ruangan Ujian</h1>
                <p className="page-subtitle">Pilih ruangan yang akan Anda awasi</p>
              </div>
            </div>

            {rooms.length === 0 ? (
              <div className="card">
                <div className="card-body text-center" style={{ padding: '48px', opacity: 0.6 }}>
                  <Monitor size={48} style={{ marginBottom: '16px' }} />
                  <h4 style={{ margin: '0 0 8px' }}>Tidak Ada Ujian Berlangsung</h4>
                  <p style={{ margin: 0 }}>Saat ini tidak ada ujian yang sedang berjalan atau akan dimulai dalam 30 menit ke depan.</p>
                </div>
              </div>
            ) : (
              <div className="room-selection-grid">
                {rooms.map(room => (
                  <div
                    key={room.id}
                    className={`room-card ${room.status} ${!canAccessRoom(room) ? 'locked' : ''}`}
                    onClick={() => handleSelectRoom(room)}
                  >
                    <div className="room-header">
                      <MapPin size={20} />
                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ruang Ujian</span>
                        <h3 style={{ margin: 0 }}>{room.name}</h3>
                      </div>
                      {room.status === 'occupied' && <Lock size={16} className="lock-icon" />}
                    </div>
                    <div className="room-exam" style={{ fontSize: '0.85rem' }}>{room.exam}</div>
                    <div className="room-time">
                      <Clock size={14} />
                      {room.startTime} - {room.endTime}
                    </div>
                    <div className="room-participants">
                      <Users size={14} />
                      {room.participants} Peserta
                    </div>
                    {room.status === 'occupied' && (
                      <div className="room-pengawas">
                        <Eye size={14} />
                        Diawasi oleh: {room.pengawasName}
                      </div>
                    )}
                    <div className={`room-status-badge ${room.status}`}>
                      {room.status === 'available' ? 'Tersedia' : 'Sedang Diawasi'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Monitor View */
          <>
            {/* Header */}
            <div className="monitor-header">
              <div>
                <button className="btn btn-ghost btn-sm mb-2" onClick={handleLeaveRoom}>
                  ← Kembali ke Daftar Ruangan
                </button>
                <h1 className="page-title">{selectedRoom.exam}</h1>
                <p className="page-subtitle">
                  {selectedRoom.name} • {selectedRoom.startTime} - {selectedRoom.endTime}
                </p>
              </div>
              <div className="monitor-header-actions">
                <div className="exam-live-indicator">
                  <span className="live-dot"></span>
                  LIVE
                </div>
                <button
                  className={`btn btn-outline btn-sm ${isRefreshing ? 'loading' : ''}`}
                  onClick={handleRefresh}
                >
                  <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="monitor-stats-row">
              <div className="monitor-stat-card">
                <Users size={20} />
                <div>
                  <span className="stat-value">{stats.total}</span>
                  <span className="stat-label">Total Peserta</span>
                </div>
              </div>
              <div className="monitor-stat-card success">
                <Activity size={20} />
                <div>
                  <span className="stat-value">{stats.active}</span>
                  <span className="stat-label">Sedang Mengerjakan</span>
                </div>
              </div>
              <div className="monitor-stat-card primary">
                <CheckCircle size={20} />
                <div>
                  <span className="stat-value">{stats.submitted}</span>
                  <span className="stat-label">Sudah Submit</span>
                </div>
              </div>
              <div className="monitor-stat-card warning">
                <AlertTriangle size={20} />
                <div>
                  <span className="stat-value">{stats.issues}</span>
                  <span className="stat-label">Perlu Perhatian</span>
                </div>
              </div>
            </div>

            <div className="monitor-content-grid">
              {/* Participants List */}
              <div className="card monitor-participants-card">
                <div className="card-header">
                  <div className="flex items-center gap-3">
                    <Monitor size={20} />
                    <h3 className="font-semibold">Daftar Peserta</h3>
                  </div>
                  <div className="participant-filters">
                    <div className="search-box-sm">
                      <Search size={16} />
                      <input
                        type="text"
                        placeholder="Cari..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>
                    <select
                      className="filter-select"
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                    >
                      <option value="all">Semua Status</option>
                      <option value="active">Aktif</option>
                      <option value="submitted">Selesai</option>
                      <option value="disconnected">Terputus</option>
                      <option value="warning">Peringatan</option>
                    </select>
                  </div>
                </div>
                <div className="card-body participant-list">
                  {filteredParticipants.map(participant => (
                    <div
                      key={participant.id}
                      className={`participant-item ${participant.status} ${selectedStudent === participant.id ? 'selected' : ''}`}
                      onClick={() => setSelectedStudent(participant.id)}
                    >
                      <div className="participant-avatar">
                        {participant.name.charAt(0)}
                        <span className={`status-dot ${participant.status}`}></span>
                      </div>
                      <div className="participant-info">
                        <div className="participant-name">
                          {participant.name}
                          {participant.warnings > 0 && (
                            <span className="warning-badge">{participant.warnings}</span>
                          )}
                        </div>
                        <div className="participant-meta">
                          {participant.nim} • Soal {participant.currentQuestion}/50
                        </div>
                      </div>
                      <div className="participant-progress">
                        <div className="progress-circle">
                          <svg viewBox="0 0 36 36">
                            <path
                              className="progress-bg"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                              className="progress-fill"
                              strokeDasharray={`${participant.progress}, 100`}
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                          </svg>
                          <span className="progress-text">{participant.progress}%</span>
                        </div>
                      </div>
                      <div className="participant-actions">
                        {participant.status === 'needs_approval' ? (
                          <>
                            <button
                              className="action-btn success"
                              title="Izinkan Masuk Kembali"
                              onClick={(e) => { e.stopPropagation(); handleApproveReEntry(participant.id); }}
                              style={{ background: 'var(--success-500)', color: 'white' }}
                            >
                              <CheckCircle size={14} />
                            </button>
                            <button
                              className="action-btn danger"
                              title="Tolak & Keluarkan"
                              onClick={(e) => { e.stopPropagation(); handleRejectReEntry(participant.id); }}
                            >
                              <XCircle size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="action-btn warning"
                              title="Kirim Peringatan"
                              onClick={(e) => { e.stopPropagation(); handleSendWarning(participant.id); }}
                            >
                              <MessageSquare size={14} />
                            </button>
                            <button
                              className="action-btn danger"
                              title="Keluarkan"
                              onClick={(e) => { e.stopPropagation(); handleKickStudent(participant.id); }}
                            >
                              <Ban size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity Log */}
              <div className="card monitor-activity-card">
                <div className="card-header">
                  <div className="flex items-center gap-3">
                    <Shield size={20} />
                    <h3 className="font-semibold">Log Aktivitas</h3>
                  </div>
                  <span className="activity-count">{alerts.length} kejadian</span>
                </div>
                <div className="card-body activity-log">
                  {alerts.map(alert => (
                    <div key={alert.id} className={`activity-item ${alert.severity}`}>
                      <div className="activity-icon">
                        {alert.severity === 'error' ? <XCircle size={16} /> :
                          alert.severity === 'warning' ? <AlertTriangle size={16} /> :
                            <Activity size={16} />}
                      </div>
                      <div className="activity-content">
                        <span className="activity-student">{alert.student}</span>
                        <span className="activity-action">{alert.action}</span>
                      </div>
                      <span className="activity-time">{alert.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        .monitor-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--space-6);
          flex-wrap: wrap;
          gap: var(--space-4);
        }
        
        .monitor-header-actions {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        
        .exam-live-indicator {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          background: var(--error-50);
          color: var(--error-600);
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-bold);
          letter-spacing: 1px;
        }
        
        .live-dot {
          width: 8px;
          height: 8px;
          background: var(--error-500);
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .spin {
          animation: spin 1s linear infinite;
        }
        
        .monitor-stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }
        
        .monitor-stat-card {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          padding: var(--space-4);
          background: var(--bg-secondary);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
        }
        
        .monitor-stat-card svg {
          color: var(--text-muted);
        }
        
        .monitor-stat-card.success svg { color: var(--success-500); }
        .monitor-stat-card.primary svg { color: var(--primary-500); }
        .monitor-stat-card.warning svg { color: var(--warning-500); }
        
        .stat-value {
          display: block;
          font-size: var(--font-size-xl);
          font-weight: var(--font-bold);
          color: var(--text-primary);
        }
        
        .stat-label {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
        }
        
        .monitor-content-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: var(--space-6);
        }
        
        @media (max-width: 1024px) {
          .monitor-content-grid {
            grid-template-columns: 1fr;
          }
        }
        
        .participant-filters {
          display: flex;
          gap: var(--space-3);
        }
        
        .search-box-sm {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
        }
        
        .search-box-sm input {
          border: none;
          background: transparent;
          outline: none;
          font-size: var(--font-size-sm);
          color: var(--text-primary);
          width: 120px;
        }
        
        .search-box-sm svg {
          color: var(--text-muted);
        }
        
        .filter-select {
          padding: var(--space-2) var(--space-3);
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          font-size: var(--font-size-sm);
          color: var(--text-primary);
          cursor: pointer;
        }
        
        .participant-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          max-height: 500px;
          overflow-y: auto;
        }
        
        .participant-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--transition-fast);
          border: 2px solid transparent;
        }
        
        .participant-item:hover {
          background: var(--bg-tertiary);
        }
        
        .participant-item.selected {
          background: var(--primary-50);
          border-color: var(--primary-300);
        }
        
        .participant-item.warning {
          background: var(--warning-50);
        }
        
        .participant-item.disconnected {
          opacity: 0.6;
        }
        
        .participant-avatar {
          position: relative;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--primary-500), var(--accent-500));
          color: white;
          border-radius: 50%;
          font-weight: var(--font-semibold);
          flex-shrink: 0;
        }
        
        .status-dot {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid var(--bg-secondary);
        }
        
        .status-dot.active { background: var(--success-500); }
        .status-dot.submitted { background: var(--primary-500); }
        .status-dot.disconnected { background: var(--error-500); }
        .status-dot.warning { background: var(--warning-500); }
        .status-dot.kicked { background: var(--gray-500); }
        .status-dot.needs_approval { background: var(--warning-500); animation: pulse-dot 1.5s ease-in-out infinite; }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.3); } }
        
        .participant-info {
          flex: 1;
          min-width: 0;
        }
        
        .participant-name {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--font-size-sm);
          font-weight: var(--font-medium);
          color: var(--text-primary);
        }
        
        .warning-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          background: var(--warning-500);
          color: white;
          border-radius: 50%;
          font-size: 10px;
          font-weight: var(--font-bold);
        }
        
        .participant-meta {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
        }
        
        .participant-progress {
          flex-shrink: 0;
        }
        
        .progress-circle {
          position: relative;
          width: 44px;
          height: 44px;
        }
        
        .progress-circle svg {
          width: 100%;
          height: 100%;
          transform: rotate(-90deg);
        }
        
        .progress-bg {
          fill: none;
          stroke: var(--border-color);
          stroke-width: 3;
        }
        
        .progress-fill {
          fill: none;
          stroke: var(--primary-500);
          stroke-width: 3;
          stroke-linecap: round;
        }
        
        .progress-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 10px;
          font-weight: var(--font-bold);
          color: var(--text-primary);
        }
        
        .participant-actions {
          display: flex;
          gap: var(--space-1);
        }
        
        .action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        
        .action-btn.warning {
          background: var(--warning-50);
          color: var(--warning-600);
        }
        
        .action-btn.danger {
          background: var(--error-50);
          color: var(--error-600);
        }
        
        .action-btn:hover {
          transform: scale(1.1);
        }
        
        .activity-count {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
        }
        
        .activity-log {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          max-height: 500px;
          overflow-y: auto;
        }
        
        .activity-item {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          padding: var(--space-3);
          background: var(--bg-tertiary);
          border-radius: var(--radius-lg);
          border-left: 3px solid;
        }
        
        .activity-item.error { border-left-color: var(--error-500); }
        .activity-item.warning { border-left-color: var(--warning-500); }
        .activity-item.info { border-left-color: var(--info-500); }
        
        .activity-icon {
          flex-shrink: 0;
          margin-top: 2px;
        }
        
        .activity-item.error .activity-icon { color: var(--error-500); }
        .activity-item.warning .activity-icon { color: var(--warning-500); }
        .activity-item.info .activity-icon { color: var(--info-500); }
        
        .activity-content {
          flex: 1;
          min-width: 0;
        }
        
        .activity-student {
          display: block;
          font-size: var(--font-size-sm);
          font-weight: var(--font-medium);
          color: var(--text-primary);
        }
        
        .activity-action {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
        }
        
        .activity-time {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
          white-space: nowrap;
        }
        
        [data-theme="dark"] .exam-live-indicator {
          background: rgba(239, 68, 68, 0.15);
        }
        
        [data-theme="dark"] .participant-item.selected {
          background: rgba(59, 103, 159, 0.15);
        }
        
        [data-theme="dark"] .participant-item.warning {
          background: rgba(245, 158, 11, 0.15);
        }
        
        [data-theme="dark"] .action-btn.warning {
          background: rgba(245, 158, 11, 0.15);
        }
        
        [data-theme="dark"] .action-btn.danger {
          background: rgba(239, 68, 68, 0.15);
        }
        
        /* Room Selection Styles */
        .room-selection-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: var(--space-4);
        }
        .room-card {
          padding: var(--space-5);
          background: var(--bg-secondary);
          border: 2px solid var(--border-color);
          border-radius: var(--radius-xl);
          cursor: pointer;
          transition: all var(--transition-normal);
        }
        .room-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
          border-color: var(--primary-300);
        }
        .room-card.available {
          border-left: 4px solid var(--success-500);
        }
        .room-card.occupied {
          border-left: 4px solid var(--warning-500);
          background: var(--warning-50);
        }
        .room-card.locked {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .room-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-3);
        }
        .room-header h3 {
          flex: 1;
          margin: 0;
          font-size: var(--font-size-lg);
        }
        .lock-icon {
          color: var(--warning-600);
        }
        .room-exam {
          font-weight: var(--font-semibold);
          color: var(--primary-600);
          margin-bottom: var(--space-3);
        }
        .room-time, .room-participants, .room-pengawas {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
          margin-bottom: var(--space-2);
        }
        .room-pengawas {
          color: var(--warning-600);
          font-weight: var(--font-medium);
        }
        .room-status-badge {
          display: inline-block;
          padding: var(--space-1) var(--space-3);
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-semibold);
          margin-top: var(--space-3);
        }
        .room-status-badge.available {
          background: var(--success-100);
          color: var(--success-700);
        }
        .room-status-badge.occupied {
          background: var(--warning-100);
          color: var(--warning-700);
        }
        [data-theme="dark"] .room-card.occupied {
          background: rgba(245, 158, 11, 0.1);
        }
        .mb-2 {
          margin-bottom: var(--space-2);
        }
      `}</style>
    </DashboardLayout >
  )
}

export default MonitorUjian
