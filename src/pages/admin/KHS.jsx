import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useSettings } from '../../contexts/SettingsContext'
import { exportToXLSX } from '../../utils/excelUtils'
import { userService, prodiService, kelasService, matkulService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    Award,
    Search,
    Download,
    Printer,
    User,
    GraduationCap,
    BookOpen,
    Calculator,
    FileSpreadsheet,
    RefreshCw,
    ChevronDown
} from 'lucide-react'
import '../admin/Dashboard.css'

// Grade conversion functions (same as NilaiAkhir.jsx)
const getNilaiHuruf = (nak) => {
    if (nak > 80) return 'A'
    if (nak > 75) return 'AB'
    if (nak > 69) return 'B'
    if (nak > 60) return 'BC'
    if (nak > 55) return 'C'
    if (nak > 44) return 'D'
    return 'E'
}

const getScoreAkhir = (nak) => {
    if (nak > 80) return 4.0
    if (nak > 75) return 3.5
    if (nak > 69) return 3.0
    if (nak > 60) return 2.5
    if (nak > 55) return 2.0
    if (nak > 44) return 1.0
    return 0
}

const getGradeColor = (nh) => {
    switch (nh) {
        case 'A':
        case 'AB':
            return 'var(--color-success)'
        case 'B':
        case 'BC':
            return 'var(--color-warning)'
        case 'C':
            return 'var(--color-info)'
        default:
            return 'var(--color-error)'
    }
}

