import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useSettings } from '../../contexts/SettingsContext'
import {
    jadwalService,
    matkulService,
    kelasService,
    userService,
    prodiService,
    isSupabaseConfigured
} from '../../services/supabaseService'
import {
    Download,
    Calendar,
    FileSpreadsheet,
    Users,
    ClipboardList,
    GraduationCap,
    BookOpen,
    CheckCircle,
    AlertCircle
} from 'lucide-react'
import { exportToExcel } from '../../utils/excelUtils'
import './Dashboard.css'

// LocalStorage keys
const JADWAL_STORAGE_KEY = 'cat_jadwal_data'
const MATKUL_STORAGE_KEY = 'cat_matkul_data'
const USERS_STORAGE_KEY = 'cat_users_data'
const KELAS_STORAGE_KEY = 'cat_kelas_data'
const EXAM_RESULTS_KEY = 'cat_exam_results'

// Generate Tahun Akademik options
const generateTahunAjaranOptions = () => {
    const options = []
    const currentYear = new Date().getFullYear()
    for (let year = currentYear + 1; year >= currentYear - 3; year--) {
        options.push(`${year}/${year + 1} Ganjil`)
        options.push(`${year}/${year + 1} Genap`)
    }
    return options
}

const TAHUN_AJARAN_OPTIONS = generateTahunAjaranOptions()

