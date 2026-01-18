import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useConfirm } from '../../components/ConfirmDialog'
import { prodiService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    Building2,
    Search,
    Plus,
    Edit2,
    Trash2,
    X,
    Save,
    RefreshCw,
    AlertCircle
} from 'lucide-react'
import '../admin/Dashboard.css'

// LocalStorage key for fallback
const STORAGE_KEY = 'cat_prodi_data'

function ProdiModal({ isOpen, onClose, prodi, onSave, isLoading }) {
    const [formData, setFormData] = useState(prodi || {
        kode: '',
        nama: ''
    })

    useEffect(() => {
        setFormData(prodi || { kode: '', nama: '' })
    }, [prodi])

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave(formData)
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{prodi ? 'Edit Program Studi' : 'Tambah Program Studi'}</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Kode Prodi</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.kode}
                                onChange={e => setFormData({ ...formData, kode: e.target.value.toUpperCase() })}
                                placeholder="Contoh: TI"
                                maxLength={10}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Nama Program Studi</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.nama}
                                onChange={e => setFormData({ ...formData, nama: e.target.value })}
                                placeholder="Contoh: Teknologi Informasi"
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

function ProdiPage() {
    const { showConfirm } = useConfirm()
    const [prodiList, setProdiList] = useState([])
    const [search, setSearch] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [editingProdi, setEditingProdi] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState(null)
    const [useSupabase, setUseSupabase] = useState(false)

    // Load data on mount
    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setIsLoading(true)
        setError(null)

        try {
            if (isSupabaseConfigured()) {
                const data = await prodiService.getAll()
                setProdiList(data)
                setUseSupabase(true)
            } else {
                // Fallback to localStorage
                const saved = localStorage.getItem(STORAGE_KEY)
                setProdiList(saved ? JSON.parse(saved) : [])
                setUseSupabase(false)
            }
        } catch (err) {
            console.error('Error loading prodi:', err)
            setError('Gagal memuat data. Menggunakan data lokal.')
            // Fallback to localStorage on error
            const saved = localStorage.getItem(STORAGE_KEY)
            setProdiList(saved ? JSON.parse(saved) : [])
            setUseSupabase(false)
        } finally {
            setIsLoading(false)
        }
    }

    // Save to localStorage as backup
    useEffect(() => {
        if (prodiList.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(prodiList))
        }
    }, [prodiList])

    const filteredProdi = prodiList.filter(p =>
        p.nama.toLowerCase().includes(search.toLowerCase()) ||
        p.kode.toLowerCase().includes(search.toLowerCase())
    )

    const handleAddProdi = () => {
        setEditingProdi(null)
        setModalOpen(true)
    }

    const handleEditProdi = (prodi) => {
        setEditingProdi(prodi)
        setModalOpen(true)
    }

    const handleSaveProdi = async (data) => {
        setIsSaving(true)
        try {
            if (useSupabase) {
                if (editingProdi) {
                    await prodiService.update(editingProdi.id, data)
                } else {
                    await prodiService.create(data)
                }
                await loadData() // Reload from database
            } else {
                // localStorage fallback
                if (editingProdi) {
                    setProdiList(prodiList.map(p => p.id === editingProdi.id ? { ...data, id: editingProdi.id } : p))
                } else {
                    setProdiList([...prodiList, { ...data, id: Date.now() }])
                }
            }
            setModalOpen(false)
        } catch (err) {
            console.error('Error saving prodi:', err)
            alert('Gagal menyimpan data: ' + err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteProdi = (id) => {
        showConfirm({
            title: 'Konfirmasi Hapus',
            message: 'Apakah Anda yakin ingin menghapus program studi ini?',
            onConfirm: async () => {
                try {
                    if (useSupabase) {
                        await prodiService.delete(id)
                        await loadData()
                    } else {
                        setProdiList(prodiList.filter(p => p.id !== id))
                    }
                } catch (err) {
                    console.error('Error deleting prodi:', err)
                    alert('Gagal menghapus: ' + err.message)
                }
            }
        })
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Manajemen Program Studi</h1>
                        <p className="page-subtitle">
                            Kelola data program studi
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
                        <button className="btn btn-primary" onClick={handleAddProdi}>
                            <Plus size={18} />
                            Tambah Prodi
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
                        <span className="mini-stat-value">{prodiList.length}</span>
                        <span className="mini-stat-label">Total Prodi</span>
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
                                    placeholder="Cari kode atau nama prodi..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
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
                                            <th style={{ width: '80px' }}>Kode</th>
                                            <th>Nama Program Studi</th>
                                            <th style={{ width: '120px' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredProdi.map(prodi => (
                                            <tr key={prodi.id}>
                                                <td>
                                                    <span className="badge badge-primary">{prodi.kode}</span>
                                                </td>
                                                <td>
                                                    <div className="prodi-cell">
                                                        <Building2 size={18} className="prodi-icon" />
                                                        <span className="font-medium">{prodi.nama}</span>
                                                    </div>
                                                </td>

                                                <td>
                                                    <div className="flex gap-2">
                                                        <button
                                                            className="btn btn-icon btn-ghost btn-sm"
                                                            onClick={() => handleEditProdi(prodi)}
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            className="btn btn-icon btn-ghost btn-sm text-error"
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteProdi(prodi.id); }}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredProdi.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="text-center text-muted" style={{ padding: 'var(--space-8)' }}>
                                                    Tidak ada data program studi
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <ProdiModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    prodi={editingProdi}
                    onSave={handleSaveProdi}
                    isLoading={isSaving}
                />
            </div>

            <style>{`
        .prodi-cell {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        
        .prodi-icon {
          color: var(--primary-500);
        }
        
        .text-error {
          color: var(--error-500);
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </DashboardLayout>
    )
}

export default ProdiPage