function KHSPage() {
    const { user } = useAuth()
    const { settings } = useSettings()
    const [mahasiswaList, setMahasiswaList] = useState([])
    const [selectedMahasiswa, setSelectedMahasiswa] = useState(null)
    const [prodiList, setProdiList] = useState([])
    const [kelasList, setKelasList] = useState([])
    const [matkulList, setMatkulList] = useState([])
    const [prodiFilter, setProdiFilter] = useState(user?.prodi_id || 'all')
    const [kelasFilter, setKelasFilter] = useState('all')
    const [semesterFilter, setSemesterFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [nilaiAkhirData, setNilaiAkhirData] = useState({})
    const printRef = useRef()

    // Load data
    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            try {
                // Load from Supabase
                if (isSupabaseConfigured()) {
                    const [prodi, kelas, matkul, mahasiswa] = await Promise.all([
                        prodiService.getAll(),
                        kelasService.getAll(),
                        matkulService.getAll(),
                        userService.getAll({ role: 'mahasiswa' })
                    ])
                    setProdiList(prodi || [])
                    setKelasList(kelas || [])
                    setMatkulList(matkul || [])

                    // Filter mahasiswa by prodi for admin_prodi
                    const filtered = user?.role === 'admin_prodi'
                        ? mahasiswa.filter(m => String(m.prodi_id) === String(user.prodi_id))
                        : mahasiswa
                    setMahasiswaList(filtered || [])
                }

                // Load nilai akhir from localStorage (saved by Dosen)
                const savedNilai = localStorage.getItem('cat_nilai_akhir')
                if (savedNilai) {
                    setNilaiAkhirData(JSON.parse(savedNilai))
                }
            } catch (error) {
                console.error('[KHS] Error loading data:', error)
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [user])

    // Filter mahasiswa
    const filteredMahasiswa = mahasiswaList.filter(m => {
        const matchesProdi = prodiFilter === 'all' || String(m.prodi_id) === String(prodiFilter)
        const matchesKelas = kelasFilter === 'all' || String(m.kelas_id) === String(kelasFilter)
        const matchesSearch = (m.nama || '').toLowerCase().includes(search.toLowerCase()) ||
            (m.nim_nip || '').includes(search)
        return matchesProdi && matchesKelas && matchesSearch
    })

    // Get student's grades for KHS
    const getStudentGrades = (mahasiswa) => {
        if (!mahasiswa) return []

        const grades = []
        const studentProdiId = mahasiswa.prodi_id

        // Get matkul for student's prodi
        const prodiMatkul = matkulList.filter(m =>
            String(m.prodi_id) === String(studentProdiId)
        )

        prodiMatkul.forEach(matkul => {
            // Check if there's a saved grade for this student and matkul
            const gradeKey = `${mahasiswa.id}_${matkul.id}`
            const savedGrade = nilaiAkhirData[gradeKey]

            if (savedGrade) {
                const sks = (matkul.sks_teori || 0) + (matkul.sks_praktek || 0)
                const nak = savedGrade.nak || 0
                const nh = getNilaiHuruf(nak)
                const bobot = getScoreAkhir(nak)

                grades.push({
                    matkulId: matkul.id,
                    matkulNama: matkul.nama,
                    matkulKode: matkul.kode,
                    sks: sks,
                    nilaiAngka: Math.round(nak * 100) / 100,
                    nilaiHuruf: nh,
                    bobot: bobot,
                    bobotSks: bobot * sks,
                    keterangan: bobot >= 2.0 ? '' : 'MENGULANG'
                })
            }
        })

        return grades
    }

    // Calculate IPS
    const calculateIPS = (grades) => {
        if (!grades || grades.length === 0) return { totalSks: 0, totalBobot: 0, ips: 0 }

        const totalSks = grades.reduce((sum, g) => sum + g.sks, 0)
        const totalBobot = grades.reduce((sum, g) => sum + g.bobotSks, 0)
        const ips = totalSks > 0 ? (totalBobot / totalSks) : 0

        return {
            totalSks,
            totalBobot: Math.round(totalBobot * 100) / 100,
            ips: Math.round(ips * 100) / 100
        }
    }

    // Get prodi name
    const getProdiName = (prodiId) => {
        const prodi = prodiList.find(p => String(p.id) === String(prodiId))
        return prodi ? `${prodi.kode} - ${prodi.nama}` : '-'
    }

    // Get kelas name
    const getKelasName = (kelasId) => {
        const kelas = kelasList.find(k => String(k.id) === String(kelasId))
        return kelas?.nama || '-'
    }

    // Handle print
    const handlePrint = () => {
        window.print()
    }

    // Handle export
    const handleExport = () => {
        if (!selectedMahasiswa) return

        const grades = getStudentGrades(selectedMahasiswa)
        const stats = calculateIPS(grades)

        const exportData = grades.map((g, idx) => ({
            'No': idx + 1,
            'Kode MK': g.matkulKode,
            'Mata Kuliah': g.matkulNama,
            'SKS': g.sks,
            'Nilai Angka': g.nilaiAngka,
            'Nilai Huruf': g.nilaiHuruf,
            'Bobot': g.bobot,
            'Bobot x SKS': g.bobotSks,
            'Keterangan': g.keterangan
        }))

        // Add summary row
        exportData.push({
            'No': '',
            'Kode MK': '',
            'Mata Kuliah': 'JUMLAH',
            'SKS': stats.totalSks,
            'Nilai Angka': '',
            'Nilai Huruf': '',
            'Bobot': '',
            'Bobot x SKS': stats.totalBobot,
            'Keterangan': ''
        })

        exportData.push({
            'No': '',
            'Kode MK': '',
            'Mata Kuliah': 'IPS (Indeks Prestasi Semester)',
            'SKS': '',
            'Nilai Angka': stats.ips.toFixed(2),
            'Nilai Huruf': '',
            'Bobot': '',
            'Bobot x SKS': '',
            'Keterangan': ''
        })

        const headers = ['No', 'Kode MK', 'Mata Kuliah', 'SKS', 'Nilai Angka', 'Nilai Huruf', 'Bobot', 'Bobot x SKS', 'Keterangan']
        exportToXLSX(exportData, headers, `KHS_${selectedMahasiswa.nim_nip}_${selectedMahasiswa.nama}`, 'KHS')
    }

    const studentGrades = selectedMahasiswa ? getStudentGrades(selectedMahasiswa) : []
    const ipsStats = calculateIPS(studentGrades)

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Kartu Hasil Studi (KHS)</h1>
                        <p className="page-subtitle">Lihat nilai akhir semester per mahasiswa</p>
                    </div>
                    <div className="header-actions">
                        {selectedMahasiswa && (
                            <>
                                <button className="btn btn-primary" onClick={handleExport}>
                                    <FileSpreadsheet size={18} />
                                    Export Excel
                                </button>
                                <button className="btn btn-secondary" onClick={handlePrint}>
                                    <Printer size={18} />
                                    Cetak
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="card mb-4">
                    <div className="card-body">
                        <div className="filters-row">
                            <div className="filter-group">
                                <label>Program Studi</label>
                                <select
                                    className="form-select"
                                    value={prodiFilter}
                                    onChange={e => setProdiFilter(e.target.value)}
                                    disabled={user?.role === 'admin_prodi'}
                                >
                                    <option value="all">Semua Prodi</option>
                                    {prodiList.map(p => (
                                        <option key={p.id} value={p.id}>{p.kode} - {p.nama}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="filter-group">
                                <label>Kelas</label>
                                <select
                                    className="form-select"
                                    value={kelasFilter}
                                    onChange={e => setKelasFilter(e.target.value)}
                                >
                                    <option value="all">Semua Kelas</option>
                                    {kelasList
                                        .filter(k => prodiFilter === 'all' || String(k.prodi_id) === String(prodiFilter))
                                        .map(k => (
                                            <option key={k.id} value={k.id}>{k.nama}</option>
                                        ))}
                                </select>
                            </div>
                            <div className="filter-group flex-grow">
                                <label>Cari Mahasiswa</label>
                                <div className="search-input">
                                    <Search size={18} className="search-icon" />
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Cari nama atau NIM..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="row">
                    {/* Student List */}
                    <div className="col-md-4">
                        <div className="card" style={{ maxHeight: '600px', overflow: 'auto' }}>
                            <div className="card-header">
                                <h3 className="card-title">
                                    <User size={18} />
                                    Daftar Mahasiswa ({filteredMahasiswa.length})
                                </h3>
                            </div>
                            <div className="card-body p-0">
                                {loading ? (
                                    <div className="loading-container p-4">
                                        <RefreshCw className="animate-spin" size={24} />
                                        <span>Memuat data...</span>
                                    </div>
                                ) : filteredMahasiswa.length === 0 ? (
                                    <div className="empty-state p-4">
                                        <GraduationCap size={48} className="empty-icon" />
                                        <h4>Tidak ada mahasiswa</h4>
                                        <p>Belum ada data mahasiswa</p>
                                    </div>
                                ) : (
                                    <div className="student-list">
                                        {filteredMahasiswa.map(m => (
                                            <div
                                                key={m.id}
                                                className={`student-item ${selectedMahasiswa?.id === m.id ? 'active' : ''}`}
                                                onClick={() => setSelectedMahasiswa(m)}
                                                style={{
                                                    padding: '12px 16px',
                                                    borderBottom: '1px solid var(--color-border)',
                                                    cursor: 'pointer',
                                                    backgroundColor: selectedMahasiswa?.id === m.id ? 'var(--color-primary-light)' : 'transparent'
                                                }}
                                            >
                                                <div style={{ fontWeight: 600 }}>{m.nama}</div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                                    {m.nim_nip} • {getKelasName(m.kelas_id)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* KHS Detail */}
                    <div className="col-md-8">
                        <div className="card" ref={printRef}>
                            {!selectedMahasiswa ? (
                                <div className="card-body">
                                    <div className="empty-state">
                                        <Award size={48} className="empty-icon" />
                                        <h4>Pilih Mahasiswa</h4>
                                        <p>Pilih mahasiswa dari daftar untuk melihat KHS</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* KHS Header */}
                                    <div className="card-header">
                                        <h3 className="card-title" style={{ textAlign: 'center', width: '100%' }}>
                                            <strong>KARTU HASIL STUDI (KHS)</strong>
                                        </h3>
                                    </div>
                                    <div className="card-body">
                                        {/* Student Info */}
                                        <div className="khs-info" style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '8px',
                                            marginBottom: '20px',
                                            padding: '16px',
                                            backgroundColor: 'var(--color-bg-muted)',
                                            borderRadius: '8px'
                                        }}>
                                            <div><strong>Nama:</strong> {selectedMahasiswa.nama}</div>
                                            <div><strong>NIM:</strong> {selectedMahasiswa.nim_nip}</div>
                                            <div><strong>Program Studi:</strong> {getProdiName(selectedMahasiswa.prodi_id)}</div>
                                            <div><strong>Kelas:</strong> {getKelasName(selectedMahasiswa.kelas_id)}</div>
                                            <div><strong>Semester:</strong> {selectedMahasiswa.semester || '-'}</div>
                                            <div><strong>Tahun Akademik:</strong> {settings?.tahunAkademik || '2024/2025'}</div>
                                        </div>

                                        {/* Grades Table */}
                                        {studentGrades.length === 0 ? (
                                            <div className="empty-state">
                                                <BookOpen size={48} className="empty-icon" />
                                                <h4>Belum ada nilai</h4>
                                                <p>Nilai akhir belum diinput oleh dosen</p>
                                            </div>
                                        ) : (
                                            <>
                                                <table className="data-table" style={{ width: '100%' }}>
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '40px' }}>No</th>
                                                            <th>Mata Kuliah</th>
                                                            <th style={{ width: '60px', textAlign: 'center' }}>SKS</th>
                                                            <th style={{ width: '80px', textAlign: 'center' }}>Nilai Angka</th>
                                                            <th style={{ width: '80px', textAlign: 'center' }}>Nilai Huruf</th>
                                                            <th style={{ width: '80px', textAlign: 'center' }}>Bobot x SKS</th>
                                                            <th>Keterangan</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {studentGrades.map((g, idx) => (
                                                            <tr key={g.matkulId}>
                                                                <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                                                <td>
                                                                    <div style={{ fontWeight: 500 }}>{g.matkulNama}</div>
                                                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                                                        {g.matkulKode}
                                                                    </div>
                                                                </td>
                                                                <td style={{ textAlign: 'center' }}>{g.sks}</td>
                                                                <td style={{ textAlign: 'center', fontWeight: 600 }}>{g.nilaiAngka}</td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    <span style={{
                                                                        color: getGradeColor(g.nilaiHuruf),
                                                                        fontWeight: 700
                                                                    }}>
                                                                        {g.nilaiHuruf}
                                                                    </span>
                                                                </td>
                                                                <td style={{ textAlign: 'center' }}>{g.bobotSks.toFixed(1)}</td>
                                                                <td>
                                                                    {g.keterangan && (
                                                                        <span className="badge badge-error">{g.keterangan}</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr style={{ fontWeight: 700, backgroundColor: 'var(--color-bg-muted)' }}>
                                                            <td colSpan="2" style={{ textAlign: 'right' }}>JUMLAH</td>
                                                            <td style={{ textAlign: 'center' }}>{ipsStats.totalSks}</td>
                                                            <td colSpan="2"></td>
                                                            <td style={{ textAlign: 'center' }}>{ipsStats.totalBobot.toFixed(2)}</td>
                                                            <td></td>
                                                        </tr>
                                                    </tfoot>
                                                </table>

                                                {/* IPS Summary */}
                                                <div style={{
                                                    marginTop: '20px',
                                                    padding: '16px',
                                                    backgroundColor: 'var(--color-primary-light)',
                                                    borderRadius: '8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <Calculator size={24} />
                                                        <div>
                                                            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                                                                INDEKS PRESTASI SEMESTER (IPS)
                                                            </div>
                                                            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                                                                Total Bobot ({ipsStats.totalBobot.toFixed(2)}) / Total SKS ({ipsStats.totalSks})
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        fontSize: '2rem',
                                                        fontWeight: 700,
                                                        color: ipsStats.ips >= 3.0 ? 'var(--color-success)' :
                                                            ipsStats.ips >= 2.5 ? 'var(--color-warning)' : 'var(--color-error)'
                                                    }}>
                                                        {ipsStats.ips.toFixed(2)}
                                                    </div>
                                                </div>

                                                {/* Grade Legend */}
                                                <div style={{
                                                    marginTop: '16px',
                                                    padding: '12px',
                                                    backgroundColor: 'var(--color-bg-muted)',
                                                    borderRadius: '8px',
                                                    fontSize: '0.85rem'
                                                }}>
                                                    <strong>Keterangan Nilai:</strong>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '8px' }}>
                                                        <span><span style={{ color: 'var(--color-success)', fontWeight: 700 }}>A</span> (&gt;80) = 4.0</span>
                                                        <span><span style={{ color: 'var(--color-success)', fontWeight: 700 }}>AB</span> (75-80) = 3.5</span>
                                                        <span><span style={{ color: 'var(--color-warning)', fontWeight: 700 }}>B</span> (69-75) = 3.0</span>
                                                        <span><span style={{ color: 'var(--color-warning)', fontWeight: 700 }}>BC</span> (60-69) = 2.5</span>
                                                        <span><span style={{ color: 'var(--color-info)', fontWeight: 700 }}>C</span> (55-60) = 2.0</span>
                                                        <span><span style={{ color: 'var(--color-error)', fontWeight: 700 }}>D</span> (44-55) = 1.0</span>
                                                        <span><span style={{ color: 'var(--color-error)', fontWeight: 700 }}>E</span> (&lt;44) = 0</span>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    .sidebar, .main-header, .header-actions, .filters-row, .col-md-4 {
                        display: none !important;
                    }
                    .col-md-8 {
                        width: 100% !important;
                        max-width: 100% !important;
                    }
                    .card {
                        box-shadow: none !important;
                        border: 1px solid #ccc !important;
                    }
                }
            `}</style>
        </DashboardLayout>
    )
}

export default KHSPage
