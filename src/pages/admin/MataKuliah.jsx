import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useConfirm } from '../../components/ConfirmDialog'
import {
    BookOpen,
    Search,
    Plus,
    Edit2,
    Trash2,
    X,
    Save,
    Filter,
    Info
} from 'lucide-react'
import '../admin/Dashboard.css'

// LocalStorage keys
const STORAGE_KEY = 'cat_matkul_data'
const PRODI_STORAGE_KEY = 'cat_prodi_data'

function MatkulModal({ isOpen, onClose, matkul, onSave, prodiList }) {
    const [formData, setFormData] = useState(matkul || {
        kode: '',
        nama: '',
        semester: 1,
        sksTeori: 2,
        sksPraktek: 0,
        prodiId: prodiList[0]?.id || ''
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave({
            ...formData,
            prodiId: Number(formData.prodiId),
            semester: Number(formData.semester),
            sksTeori: Number(formData.sksTeori),
            sksPraktek: Number(formData.sksPraktek)
        })
        onClose()
    }

    // Get grading formula based on praktek
    const getGradingFormula = () => {
        if (formData.sksPraktek > 0) {
            return 'NT (10%) + NUTS (20%) + NP (20%) + UAS (50%)'
        }
        return 'NT (10%) + NUTS (30%) + UAS (60%)'
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
                                <label className="form-label">Kode Mata Kuliah</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.kode}
                                    onChange={e => setFormData({ ...formData, kode: e.target.value.toUpperCase() })}
                                    placeholder="Contoh: NAV101"
                                    maxLength={10}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Semester</label>
                                <select
                                    className="form-input"
                                    value={formData.semester || 1}
                                    onChange={e => setFormData({ ...formData, semester: e.target.value })}
                                    required
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                        <option key={s} value={s}>Semester {s}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Nama Mata Kuliah</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.nama}
                                onChange={e => setFormData({ ...formData, nama: e.target.value })}
                                placeholder="Contoh: Navigasi Sungai"
                                required
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">SKS Teori</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={formData.sksTeori}
                                    onChange={e => setFormData({ ...formData, sksTeori: e.target.value })}
                                    min={0}
                                    max={6}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">SKS Praktek</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={formData.sksPraktek}
                                    onChange={e => setFormData({ ...formData, sksPraktek: e.target.value })}
                                    min={0}
                                    max={6}
                                    required
                                />
                            </div>
                        </div>

                        {/* Grading Formula Info */}
                        <div className="formula-info">
                            <Info size={16} />
                            <div>
                                <strong>Rumus Nilai:</strong>
                                <span>{getGradingFormula()}</span>
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

function MataKuliahPage() {
    const { user } = useAuth()
    const { showConfirm } = useConfirm()

    // Load from localStorage
    const [matkulList, setMatkulList] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        return saved ? JSON.parse(saved) : []
    })
    const [prodiList, setProdiList] = useState(() => {
        const saved = localStorage.getItem(PRODI_STORAGE_KEY)
        return saved ? JSON.parse(saved) : []
    })

    const [search, setSearch] = useState('')
    const [prodiFilter, setProdiFilter] = useState(user?.role === 'admin_prodi' || user?.role === 'admin-prodi' ? String(user.prodiId) : 'all')
    const [semesterFilter, setSemesterFilter] = useState('all')
    const [modalOpen, setModalOpen] = useState(false)
    const [editingMatkul, setEditingMatkul] = useState(null)

    // Save to localStorage whenever matkulList changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(matkulList))
    }, [matkulList])

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
    const isAdminProdi = user?.role === 'admin_prodi' || user?.role === 'admin-prodi'
    const effectiveProdiFilter = isAdminProdi ? String(user.prodiId) : prodiFilter
    const availableProdiList = isAdminProdi
        ? prodiList.filter(p => p.id === user.prodiId)
        : prodiList

    const filteredMatkul = matkulList.filter(m => {
        const matchesSearch = m.nama.toLowerCase().includes(search.toLowerCase()) ||
            m.kode.toLowerCase().includes(search.toLowerCase())
        const matchesProdi = effectiveProdiFilter === 'all' || String(m.prodiId) === String(effectiveProdiFilter)
        const matchesSemester = semesterFilter === 'all' || String(m.semester) === String(semesterFilter)
        return matchesSearch && matchesProdi && matchesSemester
    })

    const handleAddMatkul = () => {
        setEditingMatkul(null)
        setModalOpen(true)
    }

    const handleEditMatkul = (matkul) => {
        setEditingMatkul(matkul)
        setModalOpen(true)
    }

    const handleSaveMatkul = (data) => {
        if (editingMatkul) {
            setMatkulList(matkulList.map(m => m.id === editingMatkul.id ? { ...data, id: editingMatkul.id } : m))
        } else {
            setMatkulList([...matkulList, { ...data, id: Date.now() }])
        }
    }

    const handleDeleteMatkul = (id) => {
        showConfirm({
            title: 'Konfirmasi Hapus',
            message: 'Apakah Anda yakin ingin menghapus mata kuliah ini?',
            onConfirm: () => setMatkulList(matkulList.filter(m => m.id !== id))
        })
    }

    const getProdiName = (prodiId) => {
        const prodi = prodiList.find(p => p.id === prodiId)
        return prodi ? prodi.kode : '-'
    }

    // Stats - use filtered matkul for admin_prodi
    const statsBaseMatkul = isAdminProdi
        ? matkulList.filter(m => String(m.prodiId) === String(user.prodiId))
        : filteredMatkul
    const totalSKSTeori = statsBaseMatkul.reduce((sum, m) => sum + (m.sksTeori || 0), 0)
    const totalSKSPraktek = statsBaseMatkul.reduce((sum, m) => sum + (m.sksPraktek || 0), 0)

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Manajemen Mata Kuliah</h1>
                        <p className="page-subtitle">Kelola data mata kuliah per program studi</p>
                    </div>
                    <button className="btn btn-primary" onClick={handleAddMatkul}>
                        <Plus size={18} />
                        Tambah Mata Kuliah
                    </button>
                </div>

                <div className="mini-stats">
                    <div className="mini-stat">
                        <span className="mini-stat-value">{statsBaseMatkul.length}</span>
                        <span className="mini-stat-label">Total Matkul</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">{totalSKSTeori}</span>
                        <span className="mini-stat-label">Total SKS Teori</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">{totalSKSPraktek}</span>
                        <span className="mini-stat-label">Total SKS Praktek</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">{totalSKSTeori + totalSKSPraktek}</span>
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
                            <div className="filter-group">
                                <select
                                    className="form-input"
                                    value={semesterFilter}
                                    onChange={e => setSemesterFilter(e.target.value)}
                                >
                                    <option value="all">Semua Semester</option>
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                        <option key={s} value={s}>Semester {s}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '100px' }}>Kode</th>
                                        <th>Nama Mata Kuliah</th>
                                        <th style={{ width: '80px' }} className="text-center">Semester</th>
                                        <th style={{ width: '100px' }} className="text-center">SKS Teori</th>
                                        <th style={{ width: '100px' }} className="text-center">SKS Praktek</th>
                                        <th style={{ width: '80px' }} className="text-center">Total</th>
                                        <th style={{ width: '100px' }}>Prodi</th>
                                        <th style={{ width: '150px' }}>Rumus Nilai</th>
                                        <th style={{ width: '100px' }}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMatkul.map(matkul => (
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
                                                <span className="badge badge-info">Sem {matkul.semester || 1}</span>
                                            </td>
                                            <td className="text-center">
                                                <span className="sks-badge teori">{matkul.sksTeori}</span>
                                            </td>
                                            <td className="text-center">
                                                <span className={`sks-badge ${matkul.sksPraktek > 0 ? 'praktek' : 'zero'}`}>
                                                    {matkul.sksPraktek}
                                                </span>
                                            </td>
                                            <td className="text-center">
                                                <strong>{matkul.sksTeori + matkul.sksPraktek}</strong>
                                            </td>
                                            <td>
                                                <span className="badge badge-primary">{getProdiName(matkul.prodiId)}</span>
                                            </td>
                                            <td>
                                                <span className={`formula-badge ${matkul.sksPraktek > 0 ? 'with-praktek' : 'no-praktek'}`}>
                                                    {matkul.sksPraktek > 0 ? 'Dengan NP' : 'Tanpa NP'}
                                                </span>
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
                                    ))}
                                    {filteredMatkul.length === 0 && (
                                        <tr>
                                            <td colSpan={9} className="text-center text-muted" style={{ padding: 'var(--space-8)' }}>
                                                Tidak ada data mata kuliah
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <MatkulModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    matkul={editingMatkul}
                    onSave={handleSaveMatkul}
                    prodiList={availableProdiList}
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
        }
        
        .sks-badge.teori {
          background: var(--info-100);
          color: var(--info-700);
        }
        
        .sks-badge.praktek {
          background: var(--success-100);
          color: var(--success-700);
        }
        
        .sks-badge.zero {
          background: var(--gray-100);
          color: var(--gray-500);
        }
        
        .formula-badge {
          display: inline-block;
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-md);
          font-size: var(--font-size-xs);
          font-weight: var(--font-medium);
        }
        
        .formula-badge.with-praktek {
          background: var(--success-100);
          color: var(--success-700);
        }
        
        .formula-badge.no-praktek {
          background: var(--warning-100);
          color: var(--warning-700);
        }
        
        .formula-info {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          padding: var(--space-3);
          background: var(--info-50);
          border: 1px solid var(--info-200);
          border-radius: var(--radius-lg);
          margin-top: var(--space-4);
          color: var(--info-700);
        }
        
        .formula-info > div {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }
        
        .formula-info strong {
          font-size: var(--font-size-sm);
        }
        
        .formula-info span {
          font-size: var(--font-size-sm);
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
        
        [data-theme="dark"] .sks-badge.teori {
          background: rgba(59, 130, 246, 0.15);
        }
        
        [data-theme="dark"] .sks-badge.praktek {
          background: rgba(34, 197, 94, 0.15);
        }
        
        [data-theme="dark"] .formula-badge.with-praktek {
          background: rgba(34, 197, 94, 0.15);
        }
        
        [data-theme="dark"] .formula-badge.no-praktek {
          background: rgba(245, 158, 11, 0.15);
        }
        
        [data-theme="dark"] .formula-info {
          background: rgba(59, 130, 246, 0.1);
          border-color: rgba(59, 130, 246, 0.2);
        }
      `}</style>
        </DashboardLayout>
    )
}

export default MataKuliahPage
