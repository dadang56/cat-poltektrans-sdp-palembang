import { useState, useRef, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useSettings } from '../../contexts/SettingsContext'
import {
    FileText,
    Download,
    Printer,
    Filter,
    Search,
    ChevronDown,
    GraduationCap,
    Calendar,
    User,
    BookOpen
} from 'lucide-react'

// LocalStorage keys
const EXAM_RESULTS_KEY = 'cat_exam_results'
const USERS_KEY = 'cat_users'
const PRODI_KEY = 'cat_prodi_data'
const KELAS_KEY = 'cat_kelas_data'
const MATKUL_KEY = 'cat_matkul_data'

function getGradeLabel(nilai) {
    if (nilai >= 85) return { label: 'A', color: 'success' }
    if (nilai >= 75) return { label: 'B', color: 'primary' }
    if (nilai >= 65) return { label: 'C', color: 'warning' }
    if (nilai >= 55) return { label: 'D', color: 'accent' }
    return { label: 'E', color: 'danger' }
}

function ReportsPage() {
    const { settings } = useSettings()
    const [searchQuery, setSearchQuery] = useState('')
    const [filterDosen, setFilterDosen] = useState('Semua Dosen')
    const [filterMatkul, setFilterMatkul] = useState('Semua Mata Kuliah')
    const [filterProdi, setFilterProdi] = useState('Semua Prodi')
    const [filterKelas, setFilterKelas] = useState('Semua Kelas')
    const [showFilters, setShowFilters] = useState(false)
    const printRef = useRef(null)

    // Data from localStorage
    const [grades, setGrades] = useState([])
    const [dosenList, setDosenList] = useState(['Semua Dosen'])
    const [matkulList, setMatkulList] = useState(['Semua Mata Kuliah'])
    const [prodiList, setProdiList] = useState(['Semua Prodi'])
    const [kelasList, setKelasList] = useState(['Semua Kelas'])

    // Load data from localStorage
    useEffect(() => {
        const examResults = localStorage.getItem(EXAM_RESULTS_KEY)
        const users = localStorage.getItem(USERS_KEY)
        const prodi = localStorage.getItem(PRODI_KEY)
        const kelas = localStorage.getItem(KELAS_KEY)
        const matkul = localStorage.getItem(MATKUL_KEY)

        const usersData = users ? JSON.parse(users) : []
        const prodiData = prodi ? JSON.parse(prodi) : []
        const kelasData = kelas ? JSON.parse(kelas) : []
        const matkulData = matkul ? JSON.parse(matkul) : []

        // Build prodi list for filter
        setProdiList(['Semua Prodi', ...prodiData.map(p => p.nama)])

        // Build kelas list for filter  
        setKelasList(['Semua Kelas', ...kelasData.map(k => k.nama)])

        // Build matkul list for filter
        setMatkulList(['Semua Mata Kuliah', ...matkulData.map(m => m.nama)])

        // Build dosen list
        const dosenUsers = usersData.filter(u => u.role === 'dosen')
        setDosenList(['Semua Dosen', ...dosenUsers.map(d => d.nama || d.name)])

        // Load exam results and enrich with user data
        if (examResults) {
            const results = JSON.parse(examResults)
            const enrichedResults = results.map(r => {
                const mahasiswa = usersData.find(u => u.id === r.mahasiswaId)
                const dosenUser = usersData.find(u => u.id === r.dosenId)
                const matkulItem = matkulData.find(m => m.id === r.matkulId)
                const kelasItem = kelasData.find(k => k.id === mahasiswa?.kelasId)
                const prodiItem = prodiData.find(p => p.id === kelasItem?.prodiId)

                return {
                    id: r.id,
                    nim: mahasiswa?.nim || '-',
                    nama: mahasiswa?.nama || mahasiswa?.name || '-',
                    prodi: prodiItem?.nama || '-',
                    kelas: kelasItem?.nama || '-',
                    matkul: matkulItem?.nama || '-',
                    dosen: dosenUser?.nama || dosenUser?.name || '-',
                    nilai: r.score || 0,
                    tanggal: r.tanggal || r.submittedAt?.split('T')[0] || '-'
                }
            })
            setGrades(enrichedResults)
        }
    }, [])

    // Filter data
    const filteredGrades = grades.filter(grade => {
        const matchSearch = grade.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
            grade.nim.includes(searchQuery)
        const matchDosen = filterDosen === 'Semua Dosen' || grade.dosen === filterDosen
        const matchMatkul = filterMatkul === 'Semua Mata Kuliah' || grade.matkul === filterMatkul
        const matchProdi = filterProdi === 'Semua Prodi' || grade.prodi === filterProdi
        const matchKelas = filterKelas === 'Semua Kelas' || grade.kelas === filterKelas
        return matchSearch && matchDosen && matchMatkul && matchProdi && matchKelas
    })

    // Calculate summary
    const summary = {
        totalRecords: filteredGrades.length,
        avgNilai: filteredGrades.length > 0
            ? Math.round(filteredGrades.reduce((sum, g) => sum + g.nilai, 0) / filteredGrades.length)
            : 0,
        gradeA: filteredGrades.filter(g => g.nilai >= 85).length,
        gradeB: filteredGrades.filter(g => g.nilai >= 75 && g.nilai < 85).length,
        gradeC: filteredGrades.filter(g => g.nilai >= 65 && g.nilai < 75).length,
        gradeD: filteredGrades.filter(g => g.nilai < 65).length
    }

    const handlePrint = () => {
        const printContent = printRef.current
        const originalContents = document.body.innerHTML
        document.body.innerHTML = printContent.innerHTML
        window.print()
        document.body.innerHTML = originalContents
        window.location.reload()
    }

    const handleExportPDF = () => {
        handlePrint()
    }

    const currentDate = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    })

    return (
        <DashboardLayout>
            <div className="reports-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Laporan Nilai</h1>
                        <p className="page-subtitle">Rekap nilai akumulatif dari ujian yang telah dinilai</p>
                    </div>
                    <div className="page-actions">
                        <button className="btn btn-outline" onClick={() => setShowFilters(!showFilters)}>
                            <Filter size={18} />
                            Filter
                            <ChevronDown size={16} className={showFilters ? 'rotate' : ''} />
                        </button>
                        <button className="btn btn-secondary" onClick={handleExportPDF}>
                            <Download size={18} />
                            Export PDF
                        </button>
                        <button className="btn btn-primary" onClick={handlePrint}>
                            <Printer size={18} />
                            Cetak
                        </button>
                    </div>
                </div>

                {/* Filters */}
                {showFilters && (
                    <div className="filters-panel card animate-fadeIn">
                        <div className="card-body">
                            <div className="filters-grid">
                                <div className="filter-group">
                                    <label className="form-label">Dosen</label>
                                    <select
                                        className="form-input"
                                        value={filterDosen}
                                        onChange={(e) => setFilterDosen(e.target.value)}
                                    >
                                        {dosenList.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label className="form-label">Mata Kuliah</label>
                                    <select
                                        className="form-input"
                                        value={filterMatkul}
                                        onChange={(e) => setFilterMatkul(e.target.value)}
                                    >
                                        {matkulList.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label className="form-label">Program Studi</label>
                                    <select
                                        className="form-input"
                                        value={filterProdi}
                                        onChange={(e) => setFilterProdi(e.target.value)}
                                    >
                                        {prodiList.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div className="filter-group">
                                    <label className="form-label">Kelas</label>
                                    <select
                                        className="form-input"
                                        value={filterKelas}
                                        onChange={(e) => setFilterKelas(e.target.value)}
                                    >
                                        {kelasList.map(k => <option key={k} value={k}>{k}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Summary Cards */}
                <div className="summary-cards">
                    <div className="summary-card">
                        <span className="summary-value">{summary.totalRecords}</span>
                        <span className="summary-label">Total Data</span>
                    </div>
                    <div className="summary-card">
                        <span className="summary-value">{summary.avgNilai}</span>
                        <span className="summary-label">Rata-rata Nilai</span>
                    </div>
                    <div className="summary-card success">
                        <span className="summary-value">{summary.gradeA}</span>
                        <span className="summary-label">Grade A</span>
                    </div>
                    <div className="summary-card primary">
                        <span className="summary-value">{summary.gradeB}</span>
                        <span className="summary-label">Grade B</span>
                    </div>
                </div>

                {/* Search */}
                <div className="search-box">
                    <Search size={20} className="search-icon" />
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Cari nama atau NIM mahasiswa..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Table */}
                <div className="card">
                    <div className="card-body">
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>No</th>
                                        <th>NIM</th>
                                        <th>Nama Mahasiswa</th>
                                        <th>Prodi</th>
                                        <th>Kelas</th>
                                        <th>Mata Kuliah</th>
                                        <th>Dosen Pengampu</th>
                                        <th>Nilai</th>
                                        <th>Grade</th>
                                        <th>Tanggal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredGrades.map((grade, idx) => {
                                        const gradeInfo = getGradeLabel(grade.nilai)
                                        return (
                                            <tr key={grade.id}>
                                                <td>{idx + 1}</td>
                                                <td className="font-medium">{grade.nim}</td>
                                                <td>{grade.nama}</td>
                                                <td className="text-muted">{grade.prodi}</td>
                                                <td><span className="badge badge-outline">{grade.kelas}</span></td>
                                                <td>{grade.matkul}</td>
                                                <td className="text-muted">{grade.dosen}</td>
                                                <td className="font-semibold">{grade.nilai}</td>
                                                <td>
                                                    <span className={`badge badge-${gradeInfo.color}`}>
                                                        {gradeInfo.label}
                                                    </span>
                                                </td>
                                                <td className="text-muted">{grade.tanggal}</td>
                                            </tr>
                                        )
                                    })}
                                    {filteredGrades.length === 0 && (
                                        <tr>
                                            <td colSpan="10" className="text-center text-muted py-4">
                                                Tidak ada data yang ditemukan
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Template (Hidden) */}
            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    <style>{`
                        @page { size: A4; margin: 1.5cm; }
                        body { font-family: 'Times New Roman', serif; font-size: 12pt; }
                        .print-header { text-align: center; border-bottom: 3px double #000; padding-bottom: 15px; margin-bottom: 20px; }
                        .print-logo { max-height: 80px; margin-bottom: 10px; }
                        .print-institution { font-size: 16pt; font-weight: bold; text-transform: uppercase; margin: 0; }
                        .print-address { font-size: 10pt; margin: 5px 0; }
                        .print-title { text-align: center; font-size: 14pt; font-weight: bold; margin: 20px 0; text-decoration: underline; }
                        .print-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 10pt; }
                        .print-table th, .print-table td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
                        .print-table th { background: #f0f0f0; font-weight: bold; }
                        .print-table td.center { text-align: center; }
                        .print-footer { margin-top: 40px; }
                        .print-signature { float: right; width: 200px; text-align: center; }
                        .print-signature-space { height: 80px; }
                        .print-signature-name { font-weight: bold; text-decoration: underline; }
                        .print-signature-title { font-size: 10pt; }
                        .print-date { margin-bottom: 10px; }
                    `}</style>

                    <div className="print-header">
                        {settings.logoUrl && (
                            <img src={settings.logoUrl} alt="Logo" className="print-logo" />
                        )}
                        <p className="print-institution">{settings.institution}</p>
                        <p className="print-address">{settings.address}</p>
                        <p className="print-address">Telp: {settings.phone} | Email: {settings.email}</p>
                    </div>

                    <h2 className="print-title">LAPORAN NILAI UJIAN</h2>

                    <p>
                        <strong>Program Studi:</strong> {filterProdi}<br />
                        <strong>Kelas:</strong> {filterKelas}<br />
                        <strong>Mata Kuliah:</strong> {filterMatkul}<br />
                        <strong>Dosen:</strong> {filterDosen}
                    </p>

                    <table className="print-table">
                        <thead>
                            <tr>
                                <th style={{ width: '30px' }}>No</th>
                                <th>NIM</th>
                                <th>Nama Mahasiswa</th>
                                <th>Mata Kuliah</th>
                                <th style={{ width: '50px' }}>Nilai</th>
                                <th style={{ width: '50px' }}>Grade</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredGrades.map((grade, idx) => (
                                <tr key={grade.id}>
                                    <td className="center">{idx + 1}</td>
                                    <td>{grade.nim}</td>
                                    <td>{grade.nama}</td>
                                    <td>{grade.matkul}</td>
                                    <td className="center">{grade.nilai}</td>
                                    <td className="center">{getGradeLabel(grade.nilai).label}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="print-footer">
                        <div className="print-signature">
                            <p className="print-date">Palembang, {currentDate}</p>
                            <p>Mengetahui,</p>
                            <div className="print-signature-space"></div>
                            <p className="print-signature-name">________________________</p>
                            <p className="print-signature-title">Kepala Program Studi</p>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .reports-page {
                    padding: 0;
                }
                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    flex-wrap: wrap;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                .page-actions {
                    display: flex;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                }
                .rotate {
                    transform: rotate(180deg);
                    transition: transform 0.2s ease;
                }
                .filters-panel {
                    margin-bottom: 1.5rem;
                }
                .filters-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                }
                .summary-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                .summary-card {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: 0.75rem;
                    padding: 1.25rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.25rem;
                }
                .summary-card.success {
                    background: rgba(16, 185, 129, 0.1);
                    border-color: rgba(16, 185, 129, 0.3);
                }
                .summary-card.primary {
                    background: var(--color-primary-alpha);
                    border-color: var(--color-primary);
                }
                .summary-value {
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: var(--color-text);
                }
                .summary-label {
                    font-size: 0.875rem;
                    color: var(--color-text-muted);
                }
                .search-box {
                    position: relative;
                    margin-bottom: 1.5rem;
                }
                .search-box .search-icon {
                    position: absolute;
                    left: 1rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--color-text-muted);
                }
                .search-box .form-input {
                    padding-left: 3rem;
                }
                .badge-outline {
                    background: transparent;
                    border: 1px solid var(--color-border);
                    color: var(--color-text-muted);
                }
                @media (max-width: 768px) {
                    .page-header {
                        flex-direction: column;
                    }
                    .page-actions {
                        width: 100%;
                    }
                    .page-actions button {
                        flex: 1;
                    }
                }
            `}</style>
        </DashboardLayout>
    )
}

export default ReportsPage
