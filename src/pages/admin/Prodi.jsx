import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useConfirm } from '../../components/ConfirmDialog'
import {
    Building2,
    Search,
    Plus,
    Edit2,
    Trash2,
    X,
    Save,
    BookOpen
} from 'lucide-react'
import '../admin/Dashboard.css'

// LocalStorage key
const STORAGE_KEY = 'cat_prodi_data'

function ProdiModal({ isOpen, onClose, prodi, onSave }) {
    const [formData, setFormData] = useState(prodi || {
        kode: '',
        nama: ''
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave(formData)
        onClose()
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
                                placeholder="Contoh: DPS"
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
                                placeholder="Contoh: D4 Pengelolaan Pelabuhan dan Pelayaran Sungai"
                                required
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
                        <button type="submit" className="btn btn-primary">
                            <Save size={16} />
                            Simpan
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function ProdiPage() {
    const { showConfirm } = useConfirm()

    // Load from localStorage on mount
    const [prodiList, setProdiList] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        return saved ? JSON.parse(saved) : []
    })
    const [search, setSearch] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [editingProdi, setEditingProdi] = useState(null)

    // Save to localStorage whenever prodiList changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prodiList))
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

    const handleSaveProdi = (data) => {
        if (editingProdi) {
            setProdiList(prodiList.map(p => p.id === editingProdi.id ? { ...data, id: editingProdi.id } : p))
        } else {
            setProdiList([...prodiList, { ...data, id: Date.now() }])
        }
    }

    const handleDeleteProdi = (id) => {
        showConfirm({
            title: 'Konfirmasi Hapus',
            message: 'Apakah Anda yakin ingin menghapus program studi ini?',
            onConfirm: () => setProdiList(prodiList.filter(p => p.id !== id))
        })
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Manajemen Program Studi</h1>
                        <p className="page-subtitle">Kelola data program studi</p>
                    </div>
                    <button className="btn btn-primary" onClick={handleAddProdi}>
                        <Plus size={18} />
                        Tambah Prodi
                    </button>
                </div>

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
                    </div>
                </div>

                <ProdiModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    prodi={editingProdi}
                    onSave={handleSaveProdi}
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
      `}</style>
        </DashboardLayout>
    )
}

export default ProdiPage
