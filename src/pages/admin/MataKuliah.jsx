import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useConfirm } from '../../components/ConfirmDialog'
import { matkulService, prodiService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    BookOpen,
    Search,
    Plus,
    Edit2,
    Trash2,
    X,
    Save,
    Filter,
    Info,
    RefreshCw,
    AlertCircle
} from 'lucide-react'
import '../admin/Dashboard.css'

// LocalStorage keys for fallback
const STORAGE_KEY = 'cat_matkul_data'
const PRODI_STORAGE_KEY = 'cat_prodi_data'

function MatkulModal({ isOpen, onClose, matkul, onSave, prodiList, isLoading }) {
    const [formData, setFormData] = useState(matkul || {
        kode: '',
        nama: '',
        sks: 3,
        prodi_id: prodiList[0]?.id || ''
    })

    useEffect(() => {
        setFormData(matkul || {
            kode: '',
            nama: '',
            sks: 3,
            prodi_id: prodiList[0]?.id || ''
        })
    }, [matkul, prodiList])

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave({
            ...formData,
            sks: Number(formData.sks)
        })
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{matkul ? 'Edit Mata Kuliah' : 'Tambah Mata Kuliah'}</h3>
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
                                <label className="form-label">Kode Mata Kuliah</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.kode}
                                    onChange={e => setFormData({ ...formData, kode: e.target.value.toUpperCase() })}
                                    placeholder="Contoh: TI101"
                                    maxLength={20}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">SKS</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={formData.sks}
                                    onChange={e => setFormData({ ...formData, sks: e.target.value })}
                                    min={1}
                                    max={6}
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Nama Mata Kuliah</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.nama}
                                onChange={e => setFormData({ ...formData, nama: e.target.value })}
                                placeholder="Contoh: Algoritma dan Pemrograman"
                                required
                            />
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

