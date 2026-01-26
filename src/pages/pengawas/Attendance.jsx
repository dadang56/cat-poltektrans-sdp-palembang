import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useSettings } from '../../contexts/SettingsContext'
import { useAuth } from '../../App'
import { jadwalService, matkulService, prodiService, userService, hasilUjianService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    ClipboardCheck,
    Users,
    Search,
    Printer,
    Check,
    X,
    Calendar,
    Clock
} from 'lucide-react'
import '../admin/Dashboard.css'

// localStorage keys
const JADWAL_STORAGE_KEY = 'cat_jadwal_data'
const MATKUL_STORAGE_KEY = 'cat_matkul_data'
const PRODI_STORAGE_KEY = 'cat_prodi_data'
const USERS_STORAGE_KEY = 'cat_users_data'
const EXAM_RESULTS_KEY = 'cat_exam_results'

// Helper for field compatibility (Supabase snake_case vs localStorage camelCase)
const getField = (obj, snakeCase, camelCase) => obj?.[snakeCase] || obj?.[camelCase]

const ABSENCE_REASONS = [
    { value: '', label: 'Pilih Keterangan' },
    { value: 'sakit', label: 'Sakit' },
    { value: 'izin', label: 'Izin Khusus' },
    { value: 'alpha', label: 'Tanpa Keterangan' }
]

