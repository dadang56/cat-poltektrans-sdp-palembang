import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useConfirm } from '../../components/ConfirmDialog'
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
    Printer
} from 'lucide-react'
import '../admin/Dashboard.css'

// LocalStorage keys
const STORAGE_KEY = 'cat_jadwal_data'
const MATKUL_STORAGE_KEY = 'cat_matkul_data'
const PRODI_STORAGE_KEY = 'cat_prodi_data'
const KELAS_STORAGE_KEY = 'cat_kelas_data'

function JadwalModal({ isOpen, onClose, jadwal, onSave, matkulList = [], kelasList = [] }) {
    const getDefaultFormData = () => ({
        matkulId: matkulList[0]?.id || '',
        kelasId: kelasList[0]?.id || '',
        tipeUjian: 'UTS',
        tanggal: '',
        waktuMulai: '08:00',
        waktuSelesai: '10:00',
        deadlineKoreksi: '' // Default empty, will be set automatically
    })

    const [formData, setFormData] = useState(jadwal || getDefaultFormData())

    // Update formData when jadwal changes (for edit mode)
    useEffect(() => {
        if (isOpen) {
            if (jadwal) {
                setFormData({
                    ...jadwal,
                    matkulId: jadwal.matkulId || matkulList[0]?.id || '',
                    kelasId: jadwal.kelasId || kelasList[0]?.id || ''
                })
            } else {
                setFormData(getDefaultFormData())
            }
        }
    }, [jadwal, isOpen, matkulList, kelasList])

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave({
            ...formData,
            matkulId: Number(formData.matkulId),
            kelasId: Number(formData.kelasId)
        })
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{jadwal ? 'Edit Jadwal Ujian' : 'Tambah Jadwal Ujian'}</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Mata Kuliah</label>
                                <select
                                    className="form-input"
                                    value={formData.matkulId}
                                    onChange={e => setFormData({ ...formData, matkulId: e.target.value })}
                                    required
                                >
                                    {matkulList.map(m => (
                                        <option key={m.id} value={m.id}>{m.kode} - {m.nama}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Kelas</label>
                                <select
                                    className="form-input"
                                    value={formData.kelasId}
                                    onChange={e => setFormData({ ...formData, kelasId: e.target.value })}
                                    required
                                >
                                    {kelasList.map(k => (
                                        <option key={k.id} value={k.id}>{k.nama} ({k.angkatan})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Tipe Ujian</label>
                                <select
                                    className="form-input"
                                    value={formData.tipeUjian}
                                    onChange={e => setFormData({ ...formData, tipeUjian: e.target.value })}
                                    required
                                >
                                    <option value="UTS">UTS</option>
                                    <option value="UAS">UAS</option>
                                </select>
                            </div>
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
                                    value={formData.waktuMulai}
                                    onChange={e => setFormData({ ...formData, waktuMulai: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Waktu Selesai</label>
                                <input
                                    type="time"
                                    className="form-input"
                                    value={formData.waktuSelesai}
                                    onChange={e => setFormData({ ...formData, waktuSelesai: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Deadline Koreksi</label>
                            <input
                                type="date"
                                className="form-input"
                                value={formData.deadlineKoreksi || ''}
                                onChange={e => setFormData({ ...formData, deadlineKoreksi: e.target.value })}
                                min={formData.tanggal}
                                placeholder="Deadline koreksi untuk dosen"
                            />
                            <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Batas waktu dosen menyelesaikan koreksi</small>
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

function JadwalUjianPage() {
    const { user } = useAuth()
    const { showConfirm } = useConfirm()

    // Load from localStorage
    const [jadwalList, setJadwalList] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        return saved ? JSON.parse(saved) : []
    })
    const [matkulList, setMatkulList] = useState(() => {
        const saved = localStorage.getItem(MATKUL_STORAGE_KEY)
        return saved ? JSON.parse(saved) : []
    })
    const [prodiList, setProdiList] = useState(() => {
        const saved = localStorage.getItem(PRODI_STORAGE_KEY)
        return saved ? JSON.parse(saved) : []
    })
    const [kelasList, setKelasList] = useState(() => {
        const saved = localStorage.getItem(KELAS_STORAGE_KEY)
        return saved ? JSON.parse(saved) : []
    })

    const [modalOpen, setModalOpen] = useState(false)
    const [editingJadwal, setEditingJadwal] = useState(null)
    const [dateFilter, setDateFilter] = useState('')
    const [prodiFilter, setProdiFilter] = useState(user?.role === 'superadmin' ? 'all' : (user?.prodiId || 'all'))

    // Save to localStorage whenever jadwalList changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(jadwalList))
    }, [jadwalList])

    // Reload dependent lists when window regains focus
    useEffect(() => {
        const handleFocus = () => {
            const matkul = localStorage.getItem(MATKUL_STORAGE_KEY)
            const prodi = localStorage.getItem(PRODI_STORAGE_KEY)
            const kelas = localStorage.getItem(KELAS_STORAGE_KEY)
            if (matkul) setMatkulList(JSON.parse(matkul))
            if (prodi) setProdiList(JSON.parse(prodi))
            if (kelas) setKelasList(JSON.parse(kelas))
        }
        window.addEventListener('focus', handleFocus)
        return () => window.removeEventListener('focus', handleFocus)
    }, [])

    const isSuperAdmin = user?.role === 'superadmin'

    // Filter hanya berdasarkan prodi (tanpa filter tanggal) untuk stats
    const prodiFilteredJadwal = jadwalList.filter(j => {
        return isSuperAdmin
            ? (prodiFilter === 'all' || j.prodiId === parseInt(prodiFilter))
            : j.prodiId === user?.prodiId
    })

    const filteredJadwal = prodiFilteredJadwal.filter(j => {
        return !dateFilter || j.tanggal === dateFilter
    }).sort((a, b) => {
        if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal)
        return a.waktuMulai.localeCompare(b.waktuMulai)
    })

    const handleAdd = () => {
        setEditingJadwal(null)
        setModalOpen(true)
    }

    const handleEdit = (jadwal) => {
        setEditingJadwal(jadwal)
        setModalOpen(true)
    }

    const handleSave = (data) => {
        // Tambahkan prodiId dari user yang login
        const jadwalData = {
            ...data,
            prodiId: user?.prodiId || 1
        }

        if (editingJadwal) {
            setJadwalList(jadwalList.map(j => j.id === editingJadwal.id ? { ...jadwalData, id: editingJadwal.id } : j))
        } else {
            setJadwalList([...jadwalList, { ...jadwalData, id: Date.now() }])
        }
    }

    const handleDelete = (id) => {
        showConfirm({
            title: 'Konfirmasi Hapus',
            message: 'Hapus jadwal ujian ini?',
            onConfirm: () => setJadwalList(jadwalList.filter(j => j.id !== id))
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
            if (k?.prodiId) {
                const p = prodiList.find(pr => pr.id === k.prodiId)
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
                                        <td>${j.waktuMulai} - ${j.waktuSelesai}</td>
                                        <td>${getMatkulName(j.matkulId)}</td>
                                        <td>${getKelasName(j.kelasId)}</td>
                                        <td>${j.tipeUjian}</td>
                                        <td>${j.ruang}</td>
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
                        <h1 className="page-title">Jadwal Ujian</h1>
                        <p className="page-subtitle">
                            {isSuperAdmin
                                ? 'Lihat jadwal ujian dari seluruh program studi'
                                : 'Kelola jadwal ujian untuk program studi Anda'}
                        </p>
                    </div>
                    <div className="header-actions">
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
                                                            <span>{j.waktuMulai} - {j.waktuSelesai}</span>
                                                        </div>
                                                    </td>
                                                    <td className="font-medium">{getMatkulName(j.matkulId)}</td>
                                                    <td>{getKelasName(j.kelasId)}</td>
                                                    {isSuperAdmin && (
                                                        <td>
                                                            <span className="badge badge-primary">{getProdiName(j.prodiId, j.kelasId)}</span>
                                                        </td>
                                                    )}
                                                    <td>
                                                        <span className={`badge badge-${getTipeBadge(j.tipeUjian)}`}>{j.tipeUjian}</span>
                                                    </td>
                                                    <td>
                                                        <div className="room-cell">
                                                            <MapPin size={14} />
                                                            {j.ruang}
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
                    matkulList={user?.role === 'superadmin' ? matkulList : matkulList.filter(m => m.prodiId === user?.prodiId)}
                    kelasList={user?.role === 'superadmin' ? kelasList : kelasList.filter(k => k.prodiId === user?.prodiId)}
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
