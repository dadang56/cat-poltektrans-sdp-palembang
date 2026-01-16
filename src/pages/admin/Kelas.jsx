import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useConfirm } from '../../components/ConfirmDialog'
import {
    Users as UsersIcon,
    Search,
    Plus,
    Edit2,
    Trash2,
    X,
    Save,
    Filter
} from 'lucide-react'
import '../admin/Dashboard.css'

// LocalStorage keys
const STORAGE_KEY = 'cat_kelas_data'
const PRODI_STORAGE_KEY = 'cat_prodi_data'

// Angkatan options - unlimited, starting from 34 (2023)
// Generate dynamically: 34=2023, 35=2024, etc.
const generateAngkatanOptions = () => {
    const options = []
    const startAngkatan = 34 // 2023
    const startYear = 2023
    const currentYear = new Date().getFullYear()
    // Generate from angkatan 34 to 10 years ahead
    for (let i = 0; i <= (currentYear - startYear + 10); i++) {
        options.push({
            value: startAngkatan + i,
            label: `Angkatan ${startAngkatan + i} (${startYear + i})`
        })
    }
    return options
}
const ANGKATAN_OPTIONS = generateAngkatanOptions()

function KelasModal({ isOpen, onClose, kelas, onSave, prodiList }) {
    const [formData, setFormData] = useState(kelas || {
        nama: '',
        prodiId: prodiList[0]?.id || '',
        angkatan: 35 // Default to current angkatan
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave({ ...formData, prodiId: Number(formData.prodiId), angkatan: Number(formData.angkatan) })
        onClose()
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
                                value={formData.prodiId}
                                onChange={e => setFormData({ ...formData, prodiId: e.target.value })}
                                required
                            >
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
                                    placeholder="Contoh: 1A"
                                    maxLength={5}
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

function KelasPage() {
    const { user } = useAuth()
    const { showConfirm } = useConfirm()

    // Load from localStorage
    const [kelasList, setKelasList] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        return saved ? JSON.parse(saved) : []
    })
    const [prodiList, setProdiList] = useState(() => {
        const saved = localStorage.getItem(PRODI_STORAGE_KEY)
        return saved ? JSON.parse(saved) : []
    })

    const [search, setSearch] = useState('')
    const [prodiFilter, setProdiFilter] = useState(user?.role === 'admin_prodi' ? user.prodiId : 'all')
    const [modalOpen, setModalOpen] = useState(false)
    const [editingKelas, setEditingKelas] = useState(null)

    // Save to localStorage whenever kelasList changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(kelasList))
    }, [kelasList])

    // Reload prodi list when window regains focus
    useEffect(() => {
        const handleFocus = () => {
            const saved = localStorage.getItem(PRODI_STORAGE_KEY)
            if (saved) setProdiList(JSON.parse(saved))
        }
        window.addEventListener('focus', handleFocus)
        return () => window.removeEventListener('focus', handleFocus)
    }, [])

    // For admin_prodi, always filter by their prodi
    const effectiveProdiFilter = user?.role === 'admin_prodi' ? user.prodiId : prodiFilter
    const availableProdiList = user?.role === 'admin_prodi'
        ? prodiList.filter(p => p.id === user.prodiId)
        : prodiList

    const filteredKelas = kelasList.filter(k => {
        const prodi = prodiList.find(p => p.id === k.prodiId)
        const matchesSearch = k.nama.toLowerCase().includes(search.toLowerCase()) ||
            prodi?.nama.toLowerCase().includes(search.toLowerCase())
        const matchesProdi = effectiveProdiFilter === 'all' || k.prodiId === Number(effectiveProdiFilter)
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

    const handleSaveKelas = (data) => {
        if (editingKelas) {
            setKelasList(kelasList.map(k => k.id === editingKelas.id ? { ...data, id: editingKelas.id } : k))
        } else {
            setKelasList([...kelasList, { ...data, id: Date.now() }])
        }
    }

    const handleDeleteKelas = (id) => {
        showConfirm({
            title: 'Konfirmasi Hapus',
            message: 'Apakah Anda yakin ingin menghapus kelas ini?',
            onConfirm: () => setKelasList(kelasList.filter(k => k.id !== id))
        })
    }

    const getProdiName = (prodiId) => {
        const prodi = prodiList.find(p => p.id === prodiId)
        return prodi ? prodi.kode : '-'
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Manajemen Kelas</h1>
                        <p className="page-subtitle">Kelola data kelas per program studi</p>
                    </div>
                    <button className="btn btn-primary" onClick={handleAddKelas}>
                        <Plus size={18} />
                        Tambah Kelas
                    </button>
                </div>

                <div className="mini-stats">
                    <div className="mini-stat">
                        <span className="mini-stat-value">{kelasList.length}</span>
                        <span className="mini-stat-label">Total Kelas</span>
                    </div>
                    {prodiList.map(p => (
                        <div key={p.id} className="mini-stat">
                            <span className="mini-stat-value">{kelasList.filter(k => k.prodiId === p.id).length}</span>
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

                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '100px' }}>Kelas</th>
                                        <th>Program Studi</th>
                                        <th style={{ width: '100px' }}>Angkatan</th>
                                        <th style={{ width: '100px' }}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredKelas.map(kelas => (
                                        <tr key={kelas.id}>
                                            <td>
                                                <div className="kelas-badge">
                                                    <UsersIcon size={14} />
                                                    {kelas.nama}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="badge badge-primary">{getProdiName(kelas.prodiId)}</span>
                                                <span className="prodi-full-name">
                                                    {prodiList.find(p => p.id === kelas.prodiId)?.nama}
                                                </span>
                                            </td>
                                            <td className="font-medium">Angkatan {kelas.angkatan} ({1989 + kelas.angkatan})</td>
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
                                    ))}
                                    {filteredKelas.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="text-center text-muted" style={{ padding: 'var(--space-8)' }}>
                                                Tidak ada data kelas
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <KelasModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    kelas={editingKelas}
                    onSave={handleSaveKelas}
                    prodiList={availableProdiList}
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