function MataKuliahPage() {
    const { user } = useAuth()
    const { showConfirm } = useConfirm()

    const [matkulList, setMatkulList] = useState([])
    const [prodiList, setProdiList] = useState([])
    const [search, setSearch] = useState('')
    const [prodiFilter, setProdiFilter] = useState('all')
    const [modalOpen, setModalOpen] = useState(false)
    const [editingMatkul, setEditingMatkul] = useState(null)
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
                const [matkulData, prodiData] = await Promise.all([
                    matkulService.getAll(),
                    prodiService.getAll()
                ])
                setMatkulList(matkulData)
                setProdiList(prodiData)
                setUseSupabase(true)
            } else {
                const savedMatkul = localStorage.getItem(STORAGE_KEY)
                const savedProdi = localStorage.getItem(PRODI_STORAGE_KEY)
                setMatkulList(savedMatkul ? JSON.parse(savedMatkul) : [])
                setProdiList(savedProdi ? JSON.parse(savedProdi) : [])
                setUseSupabase(false)
            }
        } catch (err) {
            console.error('Error loading data:', err)
            setError('Gagal memuat data. Menggunakan data lokal.')
            const savedMatkul = localStorage.getItem(STORAGE_KEY)
            const savedProdi = localStorage.getItem(PRODI_STORAGE_KEY)
            setMatkulList(savedMatkul ? JSON.parse(savedMatkul) : [])
            setProdiList(savedProdi ? JSON.parse(savedProdi) : [])
            setUseSupabase(false)
        } finally {
            setIsLoading(false)
        }
    }

    // Backup to localStorage
    useEffect(() => {
        if (matkulList.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(matkulList))
        }
    }, [matkulList])

    const isAdminProdi = user?.role === 'admin_prodi'
    const effectiveProdiFilter = isAdminProdi ? user.prodiId : prodiFilter
    const availableProdiList = isAdminProdi
        ? prodiList.filter(p => p.id === user.prodiId)
        : prodiList

    const filteredMatkul = matkulList.filter(m => {
        const prodi = m.prodi || prodiList.find(p => p.id === m.prodi_id)
        const matchesSearch = m.nama.toLowerCase().includes(search.toLowerCase()) ||
            m.kode.toLowerCase().includes(search.toLowerCase())
        const matchesProdi = effectiveProdiFilter === 'all' || m.prodi_id === effectiveProdiFilter
        return matchesSearch && matchesProdi
    })

    const handleAddMatkul = () => {
        setEditingMatkul(null)
        setModalOpen(true)
    }

    const handleEditMatkul = (matkul) => {
        setEditingMatkul(matkul)
        setModalOpen(true)
    }

    const handleSaveMatkul = async (data) => {
        setIsSaving(true)
        try {
            if (useSupabase) {
                if (editingMatkul) {
                    await matkulService.update(editingMatkul.id, data)
                } else {
                    await matkulService.create(data)
                }
                await loadData()
            } else {
                if (editingMatkul) {
                    setMatkulList(matkulList.map(m => m.id === editingMatkul.id ? { ...data, id: editingMatkul.id } : m))
                } else {
                    setMatkulList([...matkulList, { ...data, id: Date.now() }])
                }
            }
            setModalOpen(false)
        } catch (err) {
            console.error('Error saving matkul:', err)
            alert('Gagal menyimpan: ' + err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteMatkul = (id) => {
        showConfirm({
            title: 'Konfirmasi Hapus',
            message: 'Apakah Anda yakin ingin menghapus mata kuliah ini?',
            onConfirm: async () => {
                try {
                    if (useSupabase) {
                        await matkulService.delete(id)
                        await loadData()
                    } else {
                        setMatkulList(matkulList.filter(m => m.id !== id))
                    }
                } catch (err) {
                    console.error('Error deleting:', err)
                    alert('Gagal menghapus: ' + err.message)
                }
            }
        })
    }

    const getProdiInfo = (matkul) => {
        const prodi = matkul.prodi || prodiList.find(p => p.id === matkul.prodi_id)
        return prodi || { kode: '-', nama: '-' }
    }

    const totalSKS = filteredMatkul.reduce((sum, m) => sum + (m.sks || 0), 0)

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Manajemen Mata Kuliah</h1>
                        <p className="page-subtitle">
                            Kelola data mata kuliah per program studi
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
                        <button className="btn btn-primary" onClick={handleAddMatkul}>
                            <Plus size={18} />
                            Tambah Mata Kuliah
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
                        <span className="mini-stat-value">{filteredMatkul.length}</span>
                        <span className="mini-stat-label">Total Matkul</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">{totalSKS}</span>
                        <span className="mini-stat-label">Total SKS</span>
                    </div>
                </div>

                <div className="card">
                    <div className="card-body">
                        <div className="filters-row">
                            <div className="search-box">
                                <Search size={18} className="search-icon" />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Cari kode atau nama mata kuliah..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            {!isAdminProdi && (
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
                                            <th style={{ width: '100px' }}>Kode</th>
                                            <th>Nama Mata Kuliah</th>
                                            <th style={{ width: '80px' }} className="text-center">SKS</th>
                                            <th style={{ width: '120px' }}>Prodi</th>
                                            <th style={{ width: '100px' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredMatkul.map(matkul => {
                                            const prodi = getProdiInfo(matkul)
                                            return (
                                                <tr key={matkul.id}>
                                                    <td>
                                                        <span className="matkul-kode">{matkul.kode}</span>
                                                    </td>
                                                    <td>
                                                        <div className="matkul-cell">
                                                            <BookOpen size={18} className="matkul-icon" />
                                                            <span className="font-medium">{matkul.nama}</span>
                                                        </div>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className="sks-badge">{matkul.sks}</span>
                                                    </td>
                                                    <td>
                                                        <span className="badge badge-primary">{prodi.kode}</span>
                                                    </td>
                                                    <td>
                                                        <div className="flex gap-2">
                                                            <button
                                                                className="btn btn-icon btn-ghost btn-sm"
                                                                onClick={() => handleEditMatkul(matkul)}
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button
                                                                className="btn btn-icon btn-ghost btn-sm text-error"
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteMatkul(matkul.id); }}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {filteredMatkul.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="text-center text-muted" style={{ padding: 'var(--space-8)' }}>
                                                    Tidak ada data mata kuliah
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <MatkulModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    matkul={editingMatkul}
                    onSave={handleSaveMatkul}
                    prodiList={availableProdiList}
                    isLoading={isSaving}
                />
            </div>

            <style>{`
        .matkul-cell {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        
        .matkul-icon {
          color: var(--accent-500);
        }
        
        .matkul-kode {
          font-family: monospace;
          font-size: var(--font-size-sm);
          font-weight: var(--font-medium);
          color: var(--text-secondary);
        }
        
        .text-center {
          text-align: center;
        }
        
        .sks-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          font-weight: var(--font-semibold);
          background: var(--info-100);
          color: var(--info-700);
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
      `}</style>
        </DashboardLayout>
    )
}

export default MataKuliahPage
