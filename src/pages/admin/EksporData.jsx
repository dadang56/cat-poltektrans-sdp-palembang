import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useSettings } from '../../contexts/SettingsContext'
import {
    jadwalService, hasilUjianService, kehadiranService,
    matkulService, kelasService, prodiService, userService,
    isSupabaseConfigured
} from '../../services/supabaseService'
import { exportToXLSX } from '../../utils/excelUtils'
import {
    Download,
    FileSpreadsheet,
    Calendar,
    Filter,
    Award,
    Users,
    ClipboardCheck,
    FileText,
    ChevronDown,
    ChevronUp,
    RefreshCw
} from 'lucide-react'
import './Dashboard.css'

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


function EksporDataPage() {
    const { user } = useAuth()
    const { settings, saveSettings } = useSettings()
    const [tahunAkademik, setTahunAkademik] = useState('')
    const [tipeUjian, setTipeUjian] = useState('all')
    const [isLoading, setIsLoading] = useState(false)
    const [expandedSection, setExpandedSection] = useState(null)

    // Data states
    const [jadwalData, setJadwalData] = useState([])
    const [hasilData, setHasilData] = useState([])
    const [kehadiranData, setKehadiranData] = useState([])
    const [matkulList, setMatkulList] = useState([])
    const [kelasList, setKelasList] = useState([])
    const [usersList, setUsersList] = useState([])
    const [prodiList, setProdiList] = useState([])

    // Summary stats
    const [stats, setStats] = useState({
        totalJadwal: 0,
        totalUTS: 0,
        totalUAS: 0,
        totalNilai: 0,
        totalKehadiran: 0
    })

    // Load tahun akademik from settings
    useEffect(() => {
        if (settings?.tahunAkademik) {
            setTahunAkademik(settings.tahunAkademik)
        } else if (TAHUN_AJARAN_OPTIONS.length > 0) {
            setTahunAkademik(TAHUN_AJARAN_OPTIONS[0])
        }
    }, [settings])

    // Load data when tahun akademik changes
    useEffect(() => {
        if (tahunAkademik) {
            loadData()
        }
    }, [tahunAkademik, tipeUjian])

    const loadData = async () => {
        setIsLoading(true)
        try {
            let jadwal = []
            let hasil = []
            let kehadiran = []
            let matkul = []
            let kelas = []
            let users = []
            let prodi = []

            if (isSupabaseConfigured()) {
                // Load jadwal - first try with tahun_akademik filter
                const filters = { tahun_akademik: tahunAkademik }
                if (tipeUjian !== 'all') filters.tipe = tipeUjian

                const [jadwalRes, matkulRes, kelasRes, prodiRes, usersRes] = await Promise.all([
                    jadwalService.getAll(filters),
                    matkulService.getAll(),
                    kelasService.getAll(),
                    prodiService.getAll(),
                    userService.getAll()
                ])

                // If no jadwal found with tahun_akademik filter, load ALL jadwal
                // (existing jadwal may not have tahun_akademik set)
                let jadwalResult = jadwalRes || []
                if (jadwalResult.length === 0) {
                    console.log('[EksporData] No jadwal with tahun_akademik filter, loading all...')
                    const fallbackFilters = {}
                    if (tipeUjian !== 'all') fallbackFilters.tipe = tipeUjian
                    const allJadwal = await jadwalService.getAll(fallbackFilters)
                    jadwalResult = allJadwal || []
                }

                jadwal = jadwalResult
                matkul = matkulRes || []
                kelas = kelasRes || []
                prodi = prodiRes || []
                users = usersRes || []

                // Filter by prodi for admin_prodi
                if (user?.role !== 'superadmin' && user?.prodi_id) {
                    jadwal = jadwal.filter(j => {
                        const jProdiId = j.matkul?.prodi_id || j.prodi_id
                        return !jProdiId || jProdiId === user.prodi_id
                    })
                }

                // Get all jadwal IDs for loading hasil and kehadiran
                const jadwalIds = jadwal.map(j => j.id)

                // Load hasil_ujian for these jadwal
                const hasilPromises = jadwalIds.map(jId => hasilUjianService.getByJadwal(jId))
                const hasilResults = await Promise.all(hasilPromises)
                const allHasil = hasilResults.flat().filter(Boolean)

                // Load kehadiran for these jadwal
                const kehadiranPromises = jadwalIds.map(jId => kehadiranService.getByJadwal(jId))
                const kehadiranResults = await Promise.all(kehadiranPromises)
                kehadiran = kehadiranResults.flat().filter(Boolean)

                // Transform jadwal to expected format
                jadwal = jadwal.map(j => ({
                    ...j,
                    matkulId: j.matkul_id,
                    kelasId: j.kelas_id,
                    waktuMulai: j.waktu_mulai,
                    waktuSelesai: j.waktu_selesai,
                    tipeUjian: j.tipe,
                    tahunAkademik: j.tahun_akademik
                }))

                // Transform hasil to expected format
                hasil = allHasil.map(h => ({
                    ...h,
                    examId: h.jadwal_id,
                    mahasiswaId: h.mahasiswa_id,
                    mahasiswaName: h.mahasiswa?.nama,
                    nim: h.mahasiswa?.nim_nip,
                    totalScore: h.nilai_total || 0,
                    maxScore: 100
                }))

                // Transform kehadiran
                kehadiran = kehadiran.map(k => ({
                    ...k,
                    jadwalId: k.jadwal_id,
                    mahasiswaId: k.mahasiswa_id,
                    mahasiswaName: k.mahasiswa?.nama,
                    nim: k.mahasiswa?.nim_nip || '-',
                    waktuHadir: k.waktu_hadir
                }))

                console.log('[EksporData] Loaded from Supabase:', {
                    jadwal: jadwal.length,
                    hasil: hasil.length,
                    kehadiran: kehadiran.length,
                    tahunAkademik
                })
            }

            setMatkulList(matkul)
            setKelasList(kelas)
            setUsersList(users)
            setProdiList(prodi)
            setJadwalData(jadwal)
            setHasilData(hasil)
            setKehadiranData(kehadiran)

            // Update stats
            setStats({
                totalJadwal: jadwal.length,
                totalUTS: jadwal.filter(j => (j.tipe || j.tipeUjian) === 'UTS').length,
                totalUAS: jadwal.filter(j => (j.tipe || j.tipeUjian) === 'UAS').length,
                totalNilai: hasil.length,
                totalKehadiran: kehadiran.length
            })

        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    // Helper functions
    const getMatkulName = (id) => matkulList.find(m => String(m.id) === String(id))?.nama || 'N/A'
    const getMatkulKode = (id) => matkulList.find(m => String(m.id) === String(id))?.kode || ''
    const getKelasName = (id) => kelasList.find(k => String(k.id) === String(id))?.nama || 'N/A'
    const getUserName = (id) => {
        const u = usersList.find(u => String(u.id) === String(id))
        return u?.nama || u?.name || 'N/A'
    }
    const getProdiName = (id) => prodiList.find(p => String(p.id) === String(id))?.nama || 'N/A'

    // Export functions
    const handleExportJadwal = () => {
        const data = jadwalData.map((j, idx) => ({
            no: idx + 1,
            tanggal: j.tanggal,
            waktuMulai: j.waktu_mulai || j.waktuMulai,
            waktuSelesai: j.waktu_selesai || j.waktuSelesai,
            matkul: getMatkulName(j.matkul_id || j.matkulId),
            kodeMatkul: getMatkulKode(j.matkul_id || j.matkulId),
            kelas: getKelasName(j.kelas_id || j.kelasId),
            tipe: j.tipe || j.tipeUjian,
            ruangan: j.ruangan || j.ruang || '-',
            status: j.status || 'scheduled'
        }))

        const headers = [
            { key: 'no', label: 'No' },
            { key: 'tanggal', label: 'Tanggal' },
            { key: 'waktuMulai', label: 'Waktu Mulai' },
            { key: 'waktuSelesai', label: 'Waktu Selesai' },
            { key: 'kodeMatkul', label: 'Kode MK' },
            { key: 'matkul', label: 'Mata Kuliah' },
            { key: 'kelas', label: 'Kelas' },
            { key: 'tipe', label: 'Tipe' },
            { key: 'ruangan', label: 'Ruangan' },
            { key: 'status', label: 'Status' }
        ]

        const filename = `jadwal_ujian_${tahunAkademik.replace(/\//g, '-').replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}`
        exportToXLSX(data, headers, filename, 'Jadwal Ujian')
    }

    const handleExportNilai = () => {
        const data = hasilData.map((h, idx) => {
            const jadwal = jadwalData.find(j => String(j.id) === String(h.examId || h.jadwal_id))
            const percentScore = h.maxScore > 0 ? Math.round((h.totalScore / h.maxScore) * 100) : (h.nilai_total || 0)

            return {
                no: idx + 1,
                nim: h.nim || h.mahasiswa_nim || '-',
                nama: h.mahasiswaName || getUserName(h.mahasiswa_id || h.mahasiswaId) || 'N/A',
                matkul: jadwal ? getMatkulName(jadwal.matkul_id || jadwal.matkulId) : 'N/A',
                kelas: jadwal ? getKelasName(jadwal.kelas_id || jadwal.kelasId) : 'N/A',
                tipe: jadwal ? (jadwal.tipe || jadwal.tipeUjian) : 'N/A',
                tanggal: jadwal?.tanggal || '-',
                nilai: percentScore,
                status: percentScore >= 70 ? 'Lulus' : 'Mengulang',
                jumlahBenar: h.jumlah_benar || h.correctCount || 0,
                jumlahSalah: h.jumlah_salah || h.wrongCount || 0
            }
        })

        const headers = [
            { key: 'no', label: 'No' },
            { key: 'nim', label: 'NIM' },
            { key: 'nama', label: 'Nama Mahasiswa' },
            { key: 'matkul', label: 'Mata Kuliah' },
            { key: 'kelas', label: 'Kelas' },
            { key: 'tipe', label: 'Tipe Ujian' },
            { key: 'tanggal', label: 'Tanggal' },
            { key: 'nilai', label: 'Nilai' },
            { key: 'status', label: 'Status' },
            { key: 'jumlahBenar', label: 'Jumlah Benar' },
            { key: 'jumlahSalah', label: 'Jumlah Salah' }
        ]

        const filename = `rekap_nilai_${tahunAkademik.replace(/\//g, '-').replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}`
        exportToXLSX(data, headers, filename, 'Rekap Nilai')
    }

    const handleExportKehadiran = () => {
        const data = kehadiranData.map((k, idx) => {
            const jadwal = jadwalData.find(j => String(j.id) === String(k.jadwalId || k.jadwal_id))

            return {
                no: idx + 1,
                tanggal: jadwal?.tanggal || '-',
                matkul: jadwal ? getMatkulName(jadwal.matkul_id || jadwal.matkulId) : 'N/A',
                kelas: jadwal ? getKelasName(jadwal.kelas_id || jadwal.kelasId) : 'N/A',
                tipe: jadwal ? (jadwal.tipe || jadwal.tipeUjian) : 'N/A',
                nim: k.nim || k.mahasiswa_nim || '-',
                nama: k.mahasiswaName || getUserName(k.mahasiswa_id || k.mahasiswaId) || 'N/A',
                status: k.status || 'belum',
                waktuHadir: k.waktu_hadir || k.waktuHadir || '-',
                keterangan: k.keterangan || '-'
            }
        })

        const headers = [
            { key: 'no', label: 'No' },
            { key: 'tanggal', label: 'Tanggal' },
            { key: 'matkul', label: 'Mata Kuliah' },
            { key: 'kelas', label: 'Kelas' },
            { key: 'tipe', label: 'Tipe Ujian' },
            { key: 'nim', label: 'NIM' },
            { key: 'nama', label: 'Nama Mahasiswa' },
            { key: 'status', label: 'Status Kehadiran' },
            { key: 'waktuHadir', label: 'Waktu Hadir' },
            { key: 'keterangan', label: 'Keterangan' }
        ]

        const filename = `rekap_kehadiran_${tahunAkademik.replace(/\//g, '-').replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}`
        exportToXLSX(data, headers, filename, 'Rekap Kehadiran')
    }

    const toggleSection = (section) => {
        setExpandedSection(expandedSection === section ? null : section)
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Ekspor Data</h1>
                        <p className="page-subtitle">Unduh rekap data berdasarkan tahun akademik</p>
                    </div>
                    <button className="btn btn-outline" onClick={loadData} disabled={isLoading}>
                        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {/* Filters */}
                <div className="card mb-4">
                    <div className="card-body">
                        <div className="filters-row">
                            <div className="filter-group">
                                <Calendar size={16} />
                                <select
                                    className="form-input"
                                    value={tahunAkademik}
                                    onChange={e => {
                                        setTahunAkademik(e.target.value)
                                        saveSettings({ ...settings, tahunAkademik: e.target.value })
                                    }}
                                >
                                    {TAHUN_AJARAN_OPTIONS.map(ta => (
                                        <option key={ta} value={ta}>{ta}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="filter-group">
                                <Filter size={16} />
                                <select
                                    className="form-input"
                                    value={tipeUjian}
                                    onChange={e => setTipeUjian(e.target.value)}
                                >
                                    <option value="all">Semua Tipe Ujian</option>
                                    <option value="UTS">UTS</option>
                                    <option value="UAS">UAS</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Summary */}
                <div className="stats-grid mb-4">
                    <div className="stat-card stat-primary">
                        <div className="stat-icon"><Calendar size={24} /></div>
                        <div className="stat-content">
                            <span className="stat-value">{stats.totalJadwal}</span>
                            <span className="stat-label">Total Jadwal</span>
                        </div>
                    </div>
                    <div className="stat-card stat-accent">
                        <div className="stat-icon"><FileText size={24} /></div>
                        <div className="stat-content">
                            <span className="stat-value">{stats.totalUTS} / {stats.totalUAS}</span>
                            <span className="stat-label">UTS / UAS</span>
                        </div>
                    </div>
                    <div className="stat-card stat-success">
                        <div className="stat-icon"><Award size={24} /></div>
                        <div className="stat-content">
                            <span className="stat-value">{stats.totalNilai}</span>
                            <span className="stat-label">Data Nilai</span>
                        </div>
                    </div>
                    <div className="stat-card stat-warning">
                        <div className="stat-icon"><ClipboardCheck size={24} /></div>
                        <div className="stat-content">
                            <span className="stat-value">{stats.totalKehadiran}</span>
                            <span className="stat-label">Data Kehadiran</span>
                        </div>
                    </div>
                </div>

                {/* Export Sections */}
                <div className="export-sections">
                    {/* Jadwal Ujian Export */}
                    <div className="card export-card">
                        <div
                            className="export-header"
                            onClick={() => toggleSection('jadwal')}
                        >
                            <div className="export-info">
                                <Calendar size={24} className="text-primary" />
                                <div>
                                    <h3>Jadwal Ujian</h3>
                                    <p>{stats.totalJadwal} jadwal tersedia</p>
                                </div>
                            </div>
                            <div className="export-actions">
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={(e) => { e.stopPropagation(); handleExportJadwal(); }}
                                    disabled={stats.totalJadwal === 0}
                                >
                                    <FileSpreadsheet size={16} />
                                    Export Excel
                                </button>
                                {expandedSection === 'jadwal' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </div>
                        </div>
                        {expandedSection === 'jadwal' && (
                            <div className="export-preview">
                                <p className="text-sm text-muted mb-2">Preview data yang akan diekspor:</p>
                                <div className="table-responsive">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Tanggal</th>
                                                <th>Mata Kuliah</th>
                                                <th>Kelas</th>
                                                <th>Tipe</th>
                                                <th>Waktu</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {jadwalData.slice(0, 5).map(j => (
                                                <tr key={j.id}>
                                                    <td>{j.tanggal}</td>
                                                    <td>{getMatkulName(j.matkul_id || j.matkulId)}</td>
                                                    <td>{getKelasName(j.kelas_id || j.kelasId)}</td>
                                                    <td><span className={`badge badge-${(j.tipe || j.tipeUjian) === 'UTS' ? 'primary' : 'error'}`}>{j.tipe || j.tipeUjian}</span></td>
                                                    <td>{j.waktu_mulai || j.waktuMulai} - {j.waktu_selesai || j.waktuSelesai}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {jadwalData.length > 5 && (
                                    <p className="text-sm text-muted mt-2">...dan {jadwalData.length - 5} data lainnya</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Rekap Nilai Export */}
                    <div className="card export-card">
                        <div
                            className="export-header"
                            onClick={() => toggleSection('nilai')}
                        >
                            <div className="export-info">
                                <Award size={24} className="text-success" />
                                <div>
                                    <h3>Rekap Nilai</h3>
                                    <p>{stats.totalNilai} data nilai tersedia</p>
                                </div>
                            </div>
                            <div className="export-actions">
                                <button
                                    className="btn btn-success btn-sm"
                                    onClick={(e) => { e.stopPropagation(); handleExportNilai(); }}
                                    disabled={stats.totalNilai === 0}
                                >
                                    <FileSpreadsheet size={16} />
                                    Export Excel
                                </button>
                                {expandedSection === 'nilai' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </div>
                        </div>
                        {expandedSection === 'nilai' && (
                            <div className="export-preview">
                                <p className="text-sm text-muted mb-2">Preview data yang akan diekspor:</p>
                                <div className="table-responsive">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>NIM</th>
                                                <th>Nama</th>
                                                <th>Mata Kuliah</th>
                                                <th>Nilai</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {hasilData.slice(0, 5).map((h, idx) => {
                                                const jadwal = jadwalData.find(j => String(j.id) === String(h.examId || h.jadwal_id))
                                                const percentScore = h.maxScore > 0 ? Math.round((h.totalScore / h.maxScore) * 100) : (h.nilai_total || 0)
                                                return (
                                                    <tr key={idx}>
                                                        <td>{h.nim || h.mahasiswa_nim || '-'}</td>
                                                        <td>{h.mahasiswaName || 'N/A'}</td>
                                                        <td>{jadwal ? getMatkulName(jadwal.matkul_id || jadwal.matkulId) : 'N/A'}</td>
                                                        <td><span className={`badge ${percentScore >= 70 ? 'badge-success' : 'badge-error'}`}>{percentScore}</span></td>
                                                        <td>{percentScore >= 70 ? 'Lulus' : 'Mengulang'}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {hasilData.length > 5 && (
                                    <p className="text-sm text-muted mt-2">...dan {hasilData.length - 5} data lainnya</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Rekap Kehadiran Export */}
                    <div className="card export-card">
                        <div
                            className="export-header"
                            onClick={() => toggleSection('kehadiran')}
                        >
                            <div className="export-info">
                                <ClipboardCheck size={24} className="text-warning" />
                                <div>
                                    <h3>Rekap Kehadiran</h3>
                                    <p>{stats.totalKehadiran} data kehadiran tersedia</p>
                                </div>
                            </div>
                            <div className="export-actions">
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={(e) => { e.stopPropagation(); handleExportKehadiran(); }}
                                    disabled={stats.totalKehadiran === 0}
                                >
                                    <FileSpreadsheet size={16} />
                                    Export Excel
                                </button>
                                {expandedSection === 'kehadiran' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </div>
                        </div>
                        {expandedSection === 'kehadiran' && (
                            <div className="export-preview">
                                <p className="text-sm text-muted mb-2">Preview data yang akan diekspor:</p>
                                {kehadiranData.length > 0 ? (
                                    <div className="table-responsive">
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Tanggal</th>
                                                    <th>NIM</th>
                                                    <th>Nama</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {kehadiranData.slice(0, 5).map((k, idx) => {
                                                    const jadwal = jadwalData.find(j => String(j.id) === String(k.jadwalId || k.jadwal_id))
                                                    return (
                                                        <tr key={idx}>
                                                            <td>{jadwal?.tanggal || '-'}</td>
                                                            <td>{k.nim || k.mahasiswa_nim || '-'}</td>
                                                            <td>{k.mahasiswaName || 'N/A'}</td>
                                                            <td><span className={`badge badge-${k.status === 'hadir' ? 'success' : 'warning'}`}>{k.status}</span></td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-muted">Tidak ada data kehadiran untuk periode ini</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Empty state */}
                {stats.totalJadwal === 0 && !isLoading && (
                    <div className="card">
                        <div className="card-body">
                            <div className="empty-state">
                                <Download size={48} />
                                <h3>Tidak ada data</h3>
                                <p>Belum ada data ujian untuk tahun akademik {tahunAkademik}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .mb-4 {
                    margin-bottom: var(--space-4);
                }
                .filters-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: var(--space-4);
                    align-items: center;
                }
                .filter-group {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                }
                .filter-group select {
                    min-width: 200px;
                }
                .export-sections {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4);
                }
                .export-card {
                    overflow: hidden;
                }
                .export-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--space-4);
                    cursor: pointer;
                    transition: background var(--transition-fast);
                }
                .export-header:hover {
                    background: var(--bg-tertiary);
                }
                .export-info {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                }
                .export-info h3 {
                    margin: 0;
                    font-size: var(--font-size-base);
                    font-weight: var(--font-semibold);
                }
                .export-info p {
                    margin: 0;
                    font-size: var(--font-size-sm);
                    color: var(--text-muted);
                }
                .export-actions {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                }
                .export-preview {
                    padding: var(--space-4);
                    border-top: 1px solid var(--border-color);
                    background: var(--bg-tertiary);
                }
                .table-responsive {
                    overflow-x: auto;
                }
                .empty-state {
                    text-align: center;
                    padding: var(--space-8);
                    color: var(--text-muted);
                }
                .empty-state svg {
                    margin-bottom: var(--space-4);
                }
                .empty-state h3 {
                    margin-bottom: var(--space-2);
                    color: var(--text-secondary);
                }
                .btn-success {
                    background: linear-gradient(135deg, var(--success-500) 0%, var(--success-600) 100%);
                    color: white;
                }
                .btn-success:hover:not(:disabled) {
                    background: linear-gradient(135deg, var(--success-600) 0%, var(--success-600) 100%);
                }
                .text-primary { color: var(--primary-500); }
                .text-success { color: var(--success-500); }
                .text-warning { color: var(--warning-500); }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @media (max-width: 768px) {
                    .filters-row {
                        flex-direction: column;
                        align-items: stretch;
                    }
                    .filter-group {
                        width: 100%;
                    }
                    .filter-group select {
                        width: 100%;
                        min-width: auto;
                    }
                    .export-header {
                        flex-direction: column;
                        gap: var(--space-3);
                        align-items: flex-start;
                    }
                    .export-actions {
                        width: 100%;
                        justify-content: space-between;
                    }
                    .export-actions .btn {
                        flex: 1;
                    }
                }
            `}</style>
        </DashboardLayout>
    )
}

export default EksporDataPage
