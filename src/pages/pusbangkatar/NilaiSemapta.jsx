import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { userService, prodiService, kelasService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    Search,
    Save,
    Filter,
    CheckCircle,
    AlertCircle,
    RefreshCw
} from 'lucide-react'
import '../admin/Dashboard.css'

function NilaiSemapta() {
    const { user } = useAuth()
    const [mahasiswaList, setMahasiswaList] = useState([])
    const [prodiList, setProdiList] = useState([])
    const [kelasList, setKelasList] = useState([])
    const [prodiFilter, setProdiFilter] = useState('all')
    const [kelasFilter, setKelasFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editedValues, setEditedValues] = useState({})
    const [saveStatus, setSaveStatus] = useState(null)

    // Load data
    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            try {
                if (isSupabaseConfigured()) {
                    const [mahasiswa, prodi, kelas] = await Promise.all([
                        userService.getByRole('mahasiswa'),
                        prodiService.getAll(),
                        kelasService.getAll()
                    ])
                    setMahasiswaList(mahasiswa || [])
                    setProdiList(prodi || [])
                    setKelasList(kelas || [])
                }
            } catch (error) {
                console.error('Error loading data:', error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    // Filter mahasiswa
    const filteredMahasiswa = mahasiswaList.filter(m => {
        const matchesProdi = prodiFilter === 'all' || String(m.prodi_id) === String(prodiFilter)
        const matchesKelas = kelasFilter === 'all' || String(m.kelas_id) === String(kelasFilter)
        const matchesSearch = (m.nama || '').toLowerCase().includes(search.toLowerCase()) ||
            (m.nim_nip || '').includes(search)
        return matchesProdi && matchesKelas && matchesSearch
    })

    // Get prodi and kelas names
    const getProdiName = (prodiId) => {
        const prodi = prodiList.find(p => String(p.id) === String(prodiId))
        return prodi?.nama || '-'
    }

    const getKelasName = (kelasId) => {
        const kelas = kelasList.find(k => String(k.id) === String(kelasId))
        return kelas?.nama || '-'
    }

    // Handle nilai change
    const handleNilaiChange = (mahasiswaId, value) => {
        // Validate value 0-4
        const numValue = parseFloat(value)
        if (value === '' || (numValue >= 0 && numValue <= 4)) {
            setEditedValues(prev => ({
                ...prev,
                [mahasiswaId]: value
            }))
        }
    }

    // Get current nilai (edited or original)
    const getCurrentNilai = (mahasiswa) => {
        if (editedValues.hasOwnProperty(mahasiswa.id)) {
            return editedValues[mahasiswa.id]
        }
        return mahasiswa.nilai_semapta !== null ? mahasiswa.nilai_semapta : ''
    }

    // Save all changes
    const handleSaveAll = async () => {
        const changedIds = Object.keys(editedValues)
        if (changedIds.length === 0) {
            setSaveStatus({ type: 'info', message: 'Tidak ada perubahan untuk disimpan' })
            setTimeout(() => setSaveStatus(null), 3000)
            return
        }

        setSaving(true)
        try {
            for (const id of changedIds) {
                const value = editedValues[id]
                const numValue = value === '' ? null : parseFloat(value)
                await userService.update(id, { nilai_semapta: numValue })
            }

            // Update local state
            setMahasiswaList(prev => prev.map(m => {
                if (editedValues.hasOwnProperty(m.id)) {
                    return { ...m, nilai_semapta: editedValues[m.id] === '' ? null : parseFloat(editedValues[m.id]) }
                }
                return m
            }))
            setEditedValues({})
            setSaveStatus({ type: 'success', message: `${changedIds.length} nilai berhasil disimpan` })
        } catch (error) {
            console.error('Error saving:', error)
            setSaveStatus({ type: 'error', message: 'Gagal menyimpan nilai' })
        } finally {
            setSaving(false)
            setTimeout(() => setSaveStatus(null), 3000)
        }
    }

    const hasChanges = Object.keys(editedValues).length > 0

    return (
        <DashboardLayout>
            <div className="nilai-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Nilai Kesamaptaan</h1>
                        <p className="page-subtitle">Input nilai kesamaptaan mahasiswa (skala 0-4)</p>
                    </div>
                    <button
                        className={`btn btn-primary ${saving ? 'loading' : ''}`}
                        onClick={handleSaveAll}
                        disabled={saving || !hasChanges}
                    >
                        {saving ? <RefreshCw size={18} className="spin" /> : <Save size={18} />}
                        {saving ? 'Menyimpan...' : 'Simpan Semua'}
                    </button>
                </div>

                {saveStatus && (
                    <div className={`alert alert-${saveStatus.type}`}>
                        {saveStatus.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                        {saveStatus.message}
                    </div>
                )}

                {/* Filters */}
                <div className="filters-bar">
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Cari nama atau NIM..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="filter-group">
                        <Filter size={18} />
                        <select value={prodiFilter} onChange={(e) => setProdiFilter(e.target.value)}>
                            <option value="all">Semua Prodi</option>
                            {prodiList.map(p => (
                                <option key={p.id} value={p.id}>{p.nama}</option>
                            ))}
                        </select>
                        <select value={kelasFilter} onChange={(e) => setKelasFilter(e.target.value)}>
                            <option value="all">Semua Kelas</option>
                            {kelasList.map(k => (
                                <option key={k.id} value={k.id}>{k.nama}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="card">
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>NIM</th>
                                    <th>Nama</th>
                                    <th>Prodi</th>
                                    <th>Kelas</th>
                                    <th style={{ width: '120px' }}>Nilai Semapta</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-4">Loading...</td>
                                    </tr>
                                ) : filteredMahasiswa.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-4">Tidak ada data</td>
                                    </tr>
                                ) : (
                                    filteredMahasiswa.map((m, idx) => (
                                        <tr key={m.id}>
                                            <td>{idx + 1}</td>
                                            <td>{m.nim_nip}</td>
                                            <td>{m.nama}</td>
                                            <td>{getProdiName(m.prodi_id)}</td>
                                            <td>{getKelasName(m.kelas_id)}</td>
                                            <td>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="4"
                                                    step="0.01"
                                                    className="form-input nilai-input"
                                                    value={getCurrentNilai(m)}
                                                    onChange={(e) => handleNilaiChange(m.id, e.target.value)}
                                                    placeholder="0-4"
                                                />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style>{`
                .nilai-page .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .filters-bar {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                    flex-wrap: wrap;
                }
                .search-box {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: 0.5rem;
                    flex: 1;
                    min-width: 200px;
                }
                .search-box input {
                    border: none;
                    background: transparent;
                    flex: 1;
                    outline: none;
                }
                .filter-group {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .filter-group select {
                    padding: 0.5rem 1rem;
                    border: 1px solid var(--color-border);
                    border-radius: 0.5rem;
                    background: var(--color-surface);
                }
                .nilai-input {
                    width: 80px;
                    text-align: center;
                    padding: 0.25rem 0.5rem;
                }
                .alert {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    border-radius: 0.5rem;
                    margin-bottom: 1rem;
                }
                .alert-success {
                    background: var(--color-success-alpha);
                    color: var(--color-success);
                }
                .alert-error {
                    background: var(--color-danger-alpha);
                    color: var(--color-danger);
                }
                .alert-info {
                    background: var(--color-info-alpha);
                    color: var(--color-info);
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

export default NilaiSemapta
