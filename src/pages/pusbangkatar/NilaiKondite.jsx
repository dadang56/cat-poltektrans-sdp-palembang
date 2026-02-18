import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { userService, prodiService, kelasService, isSupabaseConfigured } from '../../services/supabaseService'
import { exportToXLSX, importFromFile, downloadTemplate, isValidSpreadsheetFile } from '../../utils/excelUtils'
import {
    Search, Save, Filter, CheckCircle, AlertCircle, RefreshCw,
    Download, Upload, FileSpreadsheet, Users, BarChart3, X
} from 'lucide-react'
import '../admin/Dashboard.css'

function NilaiKondite() {
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
    const [importResult, setImportResult] = useState(null)
    const fileInputRef = useRef(null)

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

    const filteredMahasiswa = mahasiswaList.filter(m => {
        const matchesProdi = prodiFilter === 'all' || String(m.prodi_id) === String(prodiFilter)
        const matchesKelas = kelasFilter === 'all' || String(m.kelas_id) === String(kelasFilter)
        const matchesSearch = (m.nama || '').toLowerCase().includes(search.toLowerCase()) ||
            (m.nim_nip || '').includes(search)
        return matchesProdi && matchesKelas && matchesSearch
    })

    const getProdiName = (prodiId) => {
        const prodi = prodiList.find(p => String(p.id) === String(prodiId))
        return prodi?.nama || '-'
    }
    const getKelasName = (kelasId) => {
        const kelas = kelasList.find(k => String(k.id) === String(kelasId))
        return kelas?.nama || '-'
    }

    const handleNilaiChange = (mahasiswaId, value) => {
        const numValue = parseFloat(value)
        if (value === '' || (numValue >= 0 && numValue <= 4)) {
            setEditedValues(prev => ({ ...prev, [mahasiswaId]: value }))
        }
    }

    const getCurrentNilai = (mahasiswa) => {
        if (editedValues.hasOwnProperty(mahasiswa.id)) return editedValues[mahasiswa.id]
        return mahasiswa.nilai_kondite !== null && mahasiswa.nilai_kondite !== undefined ? mahasiswa.nilai_kondite : ''
    }

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
                await userService.update(id, { nilai_kondite: numValue })
            }
            setMahasiswaList(prev => prev.map(m => {
                if (editedValues.hasOwnProperty(m.id)) {
                    return { ...m, nilai_kondite: editedValues[m.id] === '' ? null : parseFloat(editedValues[m.id]) }
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
            setTimeout(() => setSaveStatus(null), 4000)
        }
    }

    // Export
    const handleExport = () => {
        const data = filteredMahasiswa.map((m, idx) => ({
            no: idx + 1,
            nim: m.nim_nip || '',
            nama: m.nama || '',
            prodi: getProdiName(m.prodi_id),
            kelas: getKelasName(m.kelas_id),
            nilai_kondite: getCurrentNilai(m) !== '' ? getCurrentNilai(m) : ''
        }))
        const headers = [
            { key: 'no', label: 'No' },
            { key: 'nim', label: 'NIM' },
            { key: 'nama', label: 'Nama' },
            { key: 'prodi', label: 'Prodi' },
            { key: 'kelas', label: 'Kelas' },
            { key: 'nilai_kondite', label: 'Nilai Kondite' }
        ]
        exportToXLSX(data, headers, 'Nilai_Kondite', 'Nilai Kondite')
    }

    // Download template
    const handleDownloadTemplate = () => {
        downloadTemplate(
            ['NIM', 'Nilai Kondite'],
            [['2502001', '3.50'], ['2502002', '3.75']],
            'Template_Import_Nilai_Kondite',
            [['# Petunjuk: Isi NIM dan Nilai Kondite (0-4). Baris ini akan diabaikan saat import.']]
        )
    }

    // Import
    const handleImport = (e) => {
        const file = e.target.files[0]
        if (!file) return
        if (!isValidSpreadsheetFile(file.name)) {
            setImportResult({ type: 'error', message: 'Format file tidak valid. Gunakan .xlsx, .xls, atau .csv' })
            setTimeout(() => setImportResult(null), 4000)
            return
        }
        importFromFile(file, async ({ headers, rows, error }) => {
            if (error) {
                setImportResult({ type: 'error', message: error })
                setTimeout(() => setImportResult(null), 4000)
                return
            }
            // Match by NIM
            let matched = 0, skipped = 0
            const nimKey = headers.find(h => h.includes('nim')) || headers[0]
            const nilaiKey = headers.find(h => h.includes('nilai') || h.includes('kondite')) || headers[1]

            const updates = {}
            rows.forEach(row => {
                const nim = String(row[nimKey] || '').trim()
                const nilai = parseFloat(row[nilaiKey])
                if (!nim || isNaN(nilai) || nilai < 0 || nilai > 4) { skipped++; return }
                const mhs = mahasiswaList.find(m => String(m.nim_nip).trim() === nim)
                if (mhs) { updates[mhs.id] = String(nilai); matched++ }
                else skipped++
            })

            setEditedValues(prev => ({ ...prev, ...updates }))
            setImportResult({
                type: matched > 0 ? 'success' : 'warning',
                message: `${matched} data berhasil dimuat, ${skipped} dilewati. Klik "Simpan Semua" untuk menyimpan.`
            })
            setTimeout(() => setImportResult(null), 6000)
        })
        e.target.value = ''
    }

    const hasChanges = Object.keys(editedValues).length > 0

    // Stats
    const totalMhs = filteredMahasiswa.length
    const sudahDinilai = filteredMahasiswa.filter(m => {
        const v = getCurrentNilai(m)
        return v !== '' && v !== null && v !== undefined
    }).length
    const belumDinilai = totalMhs - sudahDinilai
    const rataRata = sudahDinilai > 0
        ? (filteredMahasiswa.reduce((sum, m) => {
            const v = getCurrentNilai(m)
            return v !== '' && v !== null ? sum + parseFloat(v) : sum
        }, 0) / sudahDinilai).toFixed(2)
        : '-'

    return (
        <DashboardLayout>
            <div className="nk-page animate-fadeIn">
                {/* Header */}
                <div className="nk-header">
                    <div>
                        <h1 className="nk-title">📋 Nilai Kondite</h1>
                        <p className="nk-subtitle">Input dan kelola nilai kondite mahasiswa (skala 0-4)</p>
                    </div>
                    <div className="nk-header-actions">
                        <div className="nk-dropdown-group">
                            <button className="nk-btn nk-btn-outline" onClick={() => fileInputRef.current?.click()}>
                                <Upload size={16} /> Import Excel
                            </button>
                            <button className="nk-btn nk-btn-outline" onClick={handleExport}>
                                <Download size={16} /> Export Excel
                            </button>
                            <button className="nk-btn nk-btn-ghost" onClick={handleDownloadTemplate} title="Download template import">
                                <FileSpreadsheet size={16} /> Template
                            </button>
                        </div>
                        <button
                            className={`nk-btn nk-btn-primary ${saving ? 'nk-loading' : ''}`}
                            onClick={handleSaveAll}
                            disabled={saving || !hasChanges}
                        >
                            {saving ? <RefreshCw size={16} className="nk-spin" /> : <Save size={16} />}
                            {saving ? 'Menyimpan...' : `Simpan${hasChanges ? ` (${Object.keys(editedValues).length})` : ''}`}
                        </button>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} hidden />
                </div>

                {/* Status alerts */}
                {saveStatus && (
                    <div className={`nk-alert nk-alert-${saveStatus.type}`}>
                        {saveStatus.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                        <span>{saveStatus.message}</span>
                        <button className="nk-alert-close" onClick={() => setSaveStatus(null)}><X size={14} /></button>
                    </div>
                )}
                {importResult && (
                    <div className={`nk-alert nk-alert-${importResult.type}`}>
                        <FileSpreadsheet size={16} />
                        <span>{importResult.message}</span>
                        <button className="nk-alert-close" onClick={() => setImportResult(null)}><X size={14} /></button>
                    </div>
                )}

                {/* Stats bar */}
                <div className="nk-stats-bar">
                    <div className="nk-stat-item">
                        <Users size={18} />
                        <div><span className="nk-stat-val">{totalMhs}</span><span className="nk-stat-label">Total</span></div>
                    </div>
                    <div className="nk-stat-item nk-stat-success">
                        <CheckCircle size={18} />
                        <div><span className="nk-stat-val">{sudahDinilai}</span><span className="nk-stat-label">Sudah Dinilai</span></div>
                    </div>
                    <div className="nk-stat-item nk-stat-warning">
                        <AlertCircle size={18} />
                        <div><span className="nk-stat-val">{belumDinilai}</span><span className="nk-stat-label">Belum Dinilai</span></div>
                    </div>
                    <div className="nk-stat-item nk-stat-info">
                        <BarChart3 size={18} />
                        <div><span className="nk-stat-val">{rataRata}</span><span className="nk-stat-label">Rata-rata</span></div>
                    </div>
                    {/* Progress bar */}
                    <div className="nk-progress-wrap">
                        <div className="nk-progress-bar">
                            <div className="nk-progress-fill" style={{ width: totalMhs > 0 ? `${(sudahDinilai / totalMhs) * 100}%` : '0%' }} />
                        </div>
                        <span className="nk-progress-text">{totalMhs > 0 ? Math.round((sudahDinilai / totalMhs) * 100) : 0}%</span>
                    </div>
                </div>

                {/* Filters */}
                <div className="nk-filters">
                    <div className="nk-search">
                        <Search size={16} />
                        <input type="text" placeholder="Cari nama atau NIM..." value={search} onChange={e => setSearch(e.target.value)} />
                        {search && <button className="nk-search-clear" onClick={() => setSearch('')}><X size={14} /></button>}
                    </div>
                    <div className="nk-filter-selects">
                        <Filter size={16} className="nk-filter-icon" />
                        <select value={prodiFilter} onChange={e => setProdiFilter(e.target.value)}>
                            <option value="all">Semua Prodi</option>
                            {prodiList.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
                        </select>
                        <select value={kelasFilter} onChange={e => setKelasFilter(e.target.value)}>
                            <option value="all">Semua Kelas</option>
                            {kelasList.filter(k => prodiFilter === 'all' || String(k.prodi_id) === String(prodiFilter))
                                .map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="nk-table-card">
                    <div className="nk-table-scroll">
                        <table className="nk-table">
                            <thead>
                                <tr>
                                    <th className="nk-th-no">No</th>
                                    <th className="nk-th-nim">NIM</th>
                                    <th>Nama Mahasiswa</th>
                                    <th>Prodi</th>
                                    <th>Kelas</th>
                                    <th className="nk-th-status">Status</th>
                                    <th className="nk-th-nilai">Nilai Kondite</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="7" className="nk-td-center">
                                        <div className="nk-loading-dots"><span /><span /><span /></div>
                                        Memuat data...
                                    </td></tr>
                                ) : filteredMahasiswa.length === 0 ? (
                                    <tr><td colSpan="7" className="nk-td-center nk-td-empty">
                                        <Users size={32} />
                                        <span>Tidak ada data mahasiswa</span>
                                    </td></tr>
                                ) : (
                                    filteredMahasiswa.map((m, idx) => {
                                        const val = getCurrentNilai(m)
                                        const isEdited = editedValues.hasOwnProperty(m.id)
                                        const isFilled = val !== '' && val !== null && val !== undefined
                                        return (
                                            <tr key={m.id} className={isEdited ? 'nk-row-edited' : ''}>
                                                <td className="nk-td-no">{idx + 1}</td>
                                                <td className="nk-td-nim">{m.nim_nip}</td>
                                                <td className="nk-td-nama">{m.nama}</td>
                                                <td className="nk-td-prodi">{getProdiName(m.prodi_id)}</td>
                                                <td className="nk-td-kelas">{getKelasName(m.kelas_id)}</td>
                                                <td className="nk-td-status">
                                                    {isFilled
                                                        ? <span className="nk-badge nk-badge-success">✓ Sudah</span>
                                                        : <span className="nk-badge nk-badge-muted">— Belum</span>
                                                    }
                                                </td>
                                                <td className="nk-td-nilai">
                                                    <input
                                                        type="number" min="0" max="4" step="0.01"
                                                        className={`nk-input-nilai ${isEdited ? 'nk-input-edited' : isFilled ? 'nk-input-filled' : ''}`}
                                                        value={val}
                                                        onChange={e => handleNilaiChange(m.id, e.target.value)}
                                                        placeholder="0-4"
                                                    />
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!loading && filteredMahasiswa.length > 0 && (
                        <div className="nk-table-footer">
                            Menampilkan {filteredMahasiswa.length} dari {mahasiswaList.length} mahasiswa
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .nk-page { max-width: 1200px; margin: 0 auto; }
                .nk-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }
                .nk-title { font-size: 1.5rem; font-weight: 700; color: var(--color-text); margin: 0; }
                .nk-subtitle { font-size: 0.875rem; color: var(--text-muted, #6b7280); margin: 0.25rem 0 0; }
                .nk-header-actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
                .nk-dropdown-group { display: flex; gap: 0.375rem; }

                /* Buttons */
                .nk-btn { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 0.8125rem; font-weight: 600; border: none; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
                .nk-btn-primary { background: var(--color-primary, #2563eb); color: white; }
                .nk-btn-primary:hover:not(:disabled) { background: var(--color-primary-dark, #1d4ed8); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
                .nk-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
                .nk-btn-outline { background: var(--color-surface, white); color: var(--color-text); border: 1px solid var(--color-border, #e5e7eb); }
                .nk-btn-outline:hover { border-color: var(--color-primary, #2563eb); color: var(--color-primary); background: var(--color-primary-alpha, rgba(37,99,235,0.05)); }
                .nk-btn-ghost { background: transparent; color: var(--text-muted, #6b7280); }
                .nk-btn-ghost:hover { color: var(--color-primary); background: var(--color-primary-alpha, rgba(37,99,235,0.05)); }
                .nk-loading { pointer-events: none; }
                .nk-spin { animation: nkspin 1s linear infinite; }
                @keyframes nkspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                /* Alerts */
                .nk-alert { display: flex; align-items: center; gap: 0.5rem; padding: 0.625rem 1rem; border-radius: 0.5rem; margin-bottom: 0.75rem; font-size: 0.8125rem; font-weight: 500; animation: nkslideIn 0.3s ease; }
                .nk-alert-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
                .nk-alert-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
                .nk-alert-warning { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
                .nk-alert-info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
                .nk-alert span { flex: 1; }
                .nk-alert-close { background: none; border: none; cursor: pointer; opacity: 0.5; padding: 2px; border-radius: 4px; display: flex; color: inherit; }
                .nk-alert-close:hover { opacity: 1; background: rgba(0,0,0,0.1); }
                @keyframes nkslideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

                /* Stats bar */
                .nk-stats-bar { display: flex; align-items: center; gap: 1.25rem; padding: 0.875rem 1.25rem; background: var(--color-surface, white); border: 1px solid var(--color-border, #e5e7eb); border-radius: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
                .nk-stat-item { display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted, #6b7280); }
                .nk-stat-item > div { display: flex; flex-direction: column; line-height: 1.2; }
                .nk-stat-val { font-size: 1.125rem; font-weight: 700; color: var(--color-text); }
                .nk-stat-label { font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted, #6b7280); }
                .nk-stat-success svg { color: #059669; }
                .nk-stat-success .nk-stat-val { color: #059669; }
                .nk-stat-warning svg { color: #d97706; }
                .nk-stat-warning .nk-stat-val { color: #d97706; }
                .nk-stat-info svg { color: #2563eb; }
                .nk-stat-info .nk-stat-val { color: #2563eb; }
                .nk-progress-wrap { display: flex; align-items: center; gap: 0.5rem; margin-left: auto; min-width: 120px; }
                .nk-progress-bar { flex: 1; height: 6px; background: var(--color-border, #e5e7eb); border-radius: 3px; overflow: hidden; }
                .nk-progress-fill { height: 100%; background: linear-gradient(90deg, #2563eb, #06b6d4); border-radius: 3px; transition: width 0.5s ease; }
                .nk-progress-text { font-size: 0.75rem; font-weight: 700; color: var(--color-primary, #2563eb); min-width: 32px; }

                /* Filters */
                .nk-filters { display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
                .nk-search { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: var(--color-surface, white); border: 1px solid var(--color-border, #e5e7eb); border-radius: 0.5rem; flex: 1; min-width: 200px; transition: border-color 0.2s; }
                .nk-search:focus-within { border-color: var(--color-primary, #2563eb); box-shadow: 0 0 0 3px var(--color-primary-alpha, rgba(37,99,235,0.1)); }
                .nk-search input { border: none; background: transparent; flex: 1; outline: none; font-size: 0.8125rem; color: var(--color-text); }
                .nk-search svg { color: var(--text-muted, #9ca3af); flex-shrink: 0; }
                .nk-search-clear { background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 2px; border-radius: 50%; display: flex; }
                .nk-search-clear:hover { background: var(--color-border); }
                .nk-filter-selects { display: flex; align-items: center; gap: 0.5rem; }
                .nk-filter-icon { color: var(--text-muted, #9ca3af); flex-shrink: 0; }
                .nk-filter-selects select { padding: 0.5rem 0.75rem; border: 1px solid var(--color-border, #e5e7eb); border-radius: 0.5rem; background: var(--color-surface, white); font-size: 0.8125rem; color: var(--color-text); cursor: pointer; }

                /* Table */
                .nk-table-card { background: var(--color-surface, white); border: 1px solid var(--color-border, #e5e7eb); border-radius: 0.75rem; overflow: hidden; }
                .nk-table-scroll { overflow-x: auto; }
                .nk-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
                .nk-table thead { background: linear-gradient(135deg, #f8fafc, #f1f5f9); position: sticky; top: 0; z-index: 1; }
                .nk-table th { padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: var(--text-muted, #6b7280); text-transform: uppercase; font-size: 0.6875rem; letter-spacing: 0.05em; border-bottom: 2px solid var(--color-border, #e5e7eb); white-space: nowrap; }
                .nk-table td { padding: 0.625rem 1rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
                .nk-table tbody tr { transition: background 0.15s; }
                .nk-table tbody tr:hover { background: #f8fafc; }
                .nk-table tbody tr:nth-child(even) { background: #fafbfc; }
                .nk-table tbody tr:nth-child(even):hover { background: #f1f5f9; }
                .nk-row-edited { background: #fffbeb !important; }
                .nk-row-edited:hover { background: #fef3c7 !important; }

                .nk-th-no { width: 50px; text-align: center; }
                .nk-th-nim { width: 100px; }
                .nk-th-status { width: 100px; text-align: center; }
                .nk-th-nilai { width: 130px; text-align: center; }
                .nk-td-no { text-align: center; color: var(--text-muted); font-weight: 500; }
                .nk-td-nim { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.8rem; color: var(--color-primary, #2563eb); font-weight: 600; }
                .nk-td-nama { font-weight: 600; color: var(--color-text); }
                .nk-td-prodi { font-size: 0.75rem; color: var(--text-muted); }
                .nk-td-kelas { font-weight: 500; }
                .nk-td-status { text-align: center; }
                .nk-td-nilai { text-align: center; }
                .nk-td-center { text-align: center; padding: 2.5rem 1rem !important; color: var(--text-muted); }
                .nk-td-empty { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; justify-content: center; }

                /* Badges */
                .nk-badge { display: inline-flex; align-items: center; padding: 0.2rem 0.5rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; }
                .nk-badge-success { background: #ecfdf5; color: #059669; }
                .nk-badge-muted { background: #f3f4f6; color: #9ca3af; }

                /* Input nilai */
                .nk-input-nilai { width: 80px; text-align: center; padding: 0.375rem 0.5rem; border: 1.5px solid var(--color-border, #e5e7eb); border-radius: 0.375rem; font-size: 0.8125rem; font-weight: 600; background: white; transition: all 0.2s; color: var(--color-text); }
                .nk-input-nilai:focus { border-color: var(--color-primary, #2563eb); box-shadow: 0 0 0 3px var(--color-primary-alpha, rgba(37,99,235,0.15)); outline: none; }
                .nk-input-filled { border-color: #a7f3d0; background: #f0fdf4; }
                .nk-input-edited { border-color: #fbbf24; background: #fffbeb; }
                .nk-input-nilai::-webkit-inner-spin-button { opacity: 0; }
                .nk-input-nilai:hover::-webkit-inner-spin-button { opacity: 1; }

                /* Loading dots */
                .nk-loading-dots { display: inline-flex; gap: 4px; margin-right: 8px; }
                .nk-loading-dots span { width: 6px; height: 6px; border-radius: 50%; background: var(--color-primary, #2563eb); animation: nkbounce 1.4s infinite ease-in-out; }
                .nk-loading-dots span:nth-child(1) { animation-delay: -0.32s; }
                .nk-loading-dots span:nth-child(2) { animation-delay: -0.16s; }
                @keyframes nkbounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }

                /* Table footer */
                .nk-table-footer { padding: 0.625rem 1rem; font-size: 0.75rem; color: var(--text-muted, #9ca3af); border-top: 1px solid var(--color-border, #e5e7eb); background: #fafbfc; }

                /* Mobile */
                @media (max-width: 768px) {
                    .nk-header { flex-direction: column; }
                    .nk-header-actions { width: 100%; }
                    .nk-dropdown-group { width: 100%; }
                    .nk-dropdown-group .nk-btn { flex: 1; justify-content: center; font-size: 0.75rem; padding: 0.5rem; }
                    .nk-stats-bar { flex-direction: column; gap: 0.75rem; align-items: flex-start; }
                    .nk-progress-wrap { width: 100%; margin-left: 0; }
                    .nk-filter-selects { flex-wrap: wrap; }
                }
            `}</style>
        </DashboardLayout>
    )
}

export default NilaiKondite
