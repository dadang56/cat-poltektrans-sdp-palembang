import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useConfirm } from '../../components/ConfirmDialog'
import { jadwalService, matkulService, prodiService, kelasService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    Calendar,
    Plus,
    Edit2,
    Trash2,
    X,
    Save,
    Clock,
    MapPin,
    Users,
    Filter,
    Printer,
    RefreshCw,
    AlertCircle
} from 'lucide-react'
import '../admin/Dashboard.css'

// LocalStorage keys for fallback
const STORAGE_KEY = 'cat_jadwal_data'
const MATKUL_STORAGE_KEY = 'cat_matkul_data'
const PRODI_STORAGE_KEY = 'cat_prodi_data'
const KELAS_STORAGE_KEY = 'cat_kelas_data'

function JadwalModal({ isOpen, onClose, jadwal, onSave, matkulList = [], kelasList = [], isLoading }) {
    const getDefaultFormData = () => ({
        matkul_id: matkulList[0]?.id || '',
        kelas_id: kelasList[0]?.id || '',
        tipe_ujian: 'UTS',
        tanggal: '',
        waktu_mulai: '08:00',
        waktu_selesai: '10:00',
        ruangan: ''
    })

    const [formData, setFormData] = useState(jadwal || getDefaultFormData())
    const [matkulSearch, setMatkulSearch] = useState('')

    useEffect(() => {
        if (isOpen) {
            if (jadwal) {
                setFormData({
                    ...jadwal,
                    matkul_id: jadwal.matkul_id || jadwal.matkulId || matkulList[0]?.id || '',
                    kelas_id: jadwal.kelas_id || jadwal.kelasId || kelasList[0]?.id || '',
                    tipe_ujian: jadwal.tipe_ujian || jadwal.tipeUjian || 'UTS',
                    waktu_mulai: jadwal.waktu_mulai || jadwal.waktuMulai || '08:00',
                    waktu_selesai: jadwal.waktu_selesai || jadwal.waktuSelesai || '10:00',
                    ruangan: jadwal.ruangan || jadwal.ruang || ''
                })
            } else {
                setFormData(getDefaultFormData())
            }
            setMatkulSearch('')
        }
    }, [jadwal, isOpen, matkulList, kelasList])

    const handleSubmit = (e) => {
        e.preventDefault()
        // Validate matkul_id is selected
        if (!formData.matkul_id) {
            alert('Silakan pilih Mata Kuliah')
            return
        }
        onSave(formData)
    }

    // Filter lists based on search - only for Matkul
    const filteredMatkul = matkulList.filter(m =>
        m.nama?.toLowerCase().includes(matkulSearch.toLowerCase()) ||
        m.kode?.toLowerCase().includes(matkulSearch.toLowerCase())
    )

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '95%' }}>
                <div className="modal-header">
                    <h3>{jadwal ? 'Edit Jadwal Ujian' : 'Tambah Jadwal Ujian'}</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Mata Kuliah with Search */}
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Mata Kuliah</label>
                            {formData.matkul_id ? (
                                // Show selected matkul with change button
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1rem',
                                    background: 'var(--primary-50)',
                                    border: '1px solid var(--primary-200)',
                                    borderRadius: 'var(--radius-md)'
                                }}>
                                    <span style={{ flex: 1, color: 'var(--primary-700)', fontWeight: '500' }}>
                                        ✓ {matkulList.find(m => m.id === formData.matkul_id)?.kode} - {matkulList.find(m => m.id === formData.matkul_id)?.nama}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-ghost"
                                        onClick={() => setFormData({ ...formData, matkul_id: '' })}
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                    >
                                        Ganti
                                    </button>
                                </div>
                            ) : (
                                // Show search and list
                                <>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="🔍 Cari mata kuliah (kode/nama)..."
                                        value={matkulSearch}
                                        onChange={e => setMatkulSearch(e.target.value)}
                                        style={{ marginBottom: '0.5rem' }}
                                    />
                                    <div style={{
                                        maxHeight: '150px',
                                        overflowY: 'auto',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'var(--bg-primary)'
                                    }}>
                                        {filteredMatkul.length === 0 ? (
                                            <div style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                                Tidak ada hasil
                                            </div>
                                        ) : (
                                            filteredMatkul.slice(0, 10).map(m => (
                                                <div
                                                    key={m.id}
                                                    onClick={() => {
                                                        setFormData({ ...formData, matkul_id: m.id })
                                                        setMatkulSearch('')
                                                    }}
                                                    style={{
                                                        padding: '0.75rem 1rem',
                                                        cursor: 'pointer',
                                                        borderBottom: '1px solid var(--border-color)'
                                                    }}
                                                    className="matkul-item"
                                                    onMouseEnter={e => e.target.style.background = 'var(--gray-100)'}
                                                    onMouseLeave={e => e.target.style.background = 'transparent'}
                                                >
                                                    {m.kode} - {m.nama}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Kelas - Simple Dropdown */}
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Kelas</label>
                            <select
                                className="form-input"
                                value={formData.kelas_id}
                                onChange={e => setFormData({ ...formData, kelas_id: e.target.value })}
                                required
                            >
                                <option value="">Pilih Kelas</option>
                                {kelasList.map(k => (
                                    <option key={k.id} value={k.id}>{k.nama} ({k.angkatan})</option>
                                ))}
                            </select>
                        </div>

                        {/* Tipe Ujian - Full Width */}
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Tipe Ujian</label>
                            <select
                                className="form-input"
                                value={formData.tipe_ujian}
                                onChange={e => setFormData({ ...formData, tipe_ujian: e.target.value })}
                                required
                            >
                                <option value="UTS">UTS</option>
                                <option value="UAS">UAS</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Tanggal</label>
                            <input
                                type="date"
                                className="form-input"
                                value={formData.tanggal}
                                onChange={e => setFormData({ ...formData, tanggal: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Waktu Mulai</label>
                                <input
                                    type="time"
                                    className="form-input"
                                    value={formData.waktu_mulai}
                                    onChange={e => setFormData({ ...formData, waktu_mulai: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Waktu Selesai</label>
                                <input
                                    type="time"
                                    className="form-input"
                                    value={formData.waktu_selesai}
                                    onChange={e => setFormData({ ...formData, waktu_selesai: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
                        <button type="submit" className="btn btn-primary" disabled={isLoading}>
                            {isLoading ? <span className="spinner"></span> : <Save size={16} />}
                            {isLoading ? 'Menyimpan...' : 'Simpan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function JadwalUjianPage() {
    const { user } = useAuth()
    const { showConfirm } = useConfirm()

    // State
    const [jadwalList, setJadwalList] = useState([])
    const [matkulList, setMatkulList] = useState([])
    const [prodiList, setProdiList] = useState([])
    const [kelasList, setKelasList] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState(null)
    const [useSupabase, setUseSupabase] = useState(false)

    const [modalOpen, setModalOpen] = useState(false)
    const [editingJadwal, setEditingJadwal] = useState(null)
    const [dateFilter, setDateFilter] = useState('')
    const [prodiFilter, setProdiFilter] = useState(user?.role === 'superadmin' ? 'all' : (user?.prodiId || 'all'))

    // Load data on mount
    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setIsLoading(true)
        setError(null)

        try {
            if (isSupabaseConfigured()) {
                const [jadwalData, matkulData, prodiData, kelasData] = await Promise.all([
                    jadwalService.getAll(),
                    matkulService.getAll(),
                    prodiService.getAll(),
                    kelasService.getAll()
                ])
                setJadwalList(jadwalData)
                setMatkulList(matkulData)
                setProdiList(prodiData)
                setKelasList(kelasData)
                setUseSupabase(true)
            } else {
                // Fallback to localStorage
                const jadwal = localStorage.getItem(STORAGE_KEY)
                const matkul = localStorage.getItem(MATKUL_STORAGE_KEY)
                const prodi = localStorage.getItem(PRODI_STORAGE_KEY)
                const kelas = localStorage.getItem(KELAS_STORAGE_KEY)
                setJadwalList(jadwal ? JSON.parse(jadwal) : [])
                setMatkulList(matkul ? JSON.parse(matkul) : [])
                setProdiList(prodi ? JSON.parse(prodi) : [])
                setKelasList(kelas ? JSON.parse(kelas) : [])
                setUseSupabase(false)
            }
        } catch (err) {
            console.error('Error loading jadwal:', err)
            setError('Gagal memuat data. Menggunakan data lokal.')
            const jadwal = localStorage.getItem(STORAGE_KEY)
            const matkul = localStorage.getItem(MATKUL_STORAGE_KEY)
            const prodi = localStorage.getItem(PRODI_STORAGE_KEY)
            const kelas = localStorage.getItem(KELAS_STORAGE_KEY)
            setJadwalList(jadwal ? JSON.parse(jadwal) : [])
            setMatkulList(matkul ? JSON.parse(matkul) : [])
            setProdiList(prodi ? JSON.parse(prodi) : [])
            setKelasList(kelas ? JSON.parse(kelas) : [])
            setUseSupabase(false)
        } finally {
            setIsLoading(false)
        }
    }

    // Backup to localStorage
    useEffect(() => {
        if (jadwalList.length > 0 && !useSupabase) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(jadwalList))
        }
    }, [jadwalList, useSupabase])

    const isSuperAdmin = user?.role === 'superadmin'

    // Helper to get prodi_id from jadwal via kelas relation
    const getJadwalProdiId = (j) => {
        // First try direct prodi_id on jadwal (localStorage)
        if (j.prodi_id || j.prodiId) return j.prodi_id || j.prodiId
        // Otherwise get from kelas
        const kelasId = j.kelas_id || j.kelasId
        const kelas = kelasList.find(k => k.id === kelasId)
        return kelas?.prodi_id || kelas?.prodiId || null
    }
    const getJadwalMatkul = (j) => j.matkul_id || j.matkulId
    const getJadwalKelas = (j) => j.kelas_id || j.kelasId
    const getJadwalTipe = (j) => j.tipe_ujian || j.tipeUjian || j.tipe
    const getJadwalWaktuMulai = (j) => j.waktu_mulai || j.waktuMulai
    const getJadwalWaktuSelesai = (j) => j.waktu_selesai || j.waktuSelesai
    const getJadwalRuang = (j) => j.ruangan || j.ruang || '-'

    // Filter berdasarkan prodi untuk stats
    const prodiFilteredJadwal = jadwalList.filter(j => {
        const prodiId = getJadwalProdiId(j)
        return isSuperAdmin
            ? (prodiFilter === 'all' || prodiId === prodiFilter)
            : prodiId === user?.prodiId
    })

    const filteredJadwal = prodiFilteredJadwal.filter(j => {
        return !dateFilter || j.tanggal === dateFilter
    }).sort((a, b) => {
        if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal)
        return (getJadwalWaktuMulai(a) || '').localeCompare(getJadwalWaktuMulai(b) || '')
    })

    const handleAdd = () => {
        setEditingJadwal(null)
        setModalOpen(true)
    }

    const handleEdit = (jadwal) => {
        setEditingJadwal(jadwal)
        setModalOpen(true)
    }

    const handleSave = async (data) => {
        setIsSaving(true)
        try {
            const jadwalData = {
                matkul_id: data.matkul_id || data.matkulId,
                kelas_id: data.kelas_id || data.kelasId,
                tipe: data.tipe_ujian || data.tipeUjian || data.tipe || 'UTS',
                tanggal: data.tanggal,
                waktu_mulai: data.waktu_mulai || data.waktuMulai,
                waktu_selesai: data.waktu_selesai || data.waktuSelesai
            }

            if (useSupabase) {
                if (editingJadwal) {
                    await jadwalService.update(editingJadwal.id, jadwalData)
                } else {
                    await jadwalService.create(jadwalData)
                }
                await loadData()
            } else {
                // LocalStorage fallback
                const localData = {
                    ...jadwalData,
                    prodiId: jadwalData.prodi_id,
                    matkulId: jadwalData.matkul_id,
                    kelasId: jadwalData.kelas_id,
                    tipeUjian: jadwalData.tipe,
                    waktuMulai: jadwalData.waktu_mulai,
                    waktuSelesai: jadwalData.waktu_selesai
                }
                if (editingJadwal) {
                    setJadwalList(jadwalList.map(j => j.id === editingJadwal.id ? { ...localData, id: editingJadwal.id } : j))
                } else {
                    setJadwalList([...jadwalList, { ...localData, id: Date.now() }])
                }
            }
            setModalOpen(false)
        } catch (err) {
            console.error('Error saving jadwal:', err)
            setError('Gagal menyimpan jadwal.')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id) => {
        showConfirm({
            title: 'Konfirmasi Hapus',
            message: 'Hapus jadwal ujian ini?',
            onConfirm: async () => {
                try {
                    if (useSupabase) {
                        await jadwalService.delete(id)
                        await loadData()
                    } else {
                        setJadwalList(jadwalList.filter(j => j.id !== id))
                    }
                } catch (err) {
                    console.error('Error deleting:', err)
                    setError('Gagal menghapus jadwal.')
                }
            }
        })
    }

    const getMatkulName = (id) => {
        const m = matkulList.find(mk => mk.id === id)
        return m ? `${m.kode} - ${m.nama}` : '-'
    }

    const getKelasName = (id) => {
        const k = kelasList.find(kl => kl.id === id)
        return k ? `Kelas ${k.nama}` : '-'
    }

    const getProdiName = (prodiId, kelasId) => {
        // First try direct prodiId
        if (prodiId) {
            const p = prodiList.find(pr => pr.id === prodiId)
            if (p) return p.kode
        }
        // Fallback: get prodi from kelas
        if (kelasId) {
            const k = kelasList.find(kl => kl.id === kelasId)
            if (k?.prodi_id || k?.prodiId) {
                const p = prodiList.find(pr => pr.id === (k.prodi_id || k.prodiId))
                if (p) return p.kode
            }
        }
        return '-'
    }

    const getTipeBadge = (tipe) => {
        switch (tipe) {
            case 'UAS': return 'error'
            case 'UTS': return 'warning'
            default: return 'info'
        }
    }

    // Group by date
    const groupedJadwal = filteredJadwal.reduce((acc, j) => {
        if (!acc[j.tanggal]) acc[j.tanggal] = []
        acc[j.tanggal].push(j)
        return acc
    }, {})

    const handlePrint = () => {
        const printContent = `
            <html>
            <head>
                <title>Jadwal Ujian</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { text-align: center; font-size: 18px; margin-bottom: 5px; }
                    h2 { text-align: center; font-size: 14px; color: #666; margin-bottom: 20px; }
                    .date-section { margin-bottom: 20px; }
                    .date-header { font-weight: bold; background: #f0f0f0; padding: 8px; margin-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background: #f5f5f5; }
                </style>
            </head>
            <body>
                <h1>JADWAL UJIAN</h1>
                <h2>POLTEKTRANS SDP PALEMBANG</h2>
                ${Object.keys(groupedJadwal).sort().map(date => `
                    <div class="date-section">
                        <div class="date-header">${new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Waktu</th>
                                    <th>Mata Kuliah</th>
                                    <th>Kelas</th>
                                    <th>Tipe</th>
                                    <th>Ruang</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${groupedJadwal[date].map(j => `
                                    <tr>
                                        <td>${getJadwalWaktuMulai(j)} - ${getJadwalWaktuSelesai(j)}</td>
                                        <td>${getMatkulName(getJadwalMatkul(j))}</td>
                                        <td>${getKelasName(getJadwalKelas(j))}</td>
                                        <td>${getJadwalTipe(j)}</td>
                                        <td>${getJadwalRuang(j)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `).join('')}
            </body>
            </html>
        `
        const printWindow = window.open('', '_blank')
        printWindow.document.write(printContent)
        printWindow.document.close()
        printWindow.print()
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">
                            Jadwal Ujian
                            <span className={`badge badge-${useSupabase ? 'success' : 'warning'}`} style={{ marginLeft: '12px', fontSize: '12px' }}>
                                {useSupabase ? 'Database' : 'Local'}
                            </span>
                        </h1>
                        <p className="page-subtitle">
                            {isSuperAdmin
                                ? 'Lihat jadwal ujian dari seluruh program studi'
                                : 'Kelola jadwal ujian untuk program studi Anda'}
                        </p>
                    </div>
                    <div className="header-actions">
                        <button className="btn btn-outline" onClick={loadData} disabled={isLoading}>
                            <RefreshCw size={18} className={isLoading ? 'spin' : ''} />
                            {isLoading ? 'Memuat...' : 'Refresh'}
                        </button>
                        <button className="btn btn-outline" onClick={handlePrint}>
                            <Printer size={18} />
                            Cetak
                        </button>
                        {!isSuperAdmin && (
                            <button className="btn btn-primary" onClick={handleAdd}>
                                <Plus size={18} />
                                Tambah Jadwal
                            </button>
                        )}
                    </div>
                </div>

                {/* Error Alert */}
                {error && (
                    <div className="alert alert-error mb-4" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={18} />
                        {error}
                        <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Stats */}
                <div className="mini-stats">
                    <div className="mini-stat">
                        <span className="mini-stat-value">{prodiFilteredJadwal.length}</span>
                        <span className="mini-stat-label">Total Jadwal</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">{prodiFilteredJadwal.filter(j => j.tipeUjian === 'UTS').length}</span>
                        <span className="mini-stat-label">UTS</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">{prodiFilteredJadwal.filter(j => j.tipeUjian === 'UAS').length}</span>
                        <span className="mini-stat-label">UAS</span>
                    </div>

                </div>

                {/* Filter */}
                <div className="card mb-4">
                    <div className="card-body">
                        <div className="filter-group" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                            <Filter size={16} />
                            {isSuperAdmin && (
                                <>
                                    <span>Program Studi:</span>
                                    <select
                                        className="form-input"
                                        value={prodiFilter}
                                        onChange={e => setProdiFilter(e.target.value)}
                                        style={{ width: 'auto', minWidth: '200px' }}
                                    >
                                        <option value="all">Semua Prodi</option>
                                        {prodiList.map(p => (
                                            <option key={p.id} value={p.id}>{p.kode} - {p.nama}</option>
                                        ))}
                                    </select>
                                </>
                            )}
                            <span>Tanggal:</span>
                            <input
                                type="date"
                                className="form-input"
                                value={dateFilter}
                                onChange={e => setDateFilter(e.target.value)}
                                style={{ width: 'auto' }}
                            />
                            {(dateFilter || (isSuperAdmin && prodiFilter !== 'all')) && (
                                <button className="btn btn-ghost btn-sm" onClick={() => { setDateFilter(''); setProdiFilter('all') }}>
                                    Reset Filter
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Jadwal List */}
                <div className="jadwal-groups">
                    {Object.keys(groupedJadwal).sort().map(date => (
                        <div key={date} className="card mb-4">
                            <div className="card-header">
                                <div className="date-header">
                                    <Calendar size={18} />
                                    <span>{new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                </div>
                                <span className="text-muted">{groupedJadwal[date].length} ujian</span>
                            </div>
                            <div className="card-body">
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Waktu</th>
                                                <th>Mata Kuliah</th>
                                                <th>Kelas</th>
                                                {isSuperAdmin && <th>Prodi</th>}
                                                <th>Tipe</th>
                                                <th>Ruang</th>
                                                {!isSuperAdmin && <th>Aksi</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {groupedJadwal[date].map(j => (
                                                <tr key={j.id}>
                                                    <td>
                                                        <div className="time-cell">
                                                            <Clock size={14} />
                                                            <span>{getJadwalWaktuMulai(j)} - {getJadwalWaktuSelesai(j)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="font-medium">{getMatkulName(getJadwalMatkul(j))}</td>
                                                    <td>{getKelasName(getJadwalKelas(j))}</td>
                                                    {isSuperAdmin && (
                                                        <td>
                                                            <span className="badge badge-primary">{getProdiName(getJadwalProdiId(j), getJadwalKelas(j))}</span>
                                                        </td>
                                                    )}
                                                    <td>
                                                        <span className={`badge badge-${getTipeBadge(getJadwalTipe(j))}`}>{getJadwalTipe(j)}</span>
                                                    </td>
                                                    <td>
                                                        <div className="room-cell">
                                                            <MapPin size={14} />
                                                            {getJadwalRuang(j)}
                                                        </div>
                                                    </td>
                                                    {!isSuperAdmin && (
                                                        <td>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    className="btn btn-icon btn-ghost btn-sm"
                                                                    onClick={() => handleEdit(j)}
                                                                >
                                                                    <Edit2 size={14} />
                                                                </button>
                                                                <button
                                                                    className="btn btn-icon btn-ghost btn-sm text-error"
                                                                    onClick={(e) => { e.stopPropagation(); handleDelete(j.id); }}
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ))}

                    {Object.keys(groupedJadwal).length === 0 && (
                        <div className="empty-state">
                            <Calendar size={48} />
                            <h3>Tidak ada jadwal</h3>
                            <p>Belum ada jadwal ujian yang dibuat</p>
                            <button className="btn btn-primary" onClick={handleAdd}>
                                <Plus size={16} />
                                Tambah Jadwal
                            </button>
                        </div>
                    )}
                </div>

                <JadwalModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    jadwal={editingJadwal}
                    onSave={handleSave}
                    isLoading={isSaving}
                    matkulList={user?.role === 'superadmin' ? matkulList : matkulList.filter(m => (m.prodi_id || m.prodiId) === user?.prodiId)}
                    kelasList={user?.role === 'superadmin' ? kelasList : kelasList.filter(k => (k.prodi_id || k.prodiId) === user?.prodiId)}
                />
            </div>

            <style>{`
                .mb-4 {
                    margin-bottom: var(--space-4);
                }
                .filter-group {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                }
                .date-header {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    font-weight: var(--font-semibold);
                }
                .time-cell, .room-cell {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                }
                .time-cell {
                    color: var(--primary-600);
                    font-weight: var(--font-medium);
                }
                .room-cell {
                    color: var(--text-secondary);
                }
                .empty-state {
                    text-align: center;
                    padding: var(--space-12);
                    color: var(--text-muted);
                }
                .empty-state svg {
                    margin-bottom: var(--space-4);
                    opacity: 0.5;
                }
                .empty-state h3 {
                    margin-bottom: var(--space-2);
                    color: var(--text-secondary);
                }
                .empty-state p {
                    margin-bottom: var(--space-4);
                }
                .text-error {
                    color: var(--error-500);
                }
                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--space-4);
                }
            `}</style>
        </DashboardLayout>
    )
}

export default JadwalUjianPage
