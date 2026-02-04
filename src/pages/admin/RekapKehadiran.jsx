import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useSettings } from '../../contexts/SettingsContext'
import { exportToXLSX } from '../../utils/excelUtils'
import { hasilUjianService, jadwalService, prodiService, userService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    ClipboardCheck,
    Search,
    Download,
    Printer,
    Filter,
    Calendar,
    Users,
    CheckCircle,
    FileSpreadsheet,
    User,
    RefreshCw
} from 'lucide-react'
import '../admin/Dashboard.css'

function RekapKehadiranPage() {
    const { user } = useAuth()
    const { settings } = useSettings()
    const [viewMode, setViewMode] = useState('per-ujian') // per-ujian | per-mahasiswa
    const [search, setSearch] = useState('')
    const [prodiFilter, setProdiFilter] = useState(user?.prodi_id || 'all')
    const [dateFilter, setDateFilter] = useState('')
    const [tahunAkademik, setTahunAkademik] = useState('2024/2025')
    const [kehadiranData, setKehadiranData] = useState([])
    const [kehadiranPerMahasiswa, setKehadiranPerMahasiswa] = useState([])
    const [prodiList, setProdiList] = useState([])
    const [loading, setLoading] = useState(true)

    // Load data from Supabase
    useEffect(() => {
        const loadData = async () => {
            if (!isSupabaseConfigured()) {
                console.log('Supabase not configured, using empty data')
                setLoading(false)
                return
            }

            setLoading(true)
            try {
                // Get prodi list for filters
                const prodiData = await prodiService.getAll()
                setProdiList(prodiData || [])

                // Get all jadwal with related data
                const jadwalData = await jadwalService.getAll()
                console.log('[RekapKehadiran] Jadwal loaded:', jadwalData?.length)

                // Get all hasil ujian (exam results = attendance)
                const hasilData = await hasilUjianService.getAll()
                console.log('[RekapKehadiran] Hasil ujian loaded:', hasilData?.length)

                // Get all mahasiswa
                const mahasiswaData = await userService.getAll({ role: 'mahasiswa' })
                console.log('[RekapKehadiran] Mahasiswa loaded:', mahasiswaData?.length)

                // Group by exam - per ujian view
                const examGroups = {}
                jadwalData?.forEach(j => {
                    const matkul = j.matkul || {}
                    const ruangan = j.ruang_ujian || {}
                    const pengawas = j.pengawas || {}
                    const kelas = j.kelas || {}

                    // Get students in this kelas
                    const studentsInKelas = mahasiswaData?.filter(m => m.kelas_id === j.kelas_id) || []

                    // Get submitted results for this jadwal
                    const submittedResults = hasilData?.filter(r => r.jadwal_id === j.id) || []

                    examGroups[j.id] = {
                        id: j.id,
                        examName: `${j.tipe || 'UJIAN'} ${matkul.nama || 'Ujian'}`,
                        room: ruangan.nama || j.ruangan || '-',
                        date: j.tanggal,
                        time: `${j.waktu_mulai || '08:00'} - ${j.waktu_selesai || '10:00'}`,
                        pengawas: pengawas.nama || 'Pengawas',
                        prodiId: matkul.prodi_id,
                        tahunAkademik: j.tahun_akademik || '2024/2025',
                        kelas: kelas.nama || '-',
                        summary: {
                            total: studentsInKelas.length,
                            hadir: submittedResults.length,
                            sakit: 0,
                            izin: 0,
                            alpha: Math.max(0, studentsInKelas.length - submittedResults.length)
                        }
                    }
                })
                setKehadiranData(Object.values(examGroups))

                // Per mahasiswa view
                const mahasiswaAttendance = {}
                mahasiswaData?.forEach(m => {
                    const kelas = m.kelas || {}
                    // Get all exams for this student's class
                    const examsForKelas = jadwalData?.filter(j => j.kelas_id === m.kelas_id) || []
                    // Get results where this student attended
                    const attendedExams = hasilData?.filter(r => r.mahasiswa_id === m.id) || []

                    mahasiswaAttendance[m.id] = {
                        id: m.id,
                        nim: m.nim_nip,
                        nama: m.nama,
                        kelas: kelas.nama || '-',
                        ruangan: '-',
                        prodiId: m.prodi_id,
                        total: examsForKelas.length,
                        hadir: attendedExams.length,
                        sakit: 0,
                        izin: 0,
                        alpha: Math.max(0, examsForKelas.length - attendedExams.length)
                    }
                })
                setKehadiranPerMahasiswa(Object.values(mahasiswaAttendance))

            } catch (error) {
                console.error('[RekapKehadiran] Error loading data:', error)
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [user])

    // Filter based on admin prodi or show all for superadmin
    const filteredData = kehadiranData.filter(item => {
        const matchesProdi = user?.role === 'superadmin'
            ? (prodiFilter === 'all' || String(item.prodiId) === String(prodiFilter))
            : String(item.prodiId) === String(user?.prodiId)
        const matchesSearch = (item.examName || '').toLowerCase().includes(search.toLowerCase()) ||
            (item.pengawas || '').toLowerCase().includes(search.toLowerCase())
        const matchesDate = !dateFilter || item.date === dateFilter
        return matchesProdi && matchesSearch && matchesDate
    })

    const getProdiName = (prodiId) => {
        return prodiList.find(p => p.id === prodiId)?.kode || '-'
    }

    const getAttendanceRate = (summary) => {
        return summary.total > 0 ? ((summary.hadir / summary.total) * 100).toFixed(1) : '0.0'
    }

    const getMahasiswaRate = (student) => {
        return student.total > 0 ? ((student.hadir / student.total) * 100).toFixed(1) : '0.0'
    }

    // Filter for per-mahasiswa view
    const filteredMahasiswa = kehadiranPerMahasiswa.filter(item => {
        const matchesProdi = user?.role === 'superadmin'
            ? (prodiFilter === 'all' || String(item.prodiId) === String(prodiFilter))
            : String(item.prodiId) === String(user?.prodiId)
        const matchesSearch = (item.nama || '').toLowerCase().includes(search.toLowerCase()) ||
            (item.nim || '').includes(search)
        return matchesProdi && matchesSearch
    })

    // Overall stats
    const totalExams = filteredData.length
    const totalStudents = filteredData.reduce((sum, item) => sum + item.summary.total, 0)
    const totalHadir = filteredData.reduce((sum, item) => sum + item.summary.hadir, 0)
    const overallRate = totalStudents > 0 ? ((totalHadir / totalStudents) * 100).toFixed(1) : 0

    const handleExportExcel = () => {
        // Export data in XLSX format
        const exportData = filteredData.map(item => ({
            ujian: item.examName,
            ruang: item.room,
            tanggal: item.date,
            waktu: item.time,
            prodi: getProdiName(item.prodiId),
            pengawas: item.pengawas,
            total: item.summary.total,
            hadir: item.summary.hadir,
            sakit: item.summary.sakit,
            izin: item.summary.izin,
            alpha: item.summary.alpha,
            rate: `${getAttendanceRate(item.summary)}%`
        }))

        const headers = [
            { key: 'ujian', label: 'Ujian' },
            { key: 'ruang', label: 'Ruang' },
            { key: 'tanggal', label: 'Tanggal' },
            { key: 'waktu', label: 'Waktu' },
            { key: 'prodi', label: 'Prodi' },
            { key: 'pengawas', label: 'Pengawas' },
            { key: 'total', label: 'Total' },
            { key: 'hadir', label: 'Hadir' },
            { key: 'sakit', label: 'Sakit' },
            { key: 'izin', label: 'Izin' },
            { key: 'alpha', label: 'Alpha' },
            { key: 'rate', label: 'Rate' }
        ]

        exportToXLSX(exportData, headers, `rekap_kehadiran_${dateFilter || 'all'}_${new Date().toISOString().split('T')[0]}`, 'Rekap Kehadiran')
    }

    const handlePrint = () => {
        const printWindow = window.open('', '_blank')
        printWindow.document.write(`
            <html>
            <head>
                <title>Rekap Kehadiran</title>
                <style>
                    @page { size: A4 portrait; margin: 15mm; }
                    body { font-family: 'Times New Roman', serif; padding: 20px; font-size: 12pt; }
                    .letterhead {
                        display: flex;
                        align-items: center;
                        gap: 20px;
                        border-bottom: 3px double #000;
                        padding-bottom: 15px;
                        margin-bottom: 25px;
                    }
                    .letterhead-logo {
                        width: 70px;
                        height: 70px;
                        border: 2px solid #1e3a5f;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-direction: column;
                        background: white;
                    }
                    .letterhead-logo .logo-icon {
                        font-size: 24pt;
                        line-height: 1;
                    }
                    .letterhead-logo .logo-text {
                        font-size: 6pt;
                        color: #1e3a5f;
                        font-weight: bold;
                    }
                    .letterhead-text { flex: 1; text-align: center; }
                    .letterhead-text h2 { margin: 0; font-size: 14pt; text-transform: uppercase; }
                    .letterhead-text h1 { margin: 5px 0; font-size: 18pt; text-transform: uppercase; }
                    .letterhead-text p { margin: 3px 0; font-size: 10pt; }
                    .document-title { text-align: center; margin: 25px 0; }
                    .document-title h3 { text-decoration: underline; margin: 0; font-size: 14pt; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; font-size: 11pt; }
                    th { background: #f0f0f0; font-weight: bold; }
                    .text-center { text-align: center; }
                    .summary { margin-top: 20px; padding: 10px; background: #f9f9f9; border: 1px solid #ddd; }
                </style>
            </head>
            <body>
                <div class="letterhead">
                    ${settings?.logoUrl
                ? `<img src="${settings.logoUrl}" alt="Logo" style="width: 70px; height: 70px; object-fit: contain;"/>`
                : `<div class="letterhead-logo">
                            <span class="logo-icon">⚓</span>
                            <span class="logo-text">POLTEKTRANS</span>
                        </div>`
            }
                    <div class="letterhead-text">
                        <h1>${settings?.institution || 'Politeknik Transportasi SDP Palembang'}</h1>
                        <p>${settings?.address || 'Jl. Residen Abdul Rozak, Palembang, Sumatera Selatan'}</p>
                        <p>Telp: ${settings?.phone || '(0711) 123456'} | Email: ${settings?.email || 'info@poltektrans.ac.id'}</p>
                    </div>
                </div>
                <div class="document-title">
                    <h3>REKAP KEHADIRAN UJIAN</h3>
                    <p>Tahun Akademik 2025/2026</p>
                </div>
                <p>Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Nama Ujian</th>
                            <th>Ruang</th>
                            <th>Tanggal</th>
                            <th>Waktu</th>
                            <th>Pengawas</th>
                            <th class="text-center">Total</th>
                            <th class="text-center">Hadir</th>
                            <th class="text-center">Sakit</th>
                            <th class="text-center">Izin</th>
                            <th class="text-center">Alpha</th>
                            <th class="text-center">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredData.map(item => `
                            <tr>
                                <td>${item.examName}</td>
                                <td>${item.room}</td>
                                <td>${item.date}</td>
                                <td>${item.time}</td>
                                <td>${item.pengawas}</td>
                                <td class="text-center">${item.summary.total}</td>
                                <td class="text-center">${item.summary.hadir}</td>
                                <td class="text-center">${item.summary.sakit}</td>
                                <td class="text-center">${item.summary.izin}</td>
                                <td class="text-center">${item.summary.alpha}</td>
                                <td class="text-center">${getAttendanceRate(item.summary)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="summary">
                    <strong>Rekapitulasi:</strong> Total Ujian: ${totalExams} | Total Peserta: ${totalStudents} | Total Hadir: ${totalHadir} | Tingkat Kehadiran: ${overallRate}%
                </div>
            </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.print()
    }

    const handlePrintSingle = (item) => {
        const printWindow = window.open('', '_blank')
        printWindow.document.write(`
            <html>
            <head>
                <title>Kehadiran - ${item.examName}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { text-align: center; margin-bottom: 20px; }
                    .info { margin-bottom: 20px; }
                    .info p { margin: 5px 0; }
                    .summary { display: flex; gap: 20px; margin: 20px 0; }
                    .summary-item { padding: 10px 20px; border: 1px solid #ccc; border-radius: 4px; text-align: center; }
                    .summary-item .value { font-size: 24px; font-weight: bold; }
                    .summary-item .label { font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <h1>Daftar Hadir Ujian</h1>
                <div class="info">
                    <p><strong>Nama Ujian:</strong> ${item.examName}</p>
                    <p><strong>Ruang:</strong> ${item.room}</p>
                    <p><strong>Tanggal:</strong> ${item.date}</p>
                    <p><strong>Waktu:</strong> ${item.time}</p>
                    <p><strong>Pengawas:</strong> ${item.pengawas}</p>
                </div>
                <div class="summary">
                    <div class="summary-item"><div class="value">${item.summary.total}</div><div class="label">Total</div></div>
                    <div class="summary-item"><div class="value">${item.summary.hadir}</div><div class="label">Hadir</div></div>
                    <div class="summary-item"><div class="value">${item.summary.sakit}</div><div class="label">Sakit</div></div>
                    <div class="summary-item"><div class="value">${item.summary.izin}</div><div class="label">Izin</div></div>
                    <div class="summary-item"><div class="value">${item.summary.alpha}</div><div class="label">Alpha</div></div>
                    <div class="summary-item"><div class="value">${getAttendanceRate(item.summary)}%</div><div class="label">Rate</div></div>
                </div>
            </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.print()
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Rekap Kehadiran</h1>
                        <p className="page-subtitle">Data kehadiran ujian dari pengawas yang tersinkronisasi</p>
                    </div>
                    <div className="header-actions">
                        <button className="btn btn-secondary" onClick={handleExportExcel}>
                            <FileSpreadsheet size={18} />
                            Export Excel
                        </button>
                        <button className="btn btn-primary" onClick={handlePrint}>
                            <Printer size={18} />
                            Cetak Semua
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="stats-grid-sm">
                    <div className="stat-card-sm">
                        <Calendar size={20} />
                        <div>
                            <span className="stat-value">{totalExams}</span>
                            <span className="stat-label">Total Ujian</span>
                        </div>
                    </div>
                    <div className="stat-card-sm">
                        <Users size={20} />
                        <div>
                            <span className="stat-value">{totalStudents}</span>
                            <span className="stat-label">Total Peserta</span>
                        </div>
                    </div>
                    <div className="stat-card-sm">
                        <CheckCircle size={20} />
                        <div>
                            <span className="stat-value">{totalHadir}</span>
                            <span className="stat-label">Total Hadir</span>
                        </div>
                    </div>
                    <div className="stat-card-sm success">
                        <ClipboardCheck size={20} />
                        <div>
                            <span className="stat-value">{overallRate}%</span>
                            <span className="stat-label">Tingkat Kehadiran</span>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="card mb-4">
                    <div className="card-body">
                        <div className="filters-row">
                            <div className="search-box">
                                <Search size={18} className="search-icon" />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Cari ujian atau pengawas..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            {user?.role === 'superadmin' && (
                                <div className="filter-group">
                                    <Filter size={16} />
                                    <select
                                        className="form-input"
                                        value={prodiFilter}
                                        onChange={e => setProdiFilter(e.target.value)}
                                    >
                                        <option value="all">Semua Prodi</option>
                                        {prodiList.map(p => (
                                            <option key={p.id} value={p.id}>{p.kode}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="filter-group">
                                <Calendar size={16} />
                                <input
                                    type="date"
                                    className="form-input"
                                    value={dateFilter}
                                    onChange={e => setDateFilter(e.target.value)}
                                />
                                {dateFilter && (
                                    <button className="btn btn-ghost btn-sm" onClick={() => setDateFilter('')}>
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* View Mode Tabs */}
                <div className="view-tabs mb-4">
                    <button
                        className={`tab-btn ${viewMode === 'per-ujian' ? 'active' : ''}`}
                        onClick={() => setViewMode('per-ujian')}
                    >
                        <Calendar size={16} />
                        Setiap Ujian
                    </button>
                    <button
                        className={`tab-btn ${viewMode === 'per-mahasiswa' ? 'active' : ''}`}
                        onClick={() => setViewMode('per-mahasiswa')}
                    >
                        <User size={16} />
                        Setiap Mahasiswa
                    </button>
                </div>

                {/* Data Table */}
                {viewMode === 'per-ujian' ? (
                    <div className="card">
                        <div className="card-body">
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Ujian</th>
                                            <th>Ruang</th>
                                            <th>Tanggal</th>
                                            <th>Pengawas</th>
                                            <th className="text-center">Hadir</th>
                                            <th className="text-center">Sakit</th>
                                            <th className="text-center">Izin</th>
                                            <th className="text-center">Alpha</th>
                                            <th className="text-center">Rate</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredData.map(item => (
                                            <tr key={item.id}>
                                                <td>
                                                    <div className="exam-name-cell">
                                                        <span className="font-medium">{item.examName}</span>
                                                        <span className="time-text">{item.time}</span>
                                                    </div>
                                                </td>
                                                <td>{item.room}</td>
                                                <td>{item.date}</td>
                                                <td>{item.pengawas}</td>
                                                <td className="text-center">
                                                    <span className="count-badge success">{item.summary.hadir}</span>
                                                </td>
                                                <td className="text-center">
                                                    <span className="count-badge warning">{item.summary.sakit}</span>
                                                </td>
                                                <td className="text-center">
                                                    <span className="count-badge info">{item.summary.izin}</span>
                                                </td>
                                                <td className="text-center">
                                                    <span className="count-badge error">{item.summary.alpha}</span>
                                                </td>
                                                <td className="text-center">
                                                    <span className={`rate-badge ${parseFloat(getAttendanceRate(item.summary)) >= 90 ? 'success' : parseFloat(getAttendanceRate(item.summary)) >= 75 ? 'warning' : 'error'}`}>
                                                        {getAttendanceRate(item.summary)}%
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => handlePrintSingle(item)}
                                                    >
                                                        <Printer size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredData.length === 0 && (
                                            <tr>
                                                <td colSpan={10} className="text-center text-muted" style={{ padding: 'var(--space-8)' }}>
                                                    Tidak ada data kehadiran
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Per Mahasiswa View */
                    <div className="card">
                        <div className="card-body">
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>NIM</th>
                                            <th>Nama Mahasiswa</th>
                                            <th>Kelas</th>
                                            <th>Ruangan</th>
                                            <th>Prodi</th>
                                            <th className="text-center">Total</th>
                                            <th className="text-center">Hadir</th>
                                            <th className="text-center">Sakit</th>
                                            <th className="text-center">Izin</th>
                                            <th className="text-center">Alpha</th>
                                            <th className="text-center">Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredMahasiswa.map(student => (
                                            <tr key={student.id}>
                                                <td className="font-medium">{student.nim}</td>
                                                <td>{student.nama}</td>
                                                <td>{student.kelas}</td>
                                                <td><span className="badge badge-secondary">{student.ruangan}</span></td>
                                                <td>{getProdiName(student.prodiId)}</td>
                                                <td className="text-center">{student.total}</td>
                                                <td className="text-center">
                                                    <span className="count-badge success">{student.hadir}</span>
                                                </td>
                                                <td className="text-center">
                                                    <span className="count-badge warning">{student.sakit}</span>
                                                </td>
                                                <td className="text-center">
                                                    <span className="count-badge info">{student.izin}</span>
                                                </td>
                                                <td className="text-center">
                                                    <span className="count-badge error">{student.alpha}</span>
                                                </td>
                                                <td className="text-center">
                                                    <span className={`rate-badge ${parseFloat(getMahasiswaRate(student)) >= 90 ? 'success' : parseFloat(getMahasiswaRate(student)) >= 75 ? 'warning' : 'error'}`}>
                                                        {getMahasiswaRate(student)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredMahasiswa.length === 0 && (
                                            <tr>
                                                <td colSpan={11} className="text-center text-muted" style={{ padding: 'var(--space-8)' }}>
                                                    Tidak ada data kehadiran mahasiswa
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .mb-4 {
                    margin-bottom: var(--space-4);
                }
                .header-actions {
                    display: flex;
                    gap: var(--space-3);
                }
                .view-tabs {
                    display: flex;
                    gap: var(--space-2);
                    padding: var(--space-2);
                    background: var(--bg-secondary);
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--border-color);
                }
                .tab-btn {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    padding: var(--space-2) var(--space-4);
                    border: none;
                    background: transparent;
                    border-radius: var(--radius-md);
                    font-size: var(--font-size-sm);
                    font-weight: var(--font-medium);
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all var(--transition-fast);
                }
                .tab-btn:hover {
                    background: var(--bg-tertiary);
                    color: var(--text-primary);
                }
                .tab-btn.active {
                    background: var(--primary-500);
                    color: white;
                }
                .stats-grid-sm {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: var(--space-4);
                    margin-bottom: var(--space-6);
                }
                .stat-card-sm {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                    padding: var(--space-4);
                    background: var(--bg-secondary);
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--border-color);
                }
                .stat-card-sm svg {
                    color: var(--text-muted);
                }
                .stat-card-sm.success svg {
                    color: var(--success-500);
                }
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
                .exam-name-cell {
                    display: flex;
                    flex-direction: column;
                }
                .time-text {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
                .count-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 28px;
                    padding: var(--space-1) var(--space-2);
                    border-radius: var(--radius-full);
                    font-size: var(--font-size-xs);
                    font-weight: var(--font-semibold);
                }
                .count-badge.success {
                    background: var(--success-100);
                    color: var(--success-700);
                }
                .count-badge.warning {
                    background: var(--warning-100);
                    color: var(--warning-700);
                }
                .count-badge.info {
                    background: var(--info-100);
                    color: var(--info-700);
                }
                .count-badge.error {
                    background: var(--error-100);
                    color: var(--error-700);
                }
                .rate-badge {
                    display: inline-block;
                    padding: var(--space-1) var(--space-2);
                    border-radius: var(--radius-md);
                    font-size: var(--font-size-xs);
                    font-weight: var(--font-bold);
                }
                .rate-badge.success {
                    background: var(--success-100);
                    color: var(--success-700);
                }
                .rate-badge.warning {
                    background: var(--warning-100);
                    color: var(--warning-700);
                }
                .rate-badge.error {
                    background: var(--error-100);
                    color: var(--error-700);
                }
            `}</style>
        </DashboardLayout>
    )
}

export default RekapKehadiranPage