function AttendancePage() {
    const { settings } = useSettings()
    const { user } = useAuth()
    const [searchQuery, setSearchQuery] = useState('')
    const [attendanceData, setAttendanceData] = useState({})
    const [activeExams, setActiveExams] = useState([])
    const [selectedExam, setSelectedExam] = useState(null)
    const [matkulList, setMatkulList] = useState([])
    const [prodiList, setProdiList] = useState([])
    const [usersList, setUsersList] = useState([])
    const [examResults, setExamResults] = useState([])
    const printRef = useRef(null)

    // Load data from Supabase or localStorage
    useEffect(() => {
        const loadData = async () => {
            try {
                let jadwalData = []
                let matkulData = []

                if (isSupabaseConfigured()) {
                    const [jadwal, matkul, prodi, users, hasil] = await Promise.all([
                        jadwalService.getAll(),
                        matkulService.getAll(),
                        prodiService.getAll(),
                        userService.getAll(),
                        hasilUjianService.getAll()
                    ])
                    jadwalData = jadwal
                    matkulData = matkul
                    setMatkulList(matkul)
                    setProdiList(prodi)
                    setUsersList(users)

                    // Map Supabase results to expected format
                    const mappedResults = hasil.map(h => ({
                        examId: h.jadwal_id,
                        mahasiswaId: h.mahasiswa_id,
                        submitted: true
                    }))
                    setExamResults(mappedResults)
                } else {
                    const jadwal = localStorage.getItem(JADWAL_STORAGE_KEY)
                    const matkul = localStorage.getItem(MATKUL_STORAGE_KEY)
                    const prodi = localStorage.getItem(PRODI_STORAGE_KEY)
                    const users = localStorage.getItem(USERS_STORAGE_KEY)

                    jadwalData = jadwal ? JSON.parse(jadwal) : []
                    matkulData = matkul ? JSON.parse(matkul) : []
                    setMatkulList(matkulData)
                    if (prodi) setProdiList(JSON.parse(prodi))
                    if (users) setUsersList(JSON.parse(users))

                    // Fallback to localStorage results
                    const results = localStorage.getItem(EXAM_RESULTS_KEY)
                    if (results) setExamResults(JSON.parse(results))
                }

                // Get active exams (today)
                const now = new Date()
                const today = now.toISOString().split('T')[0]
                const active = jadwalData.filter(j => j.tanggal === today).map(j => {
                    const matkulId = getField(j, 'matkul_id', 'matkulId')
                    const mk = matkulData.find(m => m.id === matkulId)
                    const tipeUjian = getField(j, 'tipe_ujian', 'tipeUjian') || 'Ujian'
                    const waktuMulai = getField(j, 'waktu_mulai', 'waktuMulai')
                    const waktuSelesai = getField(j, 'waktu_selesai', 'waktuSelesai')
                    const kelasId = getField(j, 'kelas_id', 'kelasId')
                    return {
                        ...j,
                        kelasId,
                        tipeUjian,
                        waktuMulai,
                        waktuSelesai,
                        examName: `${tipeUjian} ${mk?.nama || 'Ujian'}`,
                        matkulName: mk?.nama || 'Mata Kuliah'
                    }
                })
                setActiveExams(active)
            } catch (err) {
                console.error('[Attendance] Error loading data:', err)
            }
        }
        loadData()
    }, [])

    // Get mahasiswa for selected exam's kelas
    const mahasiswaForExam = selectedExam
        ? usersList.filter(u => u.role === 'mahasiswa' && (String(getField(u, 'kelas_id', 'kelasId')) === String(selectedExam.kelasId)))
        : []

    // Filter by search
    const filteredStudents = mahasiswaForExam.filter(s =>
        s.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.nim || s.nim_nip || '')?.includes(searchQuery)
    )

    // Initialize attendance when exam selected - pre-fill from exam results
    const handleExamSelect = (examId) => {
        const exam = activeExams.find(e => String(e.id) === String(examId))
        setSelectedExam(exam || null)
        if (exam) {
            const students = usersList.filter(u => u.role === 'mahasiswa' && (String(getField(u, 'kelas_id', 'kelasId')) === String(exam.kelasId)))
            // Get students who submitted this exam
            const submittedIds = examResults
                .filter(r => String(r.examId) === String(exam.id))
                .map(r => String(r.mahasiswaId))

            const initialData = {}
            students.forEach(s => {
                // Mark as hadir if they submitted the exam
                const hasSubmitted = submittedIds.includes(String(s.id))
                initialData[s.id] = {
                    status: hasSubmitted ? 'hadir' : 'tidak_hadir',
                    reason: hasSubmitted ? '' : 'alpha'
                }
            })
            setAttendanceData(initialData)
        }
    }

    const handleStatusChange = (studentId, status) => {
        setAttendanceData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                status,
                reason: status === 'hadir' ? '' : (prev[studentId]?.reason || 'alpha')
            }
        }))
    }

    const handleReasonChange = (studentId, reason) => {
        setAttendanceData(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], reason }
        }))
    }

    const getProdiInfo = (prodiId) => {
        const prodi = prodiList.find(p => p.id === prodiId)
        return prodi || { kode: '-', nama: '-' }
    }

    // Stats
    const stats = {
        total: mahasiswaForExam.length,
        hadir: Object.values(attendanceData).filter(d => d.status === 'hadir').length,
        sakit: Object.values(attendanceData).filter(d => d.status === 'tidak_hadir' && d.reason === 'sakit').length,
        izin: Object.values(attendanceData).filter(d => d.status === 'tidak_hadir' && d.reason === 'izin').length,
        alpha: Object.values(attendanceData).filter(d => d.status === 'tidak_hadir' && d.reason === 'alpha').length
    }

    const handlePrint = () => {
        const printContent = printRef.current
        const originalContents = document.body.innerHTML
        document.body.innerHTML = printContent.innerHTML
        window.print()
        document.body.innerHTML = originalContents
        window.location.reload()
    }

    return (
        <DashboardLayout>
            <div className="attendance-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Kehadiran Peserta Ujian</h1>
                        <p className="page-subtitle">Absensi dan pencatatan kehadiran peserta</p>
                    </div>
                    <div className="page-actions">
                        {selectedExam && (
                            <button className="btn btn-primary" onClick={handlePrint}>
                                <Printer size={18} />
                                Print Daftar Hadir
                            </button>
                        )}
                    </div>
                </div>

                {/* Exam Selection */}
                <div className="card mb-4">
                    <div className="card-body">
                        <div className="room-selector">
                            <div className="selector-item">
                                <label>Pilih Sesi Ujian:</label>
                                <select
                                    className="form-input"
                                    value={selectedExam?.id || ''}
                                    onChange={(e) => handleExamSelect(e.target.value)}
                                >
                                    <option value="">-- Pilih Ujian Hari Ini --</option>
                                    {activeExams.map(exam => (
                                        <option key={exam.id} value={exam.id}>
                                            {exam.examName} ({exam.ruang || 'Ruang'}) - {exam.waktuMulai}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {selectedExam && (
                                <>
                                    <div className="selector-item">
                                        <Calendar size={16} />
                                        <span className="session-info">{selectedExam.tanggal}</span>
                                    </div>
                                    <div className="selector-item">
                                        <Clock size={16} />
                                        <span className="session-info">{selectedExam.waktuMulai} - {selectedExam.waktuSelesai}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {activeExams.length === 0 ? (
                    <div className="card">
                        <div className="card-body text-center" style={{ padding: '48px', opacity: 0.6 }}>
                            <ClipboardCheck size={48} style={{ marginBottom: '16px' }} />
                            <h4 style={{ margin: '0 0 8px' }}>Tidak Ada Ujian Hari Ini</h4>
                            <p style={{ margin: 0 }}>Tidak ada jadwal ujian yang terdaftar untuk hari ini.</p>
                        </div>
                    </div>
                ) : !selectedExam ? (
                    <div className="card">
                        <div className="card-body text-center" style={{ padding: '48px', opacity: 0.6 }}>
                            <ClipboardCheck size={48} style={{ marginBottom: '16px' }} />
                            <h4 style={{ margin: '0 0 8px' }}>Pilih Sesi Ujian</h4>
                            <p style={{ margin: 0 }}>Pilih sesi ujian dari dropdown di atas untuk mengelola kehadiran peserta.</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Stats */}
                        <div className="attendance-stats">
                            <div className="att-stat">
                                <span className="att-stat-value">{stats.total}</span>
                                <span className="att-stat-label">Total</span>
                            </div>
                            <div className="att-stat success">
                                <span className="att-stat-value">{stats.hadir}</span>
                                <span className="att-stat-label">Hadir</span>
                            </div>
                            <div className="att-stat warning">
                                <span className="att-stat-value">{stats.sakit}</span>
                                <span className="att-stat-label">Sakit</span>
                            </div>
                            <div className="att-stat info">
                                <span className="att-stat-value">{stats.izin}</span>
                                <span className="att-stat-label">Izin</span>
                            </div>
                            <div className="att-stat error">
                                <span className="att-stat-value">{stats.alpha}</span>
                                <span className="att-stat-label">Alpha</span>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="search-filter card mb-4">
                            <div className="card-body">
                                <div className="search-box">
                                    <Search size={18} className="search-icon" />
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Cari nama atau NIM..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Attendance Table */}
                        <div className="card">
                            <div className="card-header">
                                <h3>{selectedExam.examName} - Daftar Hadir</h3>
                            </div>
                            <div className="card-body">
                                {filteredStudents.length === 0 ? (
                                    <div className="text-center" style={{ padding: '24px', opacity: 0.6 }}>
                                        <Users size={32} style={{ marginBottom: '8px' }} />
                                        <p>Tidak ada mahasiswa di kelas ini</p>
                                    </div>
                                ) : (
                                    <div className="table-container">
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '50px' }}>No</th>
                                                    <th>Nama</th>
                                                    <th>NIM</th>
                                                    <th>Ruangan</th>
                                                    <th style={{ width: '120px' }}>Status</th>
                                                    <th style={{ width: '180px' }}>Keterangan</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredStudents.map((student, idx) => {
                                                    const data = attendanceData[student.id] || { status: 'tidak_hadir', reason: 'alpha' }
                                                    return (
                                                        <tr key={student.id}>
                                                            <td>{idx + 1}</td>
                                                            <td className="font-medium">{student.nama}</td>
                                                            <td>{student.nim}</td>
                                                            <td>
                                                                <span className="badge badge-secondary">{selectedExam?.ruangan || 'Ruang 1'}</span>
                                                            </td>
                                                            <td>
                                                                <div className="status-toggle">
                                                                    <button
                                                                        className={`toggle-btn hadir ${data.status === 'hadir' ? 'active' : ''}`}
                                                                        onClick={() => handleStatusChange(student.id, 'hadir')}
                                                                    >
                                                                        <Check size={14} />
                                                                    </button>
                                                                    <button
                                                                        className={`toggle-btn tidak ${data.status === 'tidak_hadir' ? 'active' : ''}`}
                                                                        onClick={() => handleStatusChange(student.id, 'tidak_hadir')}
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                {data.status === 'tidak_hadir' ? (
                                                                    <select
                                                                        className="form-input form-input-sm"
                                                                        value={data.reason}
                                                                        onChange={(e) => handleReasonChange(student.id, e.target.value)}
                                                                    >
                                                                        {ABSENCE_REASONS.map(r => (
                                                                            <option key={r.value} value={r.value}>{r.label}</option>
                                                                        ))}
                                                                    </select>
                                                                ) : (
                                                                    <span className="text-success">-</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
                <div style={{ marginTop: '20px', padding: '10px', background: '#f5f5f5', fontSize: '10px', color: '#666' }}>
                    <p><strong>Debug Info (Untuk konfirmasi teknis):</strong></p>
                    <p>Exam ID: {selectedExam?.id}</p>
                    <p>Total Data Ujian Loaded: {examResults.length}</p>
                    <p>Submissions for this Exam: {examResults.filter(r => String(r.examId) === String(selectedExam?.id)).length}</p>
                    <p>Sample Student IDs: {examResults.slice(0, 2).map(r => r.mahasiswaId).join(', ')}</p>
                </div>
            </div>

            {/* Print Template */}
            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    <style>{`
                        @page { size: A4 portrait; margin: 15mm; }
                        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Times New Roman', serif !important; }
                        body { font-size: 11pt; }
                        .print-header { display: flex; align-items: center; gap: 15px; border-bottom: 3px double #000; padding-bottom: 10px; margin-bottom: 20px; }
                        .print-logo { width: 60px; height: 60px; object-fit: contain; }
                        .print-institution { flex: 1; text-align: center; }
                        .print-institution h2 { font-size: 14pt; text-transform: uppercase; }
                        .print-institution p { font-size: 10pt; margin: 3px 0 0; }
                        .print-title { text-align: center; margin: 20px 0; }
                        .print-title h3 { font-size: 13pt; text-decoration: underline; }
                        .print-info { margin-bottom: 15px; }
                        .print-info td { padding: 3px 10px 3px 0; }
                        .print-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                        .print-table th, .print-table td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
                        .print-table th { background: #f0f0f0; font-weight: bold; text-align: center; }
                        .print-table td.center { text-align: center; }
                        .print-footer { margin-top: 40px; display: flex; justify-content: space-between; }
                        .print-sign { text-align: center; width: 200px; }
                        .print-sign-line { border-bottom: 1px solid #000; margin-top: 60px; margin-bottom: 5px; }
                    `}</style>

                    <div className="print-header">
                        {settings?.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className="print-logo" />
                        ) : (
                            <div style={{ width: 60, height: 60, background: '#333', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>CAT</div>
                        )}
                        <div className="print-institution">
                            <h2>{settings?.institution || 'Politeknik Transportasi SDP Palembang'}</h2>
                            <p>{settings?.address || 'Jl. Residen Abdul Rozak, Palembang'}</p>
                        </div>
                    </div>

                    <div className="print-title">
                        <h3>DAFTAR HADIR PESERTA UJIAN</h3>
                    </div>

                    {selectedExam && (
                        <>
                            <div className="print-info">
                                <table>
                                    <tbody>
                                        <tr><td>Mata Ujian</td><td>: {selectedExam.examName}</td></tr>
                                        <tr><td>Ruangan</td><td>: {selectedExam.ruang || '-'}</td></tr>
                                        <tr><td>Hari/Tanggal</td><td>: {new Date(selectedExam.tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
                                        <tr><td>Waktu</td><td>: {selectedExam.waktuMulai} - {selectedExam.waktuSelesai}</td></tr>
                                    </tbody>
                                </table>
                            </div>

                            <table className="print-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px' }}>No</th>
                                        <th>Nama</th>
                                        <th>NIM</th>
                                        <th style={{ width: '80px' }}>Hadir</th>
                                        <th style={{ width: '120px' }}>Keterangan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mahasiswaForExam.map((student, idx) => {
                                        const data = attendanceData[student.id] || { status: 'tidak_hadir', reason: 'alpha' }
                                        const reason = ABSENCE_REASONS.find(r => r.value === data.reason)?.label || '-'
                                        return (
                                            <tr key={student.id}>
                                                <td className="center">{idx + 1}</td>
                                                <td>{student.nama}</td>
                                                <td>{student.nim}</td>
                                                <td className="center">{data.status === 'hadir' ? '✓' : '-'}</td>
                                                <td>{data.status === 'tidak_hadir' ? reason : '-'}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </>
                    )}

                    <div className="print-footer">
                        <div></div>
                        <div className="print-sign">
                            <p>Palembang, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <p>Pengawas Ujian,</p>
                            <div className="print-sign-line"></div>
                            <p><strong>{user?.name || '________________________'}</strong></p>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .attendance-page { padding: 0; }
                .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }
                .page-actions { display: flex; gap: 0.75rem; }
                .mb-4 { margin-bottom: 1.5rem; }
                .room-selector { display: flex; flex-wrap: wrap; gap: 2rem; align-items: center; }
                .selector-item { display: flex; align-items: center; gap: 0.75rem; }
                .selector-item label { font-weight: 500; color: var(--text-secondary); }
                .selector-item .form-input { min-width: 280px; }
                .session-info { font-weight: 600; color: var(--primary-600); }
                .attendance-stats { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }
                .att-stat { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 0.75rem; padding: 1rem 1.5rem; text-align: center; min-width: 100px; }
                .att-stat-value { display: block; font-size: 1.5rem; font-weight: 700; color: var(--text-primary); }
                .att-stat-label { font-size: 0.75rem; color: var(--text-muted); }
                .att-stat.success .att-stat-value { color: var(--success-500); }
                .att-stat.warning .att-stat-value { color: var(--warning-500); }
                .att-stat.info .att-stat-value { color: var(--info-500); }
                .att-stat.error .att-stat-value { color: var(--error-500); }
                .search-box { position: relative; }
                .search-box .search-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
                .search-box .form-input { padding-left: 2.75rem; }
                .card-header { padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); }
                .card-header h3 { margin: 0; font-size: 1rem; }
                .status-toggle { display: flex; gap: 0.25rem; }
                .toggle-btn { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 2px solid var(--border-color); border-radius: 0.5rem; background: var(--bg-secondary); cursor: pointer; transition: all 0.2s; }
                .toggle-btn.hadir.active { background: var(--success-500); border-color: var(--success-500); color: white; }
                .toggle-btn.tidak.active { background: var(--error-500); border-color: var(--error-500); color: white; }
                .toggle-btn:hover { transform: scale(1.05); }
                .form-input-sm { padding: 0.375rem 0.5rem; font-size: 0.875rem; }
                .text-success { color: var(--success-500); }
            `}</style>
        </DashboardLayout>
    )
}

export default AttendancePage
