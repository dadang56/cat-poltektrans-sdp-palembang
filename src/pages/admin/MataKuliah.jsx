import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useConfirm } from '../../components/ConfirmDialog'
import { matkulService, prodiService, isSupabaseConfigured } from '../../services/supabaseService'
import { exportToXLSX, downloadTemplate, importFromFile, isValidSpreadsheetFile } from '../../utils/excelUtils'
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
    AlertCircle,
    Download,
    Upload,
    FileSpreadsheet
} from 'lucide-react'
import '../admin/Dashboard.css'

// LocalStorage keys for fallback
const STORAGE_KEY = 'cat_matkul_data'
const PRODI_STORAGE_KEY = 'cat_prodi_data'

function MatkulModal({ isOpen, onClose, matkul, onSave, prodiList, isLoading }) {
    const getInitialData = (data) => ({
        kode: data?.kode || '',
        nama: data?.nama || '',
        sks_teori: data?.sks_teori ?? (data?.sks || 2),
        sks_praktek: data?.sks_praktek ?? 0,
        semester: data?.semester ?? 1,
        prodi_id: data?.prodi_id || prodiList[0]?.id || ''
    })

    const [formData, setFormData] = useState(getInitialData(matkul))

    useEffect(() => {
        setFormData(getInitialData(matkul))
    }, [matkul, prodiList])

    const handleSubmit = (e) => {
        e.preventDefault()
        const sksTeori = Number(formData.sks_teori) || 0
        const sksPraktek = Number(formData.sks_praktek) || 0
        onSave({
            ...formData,
            sks_teori: sksTeori,
            sks_praktek: sksPraktek,
            sks: sksTeori + sksPraktek, // Total SKS
            semester: Number(formData.semester) || 1
        })
    }

    const hasPraktek = Number(formData.sks_praktek) > 0
    const totalSKS = (Number(formData.sks_teori) || 0) + (Number(formData.sks_praktek) || 0)

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
                                <label className="form-label">Nama Mata Kuliah</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.nama}
                                    onChange={e => setFormData({ ...formData, nama: e.target.value })}
                                    placeholder="Contoh: Algoritma"
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Semester</label>
                                <select
                                    className="form-input"
                                    value={formData.semester}
                                    onChange={e => setFormData({ ...formData, semester: e.target.value })}
                                    required
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                        <option key={s} value={s}>Semester {s}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">SKS Teori</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={formData.sks_teori}
                                    onChange={e => setFormData({ ...formData, sks_teori: e.target.value })}
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
                                    value={formData.sks_praktek}
                                    onChange={e => setFormData({ ...formData, sks_praktek: e.target.value })}
                                    min={0}
                                    max={6}
                                />
                            </div>
                        </div>

                        {/* SKS Total and Formula Preview */}
                        <div className="sks-summary">
                            <div className="sks-total">
                                <strong>Total SKS:</strong> {totalSKS}
                            </div>
                            <div className="formula-preview">
                                <strong>Rumus Nilai:</strong><br />
                                {hasPraktek ? (
                                    <span className="formula-text">NAK = (NT×10%) + (NP×20%) + (UTS×20%) + (UAS×50%)</span>
                                ) : (
                                    <span className="formula-text">NAK = (NT×10%) + (UTS×30%) + (UAS×60%)</span>
                                )}
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

    // Import/Export refs and handlers
    const fileInputRef = useRef(null)

    const handleExport = () => {
        const headers = [
            { key: 'kode', label: 'Kode' },
            { key: 'nama', label: 'Nama Mata Kuliah' },
            { key: 'semester', label: 'Semester' },
            { key: 'sks_teori', label: 'SKS Teori' },
            { key: 'sks_praktek', label: 'SKS Praktek' },
            { key: 'total_sks', label: 'Total SKS' },
            { key: 'prodi_kode', label: 'Kode Prodi' }
        ]

        const exportData = filteredMatkul.map(m => {
            const sksTeori = m.sks_teori || m.sks || 0
            const sksPraktek = m.sks_praktek || 0
            return {
                kode: m.kode,
                nama: m.nama,
                semester: m.semester || 1,
                sks_teori: sksTeori,
                sks_praktek: sksPraktek,
                total_sks: sksTeori + sksPraktek,
                prodi_kode: getProdiInfo(m).kode
            }
        })

        exportToXLSX(exportData, headers, 'mata_kuliah_export', 'Mata Kuliah')
    }

    const handleDownloadTemplate = () => {
        const headers = ['Kode', 'Nama Mata Kuliah', 'Semester', 'SKS Teori', 'SKS Praktek', 'Kode Prodi']
        const samples = [
            ['TI101', 'Algoritma dan Pemrograman', 1, 2, 1, 'PK'],
            ['TI102', 'Basis Data', 2, 3, 0, 'MD']
        ]
        downloadTemplate(headers, samples, 'template_mata_kuliah')
    }

    const handleImportClick = () => {
        fileInputRef.current?.click()
    }

    const handleImportFile = (e) => {
        const file = e.target.files[0]
        if (!file) return

        if (!isValidSpreadsheetFile(file.name)) {
            alert('Format file tidak didukung. Gunakan file .xlsx, .xls, atau .csv')
            e.target.value = ''
            return
        }

        importFromFile(file, async ({ headers, rows, error }) => {
            if (error) {
                alert(error)
                e.target.value = ''
                return
            }

            if (rows.length === 0) {
                alert('File kosong atau format salah')
                e.target.value = ''
                return
            }

            let savedCount = 0
            let errors = []

            for (const row of rows) {
                try {
                    // Find prodi by kode
                    const prodiKode = String(row['Kode Prodi'] || row['kode_prodi'] || '').toUpperCase().trim()
                    const prodi = prodiList.find(p =>
                        p.kode?.toUpperCase() === prodiKode ||
                        p.nama?.toUpperCase().includes(prodiKode)
                    )

                    if (!prodi) {
                        errors.push(`${row['Kode'] || row['kode']}: Prodi '${prodiKode}' tidak ditemukan`)
                        continue
                    }

                    const matkulData = {
                        kode: String(row['Kode'] || row['kode'] || '').toUpperCase().trim(),
                        nama: String(row['Nama Mata Kuliah'] || row['nama'] || '').trim(),
                        semester: Number(row['Semester'] || row['semester'] || 1),
                        sks_teori: Number(row['SKS Teori'] || row['sks_teori'] || 2),
                        sks_praktek: Number(row['SKS Praktek'] || row['sks_praktek'] || 0),
                        prodi_id: prodi.id
                    }
                    matkulData.sks = matkulData.sks_teori + matkulData.sks_praktek

                    if (!matkulData.kode || !matkulData.nama) {
                        errors.push(`Row: Kode atau Nama kosong`)
                        continue
                    }

                    if (useSupabase) {
                        await matkulService.create(matkulData)
                    }
                    savedCount++
                } catch (err) {
                    errors.push(`${row['Kode'] || 'Unknown'}: ${err.message}`)
                }
            }

            await loadData()

            if (errors.length > 0) {
                alert(`Berhasil import ${savedCount} dari ${rows.length} mata kuliah.\n\nGagal:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...dan ${errors.length - 5} lainnya` : ''}`)
            } else {
                alert(`Berhasil import ${savedCount} mata kuliah!`)
            }

            e.target.value = ''
        })
    }

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
                        <button className="btn btn-outline" onClick={handleDownloadTemplate} title="Download Template">
                            <FileSpreadsheet size={18} />
                        </button>
                        <button className="btn btn-outline" onClick={handleImportClick} title="Import Excel">
                            <Upload size={18} />
                        </button>
                        <button className="btn btn-outline" onClick={handleExport} title="Export Excel">
                            <Download size={18} />
                        </button>
                        <button className="btn btn-primary" onClick={handleAddMatkul}>
                            <Plus size={18} />
                            Tambah
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleImportFile}
                            style={{ display: 'none' }}
                        />
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
                                            <th style={{ width: '60px' }} className="text-center">Smt</th>
                                            <th style={{ width: '60px' }} className="text-center">Teori</th>
                                            <th style={{ width: '60px' }} className="text-center">Praktek</th>
                                            <th style={{ width: '60px' }} className="text-center">Total</th>
                                            <th style={{ width: '100px' }}>Prodi</th>
                                            <th style={{ width: '100px' }}>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredMatkul.map(matkul => {
                                            const prodi = getProdiInfo(matkul)
                                            const sksTeori = matkul.sks_teori || matkul.sks || 0
                                            const sksPraktek = matkul.sks_praktek || 0
                                            const totalSKS = sksTeori + sksPraktek
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
                                                        <span className="badge badge-info">{matkul.semester || 1}</span>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className="sks-badge sks-teori">{sksTeori}</span>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className={`sks-badge ${sksPraktek > 0 ? 'sks-praktek' : 'sks-zero'}`}>{sksPraktek}</span>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className="sks-badge">{totalSKS}</span>
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
        
        .sks-teori {
          background: var(--primary-100);
          color: var(--primary-700);
        }
        
        .sks-praktek {
          background: var(--success-100);
          color: var(--success-700);
        }
        
        .sks-zero {
          background: var(--neutral-100);
          color: var(--neutral-400);
        }
        
        .sks-summary {
          background: var(--neutral-50);
          border: 1px solid var(--neutral-200);
          border-radius: var(--radius-md);
          padding: var(--space-3);
          margin-top: var(--space-3);
        }
        
        .sks-total {
          margin-bottom: var(--space-2);
        }
        
        .formula-preview {
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
        }
        
        .formula-text {
          font-family: monospace;
          color: var(--primary-600);
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
