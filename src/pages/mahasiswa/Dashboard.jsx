import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useSettings } from '../../contexts/SettingsContext'
import { getActiveAcademicYear } from '../../utils/academicYear'
import { jadwalService, matkulService, hasilUjianService } from '../../services/supabaseService'
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
import { jam } from '../../utils/timeFormat'


function MahasiswaDashboard() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const tahunAkademik = getActiveAcademicYear(settings, user)
  const navigate = useNavigate()

  const [jadwalList, setJadwalList] = useState([])
  const [matkulList, setMatkulList] = useState([])
  const [hasilList, setHasilList] = useState([])
  const [loaded, setLoaded] = useState(false)
  // re-render every 30 s so the countdown and "sedang berlangsung" stay current
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const loadData = async () => {
      try {
        const [jadwalData, matkulData, hasilData] = await Promise.all([
          jadwalService.getAll({ tahun_akademik: tahunAkademik }),
          matkulService.getAll(),
          user?.id ? hasilUjianService.getByMahasiswa(user.id, tahunAkademik).catch(() => []) : []
        ])
        setJadwalList(jadwalData || [])
        setMatkulList(matkulData || [])
        setHasilList((hasilData || []).filter(h => h.status !== 'in_progress'))
      } catch (err) {
        console.error('[MahasiswaDashboard] Error loading data:', err)
      } finally {
        setLoaded(true)
      }
    }
    loadData()
  }, [tahunAkademik, user?.id])

  const getField = (obj, snakeCase, camelCase) => obj?.[snakeCase] || obj?.[camelCase]

  // Filter jadwal untuk kelas mahasiswa
  const mahasiswaKelasId = user?.kelasId || user?.kelas_id
  const oneDayMs = 24 * 60 * 60 * 1000

  // Get upcoming exams (not expired more than 1 day)
  const upcomingExams = jadwalList
    .filter(j => {
      const jKelasId = getField(j, 'kelas_id', 'kelasId')
      if (jKelasId !== mahasiswaKelasId) return false
      // Hide exams expired more than 1 day ago
      const waktuSelesai = getField(j, 'waktu_selesai', 'waktuSelesai')
      const waktuMulai = getField(j, 'waktu_mulai', 'waktuMulai')
      let examEnd = new Date(`${j.tanggal}T${waktuSelesai}`)
      const examStart = new Date(`${j.tanggal}T${waktuMulai}`)
      // Handle cross-midnight exams (e.g. 20:18 - 00:18)
      if (examEnd <= examStart) examEnd = new Date(examEnd.getTime() + 24 * 60 * 60 * 1000)
      return (now - examEnd) < oneDayMs
    })
    .map(j => {
      const matkulId = getField(j, 'matkul_id', 'matkulId')
      const matkul = matkulList.find(m => m.id === matkulId)
      const waktuSelesai = getField(j, 'waktu_selesai', 'waktuSelesai')
      const waktuMulai = getField(j, 'waktu_mulai', 'waktuMulai')
      let examEnd = new Date(`${j.tanggal}T${waktuSelesai}`)
      const examStart = new Date(`${j.tanggal}T${waktuMulai}`)
      // Handle cross-midnight exams
      if (examEnd <= examStart) examEnd = new Date(examEnd.getTime() + 24 * 60 * 60 * 1000)

      // Calculate duration in minutes
      const durasi = Math.round((examEnd - examStart) / 60000)

      let status = 'upcoming'
      if (now >= examStart && now <= examEnd) status = 'active'
      else if (now > examEnd) status = 'expired'

      return {
        ...j,
        examStart,
        examEnd,
        waktuMulai,
        waktuSelesai,
        durasi,
        tipeUjian: j.tipe || getField(j, 'tipe_ujian', 'tipeUjian') || 'UTS',
        matkulName: matkul?.nama || 'Mata Kuliah',
        status
      }
    })
    .sort((a, b) => {
      if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal)
      return (a.waktuMulai || '').localeCompare(b.waktuMulai || '')
    })
    .slice(0, 2) // Show only 2 upcoming exams

  // Calculate stats
  const activeExams = upcomingExams.filter(e => e.status === 'active').length
  const pendingExams = upcomingExams.filter(e => e.status === 'upcoming').length

  const doneCount = hasilList.length
  const waitingCount = hasilList.filter(h => h.status !== 'graded').length
  const STATS = [
    { label: 'Ujian Selesai', value: String(doneCount), icon: CheckCircle, color: 'success' },
    { label: 'Ujian Mendatang', value: String(pendingExams), icon: Calendar, color: 'primary' },
    { label: 'Sedang Aktif', value: String(activeExams), icon: Clock, color: 'accent' },
    { label: 'Menunggu Hasil', value: String(waitingCount), icon: Award, color: 'warning' }
  ]

  // The exam that matters most right now: one in progress, else the next one
  const nextExam = upcomingExams.find(e => e.status === 'active') || upcomingExams.find(e => e.status === 'upcoming')
  const untilText = (ms) => {
    const mins = Math.max(0, Math.round(ms / 60000))
    const d = Math.floor(mins / 1440)
    const h = Math.floor((mins % 1440) / 60)
    const m = mins % 60
    if (d > 0) return `${d} hari ${h} jam`
    if (h > 0) return `${h} jam ${m} menit`
    return `${m} menit`
  }
  const tanggalText = (t) => {
    try {
      return new Date(`${t}T12:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
    } catch {
      return t
    }
  }
  const recentHasil = hasilList.slice(0, 3)

  return (
    <DashboardLayout>
      <div className="dashboard-page animate-fadeIn">
        <div className="page-header">
          <h1 className="page-title">Dashboard Mahasiswa</h1>
          <p className="page-subtitle">Selamat datang, {user?.name}! NIM: {user?.nim}</p>
        </div>

        {/* Next exam first: what a student opens the app for */}
        {!loaded ? (
          <span className="skeleton skeleton-card next-exam-skeleton" aria-label="Memuat" />
        ) : nextExam ? (
          <div className={`next-exam ${nextExam.status === 'active' ? 'is-active' : ''}`}>
            <div className="next-exam-info">
              <span className="next-exam-eyebrow">
                {nextExam.status === 'active' ? 'Sedang berlangsung' : 'Ujian berikutnya'}
              </span>
              <h2 className="next-exam-title">{nextExam.tipeUjian} {nextExam.matkulName}</h2>
              <div className="next-exam-meta">
                <span><Calendar size={14} /> {tanggalText(nextExam.tanggal)}</span>
                <span><Clock size={14} /> {jam(nextExam.waktuMulai)} – {jam(nextExam.waktuSelesai)}</span>
              </div>
              <span className="next-exam-countdown">
                {nextExam.status === 'active'
                  ? `Sisa waktu ${untilText(nextExam.examEnd - now)}`
                  : `Dimulai dalam ${untilText(nextExam.examStart - now)}`}
              </span>
            </div>
            <button className="btn btn-lg next-exam-btn" onClick={() => navigate('/mahasiswa/ujian')}>
              {nextExam.status === 'active' ? 'Masuk Ujian' : 'Lihat Ujian'}
              <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <div className="next-exam is-empty">
            <div className="next-exam-info">
              <span className="next-exam-eyebrow">Jadwal ujian</span>
              <h2 className="next-exam-title">Belum ada ujian terjadwal</h2>
              <span className="next-exam-countdown">Ujian akan muncul di sini begitu dijadwalkan.</span>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="stats-grid">
          {STATS.map((stat, index) => (
            <div key={index} className={`stat-card stat-${stat.color}`}>
              <div className="stat-icon">
                <stat.icon size={24} />
              </div>
              <div className="stat-content">
                <span className="stat-value">{loaded ? stat.value : <span className="skeleton skeleton-num" aria-label="Memuat" />}</span>
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
              {!loaded ? (
                <>
                  <span className="skeleton skeleton-card" />
                  <span className="skeleton skeleton-card" />
                </>
              ) : upcomingExams.length > 0 ? (
                <div className="exam-cards">
                  {upcomingExams.map(exam => (
                    <div key={exam.id} className={`exam-card ${exam.status === 'active' ? 'exam-active' : ''}`}>
                      <div className="exam-card-header">
                        <span className="exam-subject">{exam.matkulName}</span>
                        <span className={`badge badge-${exam.status === 'active' ? 'success' : exam.status === 'expired' ? 'warning' : 'primary'}`}>
                          {exam.status === 'active' ? 'Sedang Berlangsung' : exam.status === 'expired' ? 'Waktu Habis' : 'Mendatang'}
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
                          <span>{jam(exam.waktuMulai)} | {exam.durasi || '-'} menit</span>
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
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/mahasiswa/hasil')}>Lihat Semua</button>
            </div>
            <div className="card-body">
              {!loaded ? (
                <>
                  <span className="skeleton skeleton-line" />
                  <span className="skeleton skeleton-line" />
                  <span className="skeleton skeleton-line" />
                </>
              ) : recentHasil.length > 0 ? (
                <ul className="recent-results">
                  {recentHasil.map(h => (
                    <li key={h.id}>
                      <span className="recent-result-name">
                        {(h.jadwal?.tipe || 'Ujian').toUpperCase()} {h.jadwal?.matkul?.nama || ''}
                      </span>
                      <span className={`badge ${h.status === 'graded' ? 'badge-success' : 'badge-warning'}`}>
                        {h.status === 'graded' ? 'Sudah dinilai' : 'Menunggu nilai'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state" style={{ padding: '32px' }}>
                  <FileText size={32} style={{ opacity: 0.5, marginBottom: '8px' }} />
                  <p>Belum ada hasil ujian</p>
                </div>
              )}
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
        .next-exam {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          padding: 1.25rem 1.5rem;
          margin-bottom: var(--space-5);
          border-radius: 26px;
          color: #fff;
          background: linear-gradient(135deg, #1e3a5f 0%, #2d5a9e 60%, #3b82f6 100%);
          box-shadow: 0 18px 40px -20px rgba(30, 58, 120, 0.7);
        }
        .next-exam.is-active {
          background: linear-gradient(135deg, #065f46 0%, #059669 60%, #14b8a6 100%);
        }
        .next-exam.is-empty {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.7);
          border: 1px solid var(--border-color);
          box-shadow: none;
        }
        .next-exam-info {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          min-width: 0;
        }
        .next-exam-eyebrow {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.85;
        }
        .next-exam-title {
          margin: 0;
          font-size: 1.3rem;
          font-weight: 800;
          line-height: 1.25;
        }
        .next-exam-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem 1rem;
          font-size: 0.88rem;
          opacity: 0.92;
        }
        .next-exam-meta span {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }
        .next-exam-countdown {
          margin-top: 0.2rem;
          font-size: 0.9rem;
          font-weight: 700;
        }
        .next-exam.is-empty .next-exam-countdown {
          font-weight: 500;
          color: var(--text-muted);
        }
        .next-exam-btn {
          flex-shrink: 0;
          min-height: 48px;
          padding: 0 1.4rem;
          border: none;
          border-radius: 999px;
          background: #fff !important;
          color: #1e3a5f !important;
          font-weight: 800;
          gap: 0.4rem;
        }
        .next-exam.is-active .next-exam-btn {
          color: #065f46 !important;
        }
        .next-exam-skeleton {
          height: 7.5rem;
          margin-bottom: var(--space-5);
        }
        .recent-results {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .recent-results li {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.6rem 0.8rem;
          border-radius: 14px;
          background: var(--bg-tertiary);
          font-size: 0.88rem;
        }
        .recent-result-name {
          min-width: 0;
          font-weight: 600;
        }
        @media (max-width: 640px) {
          .next-exam {
            padding: 1rem 1.1rem;
            border-radius: 22px;
          }
          .next-exam-title {
            font-size: 1.1rem;
          }
          .next-exam-btn {
            width: 100%;
            justify-content: center;
          }
        }
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
