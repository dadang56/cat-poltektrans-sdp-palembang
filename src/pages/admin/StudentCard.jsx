import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useSettings } from '../../contexts/SettingsContext'
import { useAuth } from '../../App'
import { userService, prodiService, kelasService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    CreditCard,
    Search,
    Printer,
    Download,
    Check,
    User,
    Filter,
    CheckSquare,
    Square
} from 'lucide-react'

// LocalStorage keys
const PRODI_STORAGE_KEY = 'cat_prodi_data'
const KELAS_STORAGE_KEY = 'cat_kelas_data'
const USERS_STORAGE_KEY = 'cat_users_data'

function StudentCardPage() {
    const { settings } = useSettings()
    const { user: currentUser } = useAuth()
    const [searchQuery, setSearchQuery] = useState('')
    const [filterProdi, setFilterProdi] = useState('all')
    const [filterKelas, setFilterKelas] = useState('all')
    const [selectedStudents, setSelectedStudents] = useState([])
    const printRef = useRef(null)

    // Load from Supabase or localStorage
    const [prodiList, setProdiList] = useState([])
    const [kelasList, setKelasList] = useState([])
    const [mahasiswaData, setMahasiswaData] = useState([])

    useEffect(() => {
        const loadData = async () => {
            try {
                let prodiData = []
                let kelasData = []
                let usersData = []

                if (isSupabaseConfigured()) {
                    // Load from Supabase
                    const [prodi, kelas, users] = await Promise.all([
                        prodiService.getAll(),
                        kelasService.getAll(),
                        userService.getAll({ role: 'mahasiswa' })
                    ])
                    prodiData = prodi
                    kelasData = kelas
                    usersData = users
                    console.log('[StudentCard] Loaded from Supabase:', { prodi: prodi.length, kelas: kelas.length, users: users.length })
                } else {
                    // Fallback to localStorage
                    const prodi = localStorage.getItem(PRODI_STORAGE_KEY)
                    const kelas = localStorage.getItem(KELAS_STORAGE_KEY)
                    const users = localStorage.getItem(USERS_STORAGE_KEY)
                    prodiData = prodi ? JSON.parse(prodi) : []
                    kelasData = kelas ? JSON.parse(kelas) : []
                    usersData = users ? JSON.parse(users).filter(u => u.role === 'mahasiswa') : []
                }

                setProdiList(prodiData)
                setKelasList(kelasData)

                // Map users to mahasiswa format (handle both Supabase snake_case and localStorage camelCase)
                const mhs = usersData.map(u => {
                    const prodiId = u.prodi_id || u.prodiId
                    const kelasId = u.kelas_id || u.kelasId
                    const userKelas = kelasData.find(k => k.id === kelasId)
                    const derivedProdiId = prodiId || userKelas?.prodi_id || userKelas?.prodiId || null

                    return {
                        id: u.id,
                        name: u.nama || u.name,
                        nim: u.nim_nip || u.nim || '',
                        prodiId: derivedProdiId,
                        kelasId: kelasId,
                        photo: u.photo,
                        username: u.username || u.nim_nip || u.nim || '',
                        password: u.password || '******'
                    }
                })

                console.log('[StudentCard] Total mahasiswa:', mhs.length)
                setMahasiswaData(mhs)
            } catch (err) {
                console.error('[StudentCard] Error loading data:', err)
            }
        }

        loadData()
    }, [])

    // For admin_prodi, auto-filter by their prodi
    const effectiveProdiFilter = currentUser?.role === 'admin_prodi' ? String(currentUser.prodiId) : filterProdi

    console.log('StudentCard Filter Debug:', {
        userRole: currentUser?.role,
        userProdiId: currentUser?.prodiId,
        effectiveProdiFilter,
        filterProdi,
        filterKelas,
        mahasiswaCount: mahasiswaData.length,
        kelasCount: kelasList.length
    })

    // Get filtered kelas based on prodi
    const filteredKelasList = effectiveProdiFilter === 'all'
        ? kelasList
        : kelasList.filter(k => String(k.prodiId) === String(effectiveProdiFilter))

    // Filter mahasiswa - simplified logic with better debug
    const filteredMahasiswa = mahasiswaData.filter(mhs => {
        const matchSearch = searchQuery === '' ||
            mhs.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            mhs.nim?.includes(searchQuery)

        // Get prodiId from kelas if mahasiswa prodiId not set
        const mahasiswaKelas = kelasList.find(k => k.id === mhs.kelasId)
        const mahasiswaProdiId = mhs.prodiId || mahasiswaKelas?.prodiId

        // For prodi matching - skip filter if admin selects a prodi from dropdown
        let matchProdi = true
        if (effectiveProdiFilter !== 'all') {
            matchProdi = String(mahasiswaProdiId) === String(effectiveProdiFilter)
        }

        // For kelas matching - check ID as string
        let matchKelas = true
        if (filterKelas !== 'all') {
            matchKelas = String(mhs.kelasId) === String(filterKelas)
        }

        console.log('Filter Check:', mhs.name, {
            mahasiswaProdiId,
            effectiveProdiFilter,
            matchProdi,
            kelasId: mhs.kelasId,
            filterKelas,
            matchKelas
        })

        return matchSearch && matchProdi && matchKelas
    })

    const handleSelectAll = () => {
        if (selectedStudents.length === filteredMahasiswa.length) {
            setSelectedStudents([])
        } else {
            setSelectedStudents(filteredMahasiswa.map(m => m.id))
        }
    }

    const handleSelectStudent = (id) => {
        if (selectedStudents.includes(id)) {
            setSelectedStudents(selectedStudents.filter(s => s !== id))
        } else {
            setSelectedStudents([...selectedStudents, id])
        }
    }

    const getProdiInfo = (prodiId) => {
        const prodi = prodiList.find(p => p.id === prodiId)
        return prodi ? `${prodi.kode} - ${prodi.nama}` : '-'
    }

    const getKelasInfo = (kelasId) => {
        const kelas = kelasList.find(k => k.id === kelasId)
        if (kelas) {
            const prodi = prodiList.find(p => p.id === kelas.prodiId)
            return `${prodi?.kode || ''} - Kelas ${kelas.nama}`
        }
        return '-'
    }

    const handlePrint = () => {
        const printContent = printRef.current
        const originalContents = document.body.innerHTML
        document.body.innerHTML = printContent.innerHTML
        window.print()
        document.body.innerHTML = originalContents
        window.location.reload()
    }

    const selectedMahasiswa = mahasiswaData.filter(m => selectedStudents.includes(m.id))

    return (
        <DashboardLayout>
            <div className="student-card-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Cetak Kartu Mahasiswa</h1>
                        <p className="page-subtitle">Cetak kartu identitas mahasiswa dengan kredensial login</p>
                    </div>
                    <div className="page-actions">
                        <button
                            className="btn btn-primary"
                            disabled={selectedStudents.length === 0}
                            onClick={handlePrint}
                        >
                            <Printer size={18} />
                            Cetak {selectedStudents.length > 0 ? `(${selectedStudents.length})` : ''}
                        </button>
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
                                    placeholder="Cari nama atau NIM..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="filter-group">
                                <Filter size={16} />
                                <select
                                    className="form-input"
                                    value={filterProdi}
                                    onChange={(e) => {
                                        setFilterProdi(e.target.value)
                                        setFilterKelas('all')
                                    }}
                                >
                                    <option value="all">Semua Prodi</option>
                                    {prodiList.map(p => (
                                        <option key={p.id} value={p.id}>{p.kode} - {p.nama}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="filter-group">
                                <select
                                    className="form-input"
                                    value={filterKelas}
                                    onChange={(e) => setFilterKelas(e.target.value)}
                                >
                                    <option value="all">Semua Kelas</option>
                                    {filteredKelasList.map(k => {
                                        const prodi = prodiList.find(p => p.id === k.prodiId)
                                        return (
                                            <option key={k.id} value={k.id}>
                                                {prodi?.kode} - {k.nama} ({k.angkatan})
                                            </option>
                                        )
                                    })}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Selection Info */}
                <div className="selection-info">
                    <button className="btn btn-ghost btn-sm" onClick={handleSelectAll}>
                        {selectedStudents.length === filteredMahasiswa.length ? (
                            <><CheckSquare size={16} /> Batal Pilih Semua</>
                        ) : (
                            <><Square size={16} /> Pilih Semua ({filteredMahasiswa.length})</>
                        )}
                    </button>
                    {selectedStudents.length > 0 && (
                        <span className="selected-count">
                            {selectedStudents.length} mahasiswa dipilih
                        </span>
                    )}
                </div>

                {/* Student Grid */}
                <div className="student-grid">
                    {filteredMahasiswa.map(mhs => {
                        const isSelected = selectedStudents.includes(mhs.id)
                        return (
                            <div
                                key={mhs.id}
                                className={`student-card-item ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleSelectStudent(mhs.id)}
                            >
                                <div className="student-checkbox">
                                    {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                                </div>
                                <div className="student-photo">
                                    {mhs.photo ? (
                                        <img src={mhs.photo} alt={mhs.name} />
                                    ) : (
                                        <div className="photo-placeholder">
                                            <User size={32} />
                                        </div>
                                    )}
                                </div>
                                <div className="student-info">
                                    <h4 className="student-name">{mhs.name}</h4>
                                    <p className="student-nim">{mhs.nim}</p>
                                    <p className="student-prodi">{getKelasInfo(mhs.kelasId)}</p>
                                </div>
                            </div>
                        )
                    })}
                    {filteredMahasiswa.length === 0 && (
                        <div className="empty-state">
                            <User size={48} />
                            <p>Tidak ada mahasiswa yang ditemukan</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Print Template (Hidden) */}
            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    <style>{`
                        @page { 
                            size: A4; 
                            margin: 15mm; 
                        }
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        body { 
                            font-family: Arial, sans-serif; 
                            font-size: 11pt; 
                            background: white;
                        }
                        .cards-container { 
                            display: grid;
                            grid-template-columns: repeat(2, 1fr);
                            gap: 8mm;
                            padding: 0;
                            width: 100%;
                        }
                        .id-card { 
                            width: 100%;
                            min-height: 60mm;
                            border: 2px solid #0891b2;
                            border-radius: 10px;
                            padding: 5mm;
                            box-sizing: border-box;
                            background: linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%);
                            page-break-inside: avoid;
                            break-inside: avoid;
                        }
                        .card-header {
                            display: flex;
                            align-items: center;
                            gap: 4mm;
                            border-bottom: 2px solid #0891b2;
                            padding-bottom: 3mm;
                            margin-bottom: 3mm;
                        }
                        .card-logo {
                            width: 15mm;
                            height: 15mm;
                            object-fit: contain;
                        }
                        .card-logo-placeholder {
                            width: 15mm;
                            height: 15mm;
                            background: linear-gradient(135deg, #0891b2, #0e7490);
                            border-radius: 6px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-weight: bold;
                            font-size: 9pt;
                        }
                        .card-institution {
                            flex: 1;
                        }
                        .card-institution h3 {
                            font-size: 9pt;
                            margin: 0 0 1mm 0;
                            color: #0891b2;
                            font-weight: bold;
                            text-transform: uppercase;
                        }
                        .card-institution p {
                            font-size: 7pt;
                            margin: 0;
                            color: #666;
                        }
                        .card-title {
                            text-align: center;
                            font-size: 9pt;
                            font-weight: bold;
                            color: white;
                            background: linear-gradient(135deg, #0891b2, #0e7490);
                            padding: 2mm;
                            border-radius: 4px;
                            margin-bottom: 3mm;
                            letter-spacing: 1px;
                        }
                        .card-body {
                            display: flex;
                            gap: 4mm;
                        }
                        .card-photo {
                            width: 22mm;
                            height: 28mm;
                            border: 2px solid #0891b2;
                            border-radius: 4px;
                            overflow: hidden;
                            background: #f0f0f0;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            flex-shrink: 0;
                        }
                        .card-photo img {
                            width: 100%;
                            height: 100%;
                            object-fit: cover;
                        }
                        .card-photo-placeholder {
                            color: #999;
                            font-size: 24pt;
                        }
                        .card-details {
                            flex: 1;
                            font-size: 8pt;
                        }
                        .card-details table {
                            width: 100%;
                            border-collapse: collapse;
                        }
                        .card-details td {
                            padding: 1mm 0;
                            vertical-align: top;
                        }
                        .card-details td:first-child {
                            width: 16mm;
                            color: #666;
                            font-weight: 500;
                        }
                        .card-details td:last-child {
                            font-weight: 600;
                            color: #333;
                        }
                        .credentials-box {
                            margin-top: 3mm;
                            padding: 2mm 3mm;
                            background: linear-gradient(135deg, #fef3c7, #fef9c3);
                            border: 1.5px solid #f59e0b;
                            border-radius: 4px;
                            font-size: 7.5pt;
                        }
                        .credentials-box strong {
                            color: #b45309;
                        }
                        .credentials-box span {
                            color: #1f2937;
                            font-weight: 600;
                        }
                    `}</style>

                    <div className="cards-container">
                        {selectedMahasiswa.map(mhs => {
                            const prodi = prodiList.find(p => p.id === mhs.prodiId)
                            const kelas = kelasList.find(k => k.id === mhs.kelasId)
                            return (
                                <div key={mhs.id} className="id-card">
                                    <div className="card-header">
                                        {settings?.logoUrl ? (
                                            <img src={settings.logoUrl} alt="Logo" className="card-logo" />
                                        ) : (
                                            <div className="card-logo-placeholder">CAT</div>
                                        )}
                                        <div className="card-institution">
                                            <h3>{settings?.institution || 'Politeknik Transportasi SDP Palembang'}</h3>
                                            <p>{settings?.address || 'Jl. Residen Abdul Rozak, Palembang'}</p>
                                        </div>
                                    </div>
                                    <div className="card-title">KARTU PESERTA UJIAN</div>
                                    <div className="card-body">
                                        <div className="card-photo">
                                            {mhs.photo ? (
                                                <img src={mhs.photo} alt={mhs.name} />
                                            ) : (
                                                <span className="card-photo-placeholder">👤</span>
                                            )}
                                        </div>
                                        <div className="card-details">
                                            <table>
                                                <tbody>
                                                    <tr>
                                                        <td>Nama</td>
                                                        <td>: {mhs.name}</td>
                                                    </tr>
                                                    <tr>
                                                        <td>NIM</td>
                                                        <td>: {mhs.nim}</td>
                                                    </tr>
                                                    <tr>
                                                        <td>Prodi</td>
                                                        <td>: {prodi?.kode || '-'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td>Kelas</td>
                                                        <td>: {kelas?.nama || '-'} ({kelas?.angkatan || '-'})</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                            <div className="credentials-box">
                                                <strong>Username:</strong> {mhs.username}<br />
                                                <strong>Password:</strong> {mhs.password}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            <style>{`
                .student-card-page {
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
                }
                .filters-row {
                    display: flex;
                    gap: 1rem;
                    flex-wrap: wrap;
                }
                .search-box {
                    position: relative;
                    flex: 1;
                    min-width: 200px;
                }
                .search-box .search-icon {
                    position: absolute;
                    left: 1rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-muted);
                }
                .search-box .form-input {
                    padding-left: 2.75rem;
                }
                .filter-group {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-muted);
                }
                .filter-group .form-input {
                    min-width: 180px;
                }
                .mb-4 {
                    margin-bottom: 1.5rem;
                }
                .selection-info {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }
                .selected-count {
                    font-size: 0.875rem;
                    color: var(--primary-600);
                    font-weight: 500;
                }
                .student-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1rem;
                }
                .student-card-item {
                    background: var(--bg-secondary);
                    border: 2px solid var(--border-color);
                    border-radius: 0.75rem;
                    padding: 1rem;
                    display: flex;
                    gap: 1rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                }
                .student-card-item:hover {
                    border-color: var(--primary-500);
                    background: var(--bg-tertiary);
                }
                .student-card-item.selected {
                    border-color: var(--primary-500);
                    background: var(--bg-tertiary);
                }
                .student-checkbox {
                    position: absolute;
                    top: 0.75rem;
                    right: 0.75rem;
                    color: var(--text-muted);
                }
                .student-card-item.selected .student-checkbox {
                    color: var(--primary-500);
                }
                .student-photo {
                    width: 70px;
                    height: 90px;
                    border-radius: 0.5rem;
                    overflow: hidden;
                    flex-shrink: 0;
                }
                .student-photo img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .photo-placeholder {
                    width: 100%;
                    height: 100%;
                    background: var(--bg-tertiary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-muted);
                }
                .student-info {
                    flex: 1;
                    min-width: 0;
                }
                .student-name {
                    font-weight: 600;
                    margin: 0 0 0.25rem 0;
                    color: var(--text-primary);
                }
                .student-nim {
                    font-size: 0.875rem;
                    color: var(--primary-500);
                    font-weight: 500;
                    margin: 0 0 0.5rem 0;
                }
                .student-prodi {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    margin: 0;
                }
                .empty-state {
                    grid-column: 1 / -1;
                    text-align: center;
                    padding: 3rem;
                    color: var(--text-muted);
                }
                .empty-state p {
                    margin-top: 1rem;
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
                
                /* Dark Mode - Student Cards */
                [data-theme="dark"] .student-card-item {
                    background: #1e293b !important;
                    border-color: #334155 !important;
                }
                [data-theme="dark"] .student-card-item:hover {
                    background: #334155 !important;
                    border-color: #3b679f !important;
                }
                [data-theme="dark"] .student-card-item.selected {
                    background: #334155 !important;
                    border-color: #3b679f !important;
                }
                [data-theme="dark"] .student-name {
                    color: #f8fafc !important;
                }
                [data-theme="dark"] .student-nim {
                    color: #7795bd !important;
                }
                [data-theme="dark"] .student-prodi {
                    color: #94a3b8 !important;
                }
                [data-theme="dark"] .photo-placeholder {
                    background: #334155 !important;
                    color: #94a3b8 !important;
                }
            `}</style>
        </DashboardLayout>
    )
}

export default StudentCardPage