function ExportData() {
    const { user } = useAuth()
    const { settings } = useSettings()
    const [selectedTA, setSelectedTA] = useState('')
    const [isExporting, setIsExporting] = useState(null)
    const [exportStatus, setExportStatus] = useState(null)

    // Data states
    const [jadwalList, setJadwalList] = useState([])
    const [matkulList, setMatkulList] = useState([])
    const [kelasList, setKelasList] = useState([])
    const [usersList, setUsersList] = useState([])
    const [prodiList, setProdiList] = useState([])
    const [examResults, setExamResults] = useState([])

    // Load TA from settings
    useEffect(() => {
        if (settings?.tahunAkademik) {
            setSelectedTA(settings.tahunAkademik)
        } else if (TAHUN_AJARAN_OPTIONS.length > 0) {
            setSelectedTA(TAHUN_AJARAN_OPTIONS[0])
        }
    }, [settings])

    // Load data
    useEffect(() => {
        const loadData = async () => {
            try {
                if (isSupabaseConfigured()) {
                    const [jadwal, matkul, kelas, users, prodi] = await Promise.all([
                        jadwalService.getAll(),
                        matkulService.getAll(),
                        kelasService.getAll(),
                        userService.getAll(),
                        prodiService.getAll()
                    ])
                    setJadwalList(jadwal)
                    setMatkulList(matkul)
                    setKelasList(kelas)
                    setUsersList(users)
                    setProdiList(prodi)
                } else {
                    // Fallback to localStorage
                    const jadwal = localStorage.getItem(JADWAL_STORAGE_KEY)
                    const matkul = localStorage.getItem(MATKUL_STORAGE_KEY)
                    const kelas = localStorage.getItem(KELAS_STORAGE_KEY)
                    const users = localStorage.getItem(USERS_STORAGE_KEY)
                    setJadwalList(jadwal ? JSON.parse(jadwal) : [])
                    setMatkulList(matkul ? JSON.parse(matkul) : [])
                    setKelasList(kelas ? JSON.parse(kelas) : [])
                    setUsersList(users ? JSON.parse(users) : [])
                }

                // Load exam results from localStorage
                const results = localStorage.getItem(EXAM_RESULTS_KEY)
                setExamResults(results ? JSON.parse(results) : [])
            } catch (err) {
                console.error('Error loading data:', err)
            }
        }
        loadData()
    }, [])

    // Helper functions
    const getField = (obj, snakeCase, camelCase) => obj?.[snakeCase] ?? obj?.[camelCase]
    const getMatkul = (id) => matkulList.find(m => String(m.id) === String(id))
    const getKelas = (id) => kelasList.find(k => String(k.id) === String(id))
    const getProdi = (id) => prodiList.find(p => String(p.id) === String(id))
    const getUser = (id) => usersList.find(u => String(u.id) === String(id))

    // Filter jadwal by TA
    const filteredJadwal = jadwalList.filter(j => {
        const ta = getField(j, 'tahun_akademik', 'tahunAkademik')
        return !ta || ta === selectedTA
    })

    // Export functions
    const handleExportJadwal = async () => {
        setIsExporting('jadwal')
        try {
            const data = filteredJadwal.map(j => {
                const matkul = getMatkul(getField(j, 'matkul_id', 'matkulId'))
                const kelas = getKelas(getField(j, 'kelas_id', 'kelasId'))
                return {
                    'Tanggal': j.tanggal,
                    'Waktu Mulai': getField(j, 'waktu_mulai', 'waktuMulai'),
                    'Waktu Selesai': getField(j, 'waktu_selesai', 'waktuSelesai'),
                    'Tipe': getField(j, 'tipe_ujian', 'tipeUjian') || j.tipe,
                    'Mata Kuliah': matkul?.nama || '-',
                    'Kelas': kelas?.nama || '-',
                    'Ruangan': getField(j, 'ruangan', 'ruang') || '-',
                    'Tahun Akademik': getField(j, 'tahun_akademik', 'tahunAkademik') || selectedTA
                }
            })
            exportToExcel(data, `Jadwal_Ujian_${selectedTA.replace(/\//g, '-')}`)
            setExportStatus({ type: 'success', message: 'Jadwal Ujian berhasil diekspor!' })
        } catch (err) {
            console.error('Export error:', err)
            setExportStatus({ type: 'error', message: 'Gagal mengekspor data' })
        }
        setIsExporting(null)
        setTimeout(() => setExportStatus(null), 3000)
    }

    const handleExportNilai = async () => {
        setIsExporting('nilai')
        try {
            // Filter exam results by jadwal in selected TA
            const jadwalIds = filteredJadwal.map(j => String(j.id))
            const filteredResults = examResults.filter(r =>
                jadwalIds.includes(String(r.jadwalId || r.jadwal_id))
            )

            const data = filteredResults.map(r => {
                const jadwal = jadwalList.find(j => String(j.id) === String(r.jadwalId || r.jadwal_id))
                const matkul = jadwal ? getMatkul(getField(jadwal, 'matkul_id', 'matkulId')) : null
                const mahasiswa = getUser(r.mahasiswaId || r.mahasiswa_id)
                return {
                    'NIM': mahasiswa?.nim_nip || r.nim || '-',
                    'Nama Mahasiswa': mahasiswa?.nama || r.nama || '-',
                    'Mata Kuliah': matkul?.nama || '-',
                    'Tipe Ujian': jadwal ? (getField(jadwal, 'tipe_ujian', 'tipeUjian') || jadwal.tipe) : '-',
                    'Nilai': r.nilai || r.nilai_total || 0,
                    'Benar': r.jumlah_benar || r.benar || 0,
                    'Salah': r.jumlah_salah || r.salah || 0,
                    'Tanggal': jadwal?.tanggal || '-',
                    'Tahun Akademik': selectedTA
                }
            })
            exportToExcel(data, `Hasil_Ujian_${selectedTA.replace(/\//g, '-')}`)
            setExportStatus({ type: 'success', message: 'Hasil Ujian berhasil diekspor!' })
        } catch (err) {
            console.error('Export error:', err)
            setExportStatus({ type: 'error', message: 'Gagal mengekspor data' })
        }
        setIsExporting(null)
        setTimeout(() => setExportStatus(null), 3000)
    }

    const handleExportMahasiswa = async () => {
        setIsExporting('mahasiswa')
        try {
            const mahasiswaList = usersList.filter(u => u.role === 'mahasiswa')
            const data = mahasiswaList.map(m => {
                const kelas = getKelas(getField(m, 'kelas_id', 'kelasId'))
                const prodi = getProdi(getField(m, 'prodi_id', 'prodiId'))
                return {
                    'NIM': m.nim_nip || m.nim || '-',
                    'Nama': m.nama || '-',
                    'Email': m.email || '-',
                    'Kelas': kelas?.nama || '-',
                    'Program Studi': prodi?.nama || '-',
                    'Status': m.status || 'active'
                }
            })
            exportToExcel(data, `Data_Mahasiswa_${selectedTA.replace(/\//g, '-')}`)
            setExportStatus({ type: 'success', message: 'Data Mahasiswa berhasil diekspor!' })
        } catch (err) {
            console.error('Export error:', err)
            setExportStatus({ type: 'error', message: 'Gagal mengekspor data' })
        }
        setIsExporting(null)
        setTimeout(() => setExportStatus(null), 3000)
    }

    const handleExportDosen = async () => {
        setIsExporting('dosen')
        try {
            const dosenList = usersList.filter(u => u.role === 'dosen')
            const data = dosenList.map(d => {
                const prodi = getProdi(getField(d, 'prodi_id', 'prodiId'))
                return {
                    'NIP': d.nim_nip || d.nip || '-',
                    'Nama': d.nama || '-',
                    'Email': d.email || '-',
                    'Program Studi': prodi?.nama || '-',
                    'Status': d.status || 'active'
                }
            })
            exportToExcel(data, `Data_Dosen_${selectedTA.replace(/\//g, '-')}`)
            setExportStatus({ type: 'success', message: 'Data Dosen berhasil diekspor!' })
        } catch (err) {
            console.error('Export error:', err)
            setExportStatus({ type: 'error', message: 'Gagal mengekspor data' })
        }
        setIsExporting(null)
        setTimeout(() => setExportStatus(null), 3000)
    }

    const handleExportMatkul = async () => {
        setIsExporting('matkul')
        try {
            const data = matkulList.map(m => {
                const prodi = getProdi(getField(m, 'prodi_id', 'prodiId'))
                return {
                    'Kode': m.kode || '-',
                    'Nama Mata Kuliah': m.nama || '-',
                    'SKS': m.sks || 0,
                    'Program Studi': prodi?.nama || '-'
                }
            })
            exportToExcel(data, `Data_Mata_Kuliah_${selectedTA.replace(/\//g, '-')}`)
            setExportStatus({ type: 'success', message: 'Data Mata Kuliah berhasil diekspor!' })
        } catch (err) {
            console.error('Export error:', err)
            setExportStatus({ type: 'error', message: 'Gagal mengekspor data' })
        }
        setIsExporting(null)
        setTimeout(() => setExportStatus(null), 3000)
    }

    // Export options config
    const exportOptions = [
        {
            id: 'jadwal',
            title: 'Jadwal Ujian',
            description: `Ekspor ${filteredJadwal.length} jadwal ujian`,
            icon: Calendar,
            color: 'primary',
            onClick: handleExportJadwal
        },
        {
            id: 'nilai',
            title: 'Hasil Ujian / Nilai',
            description: 'Ekspor hasil ujian mahasiswa',
            icon: ClipboardList,
            color: 'success',
            onClick: handleExportNilai
        },
        {
            id: 'mahasiswa',
            title: 'Data Mahasiswa',
            description: `Ekspor ${usersList.filter(u => u.role === 'mahasiswa').length} mahasiswa`,
            icon: GraduationCap,
            color: 'accent',
            onClick: handleExportMahasiswa
        },
        {
            id: 'dosen',
            title: 'Data Dosen',
            description: `Ekspor ${usersList.filter(u => u.role === 'dosen').length} dosen`,
            icon: Users,
            color: 'warning',
            onClick: handleExportDosen
        },
        {
            id: 'matkul',
            title: 'Mata Kuliah',
            description: `Ekspor ${matkulList.length} mata kuliah`,
            icon: BookOpen,
            color: 'secondary',
            onClick: handleExportMatkul
        }
    ]

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Ekspor Data</h1>
                        <p className="page-subtitle">Unduh data dalam format Excel berdasarkan tahun akademik</p>
                    </div>
                </div>

                {/* Tahun Akademik Selector */}
                <div className="card mb-4">
                    <div className="card-body">
                        <div className="flex items-center gap-4" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Calendar size={20} className="text-primary" />
                                <span className="font-medium">Tahun Akademik:</span>
                            </div>
                            <select
                                className="form-input"
                                value={selectedTA}
                                onChange={(e) => setSelectedTA(e.target.value)}
                                style={{ minWidth: '200px' }}
                            >
                                {TAHUN_AJARAN_OPTIONS.map(ta => (
                                    <option key={ta} value={ta}>{ta}</option>
                                ))}
                            </select>
                            <span className="badge badge-primary">{filteredJadwal.length} Jadwal</span>
                        </div>
                    </div>
                </div>

                {/* Export Options Grid */}
                <div className="export-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1.5rem'
                }}>
                    {exportOptions.map(option => (
                        <div key={option.id} className={`card export-card export-${option.color}`}>
                            <div className="card-body" style={{ padding: '1.5rem' }}>
                                <div className="export-icon" style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '1rem',
                                    background: `var(--${option.color}-100)`
                                }}>
                                    <option.icon size={28} style={{ color: `var(--${option.color}-600)` }} />
                                </div>
                                <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>{option.title}</h3>
                                <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
                                    {option.description}
                                </p>
                                <button
                                    className={`btn btn-${option.color}`}
                                    onClick={option.onClick}
                                    disabled={isExporting === option.id}
                                    style={{ width: '100%' }}
                                >
                                    {isExporting === option.id ? (
                                        <>
                                            <span className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }}></span>
                                            Mengekspor...
                                        </>
                                    ) : (
                                        <>
                                            <FileSpreadsheet size={18} style={{ marginRight: '8px' }} />
                                            Ekspor Excel
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Export Status Toast */}
                {exportStatus && (
                    <div style={{
                        position: 'fixed',
                        bottom: '2rem',
                        right: '2rem',
                        padding: '1rem 1.5rem',
                        borderRadius: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        color: 'white',
                        fontWeight: 500,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                        animation: 'slideIn 0.3s ease',
                        zIndex: 1000,
                        background: exportStatus.type === 'success' ? 'var(--success-500)' : 'var(--error-500)'
                    }}>
                        {exportStatus.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                        {exportStatus.message}
                    </div>
                )}
            </div>

            <style>{`
                .mb-4 { margin-bottom: 1rem; }
                .export-card {
                    transition: all 0.2s ease;
                    border: 1px solid var(--border-color);
                }
                .export-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                }
                [data-theme="dark"] .export-icon {
                    background: rgba(99, 102, 241, 0.15) !important;
                }
                [data-theme="dark"] .export-primary .export-icon { background: rgba(99, 102, 241, 0.15) !important; }
                [data-theme="dark"] .export-success .export-icon { background: rgba(34, 197, 94, 0.15) !important; }
                [data-theme="dark"] .export-accent .export-icon { background: rgba(139, 92, 246, 0.15) !important; }
                [data-theme="dark"] .export-warning .export-icon { background: rgba(245, 158, 11, 0.15) !important; }
                [data-theme="dark"] .export-secondary .export-icon { background: rgba(100, 116, 139, 0.15) !important; }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </DashboardLayout>
    )
}

export default ExportData
