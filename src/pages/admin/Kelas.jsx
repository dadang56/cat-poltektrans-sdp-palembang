import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useConfirm } from '../../components/ConfirmDialog'
import { kelasService, prodiService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    Users as UsersIcon,
    Search,
    Plus,
    Edit2,
    Trash2,
    X,
    Save,
    Filter,
    RefreshCw,
    AlertCircle
} from 'lucide-react'
import '../admin/Dashboard.css'

// LocalStorage keys for fallback
const STORAGE_KEY = 'cat_kelas_data'
const PRODI_STORAGE_KEY = 'cat_prodi_data'

// Angkatan options
const generateAngkatanOptions = () => {
    const options = []
    const startAngkatan = 34
    const startYear = 2023
    const currentYear = new Date().getFullYear()
    for (let i = 0; i <= (currentYear - startYear + 10); i++) {
        options.push({
            value: startAngkatan + i,
            label: `Angkatan ${startAngkatan + i} (${startYear + i})`
        })
    }
    return options
}
const ANGKATAN_OPTIONS = generateAngkatanOptions()

function KelasModal({ isOpen, onClose, kelas, onSave, prodiList, isLoading }) {
    const [formData, setFormData] = useState(kelas || {
        nama: '',
        prodi_id: prodiList[0]?.id || '',
        angkatan: 36,
        semester: 1
    })

    useEffect(() => {
        setFormData(kelas || {
            nama: '',
            prodi_id: prodiList[0]?.id || '',
            angkatan: 36,
            semester: 1
        })
    }, [kelas, prodiList])

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave(formData)
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{kelas ? 'Edit Kelas' : 'Tambah Kelas'}</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Program Studi</label>
                            <select
                                className="form-input"
                                value={formData.prodi_id}
                                onChange={e => setFormData({ ...formData, prodi_id: e.target.value })}
                                required
                            >
                                <option value="">Pilih Prodi</option>
                                {prodiList.map(p => (
                                    <option key={p.id} value={p.id}>{p.kode} - {p.nama}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Nama Kelas</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.nama}
                                    onChange={e => setFormData({ ...formData, nama: e.target.value.toUpperCase() })}
                                    placeholder="Contoh: TI-1A"
                                    maxLength={20}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Angkatan</label>
                                <select
                                    className="form-input"
                                    value={formData.angkatan}
                                    onChange={e => setFormData({ ...formData, angkatan: Number(e.target.value) })}
                                    required
                                >
                                    {ANGKATAN_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Semester</label>
                            <select
                                className="form-input"
                                value={formData.semester || 1}
                                onChange={e => setFormData({ ...formData, semester: Number(e.target.value) })}
                                required
                            >
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                                    <option key={sem} value={sem}>Semester {sem}</option>
                                ))}
                            </select>
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

function KelasPage() {
    const { user } = useAuth()
    const { showConfirm } = useConfirm()

    const [kelasList, setKelasList] = useState([])
    const [prodiList, setProdiList] = useState([])
    const [search, setSearch] = useState('')
    const [prodiFilter, setProdiFilter] = useState('all')
    const [modalOpen, setModalOpen] = useState(false)
    const [editingKelas, setEditingKelas] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState(null)
    const [useSupabase, setUseSupabase] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setIsLoading(true)
        setError(null)

        try {
            if (isSupabaseConfigured()) {
                const [kelasData, prodiData] = await Promise.all([
                    kelasService.getAll(),
                    prodiService.getAll()
                ])
                setKelasList(kelasData)
                setProdiList(prodiData)
                setUseSupabase(true)
            } else {
                // Fallback to localStorage
                const savedKelas = localStorage.getItem(STORAGE_KEY)
                const savedProdi = localStorage.getItem(PRODI_STORAGE_KEY)
                setKelasList(savedKelas ? JSON.parse(savedKelas) : [])
                setProdiList(savedProdi ? JSON.parse(savedProdi) : [])
                setUseSupabase(false)
            }
        } catch (err) {
            console.error('Error loading data:', err)
            setError('Gagal memuat data. Menggunakan data lokal.')
            const savedKelas = localStorage.getItem(STORAGE_KEY)
            const savedProdi = localStorage.getItem(PRODI_STORAGE_KEY)
            setKelasList(savedKelas ? JSON.parse(savedKelas) : [])
            setProdiList(savedProdi ? JSON.parse(savedProdi) : [])
            setUseSupabase(false)
        } finally {
            setIsLoading(false)
        }
    }

    // Backup to localStorage
    useEffect(() => {
        if (kelasList.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(kelasList))
        }
    }, [kelasList])

    const effectiveProdiFilter = user?.role === 'admin_prodi' ? user.prodiId : prodiFilter
    const availableProdiList = user?.role === 'admin_prodi'
        ? prodiList.filter(p => p.id === user.prodiId)
        : prodiList

    const filteredKelas = kelasList.filter(k => {
        const prodi = k.prodi || prodiList.find(p => p.id === k.prodi_id)
        const matchesSearch = k.nama.toLowerCase().includes(search.toLowerCase()) ||
            prodi?.nama?.toLowerCase().includes(search.toLowerCase())
        const matchesProdi = effectiveProdiFilter === 'all' || k.prodi_id === effectiveProdiFilter
        return matchesSearch && matchesProdi
    })

    const handleAddKelas = () => {
        setEditingKelas(null)
        setModalOpen(true)
    }

    const handleEditKelas = (kelas) => {
        setEditingKelas(kelas)
        setModalOpen(true)
    }

    const handleSaveKelas = async (data) => {
        setIsSaving(true)
        setError(null)
        try {
            if (useSupabase) {
                if (editingKelas) {
                    await kelasService.update(editingKelas.id, data)
                } else {
                    await kelasService.create(data)
                }
                await loadData()
            } else {
                if (editingKelas) {
                    setKelasList(kelasList.map(k => k.id === editingKelas.id ? { ...data, id: editingKelas.id } : k))
                } else {
                    setKelasList([...kelasList, { ...data, id: Date.now() }])
                }
            }
            setModalOpen(false)
        } catch (err) {
            console.error('Error saving kelas:', err)
            setError('Gagal menyimpan: ' + err.message)
            // Don't close modal so user can see error
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteKelas = (id) => {
        showConfirm({
            title: 'Konfirmasi Hapus',
            message: 'Apakah Anda yakin ingin menghapus kelas ini?',
            onConfirm: async () => {
                try {
                    if (useSupabase) {
                        await kelasService.delete(id)
                        await loadData()
                    } else {
                        setKelasList(kelasList.filter(k => k.id !== id))
                    }
                } catch (err) {
                    console.error('Error deleting:', err)
                    alert('Gagal menghapus: ' + err.message)
                }
            }
        })
    }

    const getProdiInfo = (kelas) => {
        const prodi = kelas.prodi || prodiList.find(p => p.id === kelas.prodi_id)
        return prodi || { kode: '-', nama: '-' }
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Manajemen Kelas</h1>
                        <p className="page-subtitle">
                            Kelola data kelas per program studi
                            {useSupabase ? (
                                <span className="badge badge-success" style={{ marginLeft: '8px' }}>Database</span>
                            ) : (
                                <span className="badge badge-warning" style={{ marginLeft: '8px' }}>Local</span>
                            )}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button className="btn btn-ghost" onClick={loadData} disabled={isLoading}>
                            <RefreshCw size={18} className={isLoading ? 'spin' : ''} />
                        </button>
                        <button className="btn btn-primary" onClick={handleAddKelas}>
                            <Plus size={18} />
                            Tambah Kelas
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                <div className="mini-stats">
                    <div className="mini-stat">
                        <span className="mini-stat-value">{kelasList.length}</span>
                        <span className="mini-stat-label">Total Kelas</span>
                    </div>
                    {prodiList.slice(0, 3).map(p => (
                        <div key={p.id} className="mini-stat">
                            <span className="mini-stat-value">{kelasList.filter(k => k.prodi_id === p.id).length}</span>
                            <span className="mini-stat-label">{p.kode}</span>
                        </div>
                    ))}
                </div>

                <div className="card">
                    <div className="card-body">
                        <div className="filters-row">
                            <div className="search-box">
                                <Search size={18} className="search-icon" />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Cari kelas..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            {user?.role !== 'admin_prodi' && (
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
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center" style={{ padding: '48px' }}>
                                <div className="spinner-lg"></div>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '120px' }}>Kelas</th>
                                            <th>Program Studi</th>
                                            <th style={{ width: '120px' }}>Angkatan</th>
                                            <th style={{ width: '100px' }}>Semester</th>
                                            <th style={{ width: '100px' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredKelas.map(kelas => {
                                            const prodi = getProdiInfo(kelas)
                                            return (
                                                <tr key={kelas.id}>
                                                    <td>
                                                        <div className="kelas-badge">
                                                            <UsersIcon size={14} />
                                                            {kelas.nama}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="badge badge-primary">{prodi.kode}</span>
                                                        <span className="prodi-full-name">{prodi.nama}</span>
                                                    </td>
                                                    <td className="font-medium">Angkatan {kelas.angkatan || '-'}</td>
                                                    <td className="font-medium">Semester {kelas.semester || '-'}</td>
                                                    <td>
                                                        <div className="flex gap-2">
                                                            <button
                                                                className="btn btn-icon btn-ghost btn-sm"
                                                                onClick={() => handleEditKelas(kelas)}
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button
                                                                className="btn btn-icon btn-ghost btn-sm text-error"
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteKelas(kelas.id); }}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {filteredKelas.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="text-center text-muted" style={{ padding: 'var(--space-8)' }}>
                                                    Tidak ada data kelas
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <KelasModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    kelas={editingKelas}
                    onSave={handleSaveKelas}
                    prodiList={availableProdiList}
                    isLoading={isSaving}
                />
            </div>

            <style>{`
        .kelas-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: var(--accent-50);
          color: var(--accent-700);
          border-radius: var(--radius-md);
          font-weight: var(--font-semibold);
        }
        
        .prodi-full-name {
          display: block;
          font-size: var(--font-size-xs);
          color: var(--text-muted);
          margin-top: var(--space-1);
        }
        
        .text-error {
          color: var(--error-500);
        }
        
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
        }

        .spin {
          animation: spin 1s linear infinite;
        }
        
        @media (max-width: 640px) {
          .form-row {
            grid-template-columns: 1fr;
          }
        }
        
        [data-theme="dark"] .kelas-badge {
          background: rgba(0, 168, 168, 0.15);
        }
      `}</style>
        </DashboardLayout>
    )
}

export default KelasPage
