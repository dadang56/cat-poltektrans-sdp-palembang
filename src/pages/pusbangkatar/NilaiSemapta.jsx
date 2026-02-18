import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useSettings } from '../../contexts/SettingsContext'
import { userService, nilaiPusbangkatarService, isSupabaseConfigured } from '../../services/supabaseService'
import { exportToXLSX, downloadTemplate, importFromFile, isValidSpreadsheetFile } from '../../utils/excelUtils'
import {
    Users, CheckCircle, XCircle, TrendingUp,
    Download, Upload, FileSpreadsheet, Save,
    Search, Filter, Loader2, Calendar
} from 'lucide-react'
import '../admin/Dashboard.css'

const generateTAOptions = () => {
    const opts = []
    const year = new Date().getFullYear()
    for (let y = year + 1; y >= year - 2; y--) {
        opts.push(`${y}/${y + 1} Ganjil`)
        opts.push(`${y}/${y + 1} Genap`)
    }
    return opts
}
const TA_OPTIONS = generateTAOptions()

function NilaiSemapta() {
    const { user } = useAuth()
    const { settings } = useSettings()

    const [mahasiswaList, setMahasiswaList] = useState([])
    const [nilaiMap, setNilaiMap] = useState({})
    const [editedValues, setEditedValues] = useState({})
    const [prodiFilter, setProdiFilter] = useState('all')
    const [kelasFilter, setKelasFilter] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saveStatus, setSaveStatus] = useState(null)
    const [tahunAkademik, setTahunAkademik] = useState('')
    const fileInputRef = useRef(null)

    useEffect(() => {
        if (settings?.tahunAkademik) setTahunAkademik(settings.tahunAkademik)
        else if (TA_OPTIONS.length > 0) setTahunAkademik(TA_OPTIONS[0])
    }, [settings])

    useEffect(() => {
        if (!tahunAkademik) return
        loadData()
    }, [tahunAkademik])

    const loadData = async () => {
        setLoading(true)
        setEditedValues({})
        try {
            if (isSupabaseConfigured()) {
                const [mahasiswa, nilaiData] = await Promise.all([
                    userService.getByRole('mahasiswa'),
                    nilaiPusbangkatarService.getByTA(tahunAkademik)
                ])
                setMahasiswaList(mahasiswa || [])
                const map = {}
                nilaiData.forEach(n => { map[n.mahasiswa_id] = n.nilai_semapta })
                setNilaiMap(map)
            }
        } catch (error) {
            console.error('Error loading data:', error)
            setSaveStatus({ type: 'error', message: 'Gagal memuat data. Periksa koneksi.' })
            setTimeout(() => setSaveStatus(null), 4000)
        } finally {
            setLoading(false)
        }
    }

    const prodiList = [...new Map(mahasiswaList.filter(m => m.prodi).map(m => [m.prodi?.id, m.prodi])).values()]
    const kelasList = [...new Map(mahasiswaList.filter(m => m.kelas).map(m => [m.kelas?.id, m.kelas])).values()]

    const filteredMahasiswa = mahasiswaList.filter(m => {
        const matchProdi = prodiFilter === 'all' || m.prodi?.id === prodiFilter
        const matchKelas = kelasFilter === 'all' || m.kelas?.id === kelasFilter
        const matchSearch = !searchTerm ||
            (m.nama || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (m.nim_nip || '').toLowerCase().includes(searchTerm.toLowerCase())
        return matchProdi && matchKelas && matchSearch
    })

    const getCurrentNilai = (m) => {
        if (editedValues.hasOwnProperty(m.id)) return editedValues[m.id]
        return nilaiMap[m.id] !== undefined && nilaiMap[m.id] !== null ? nilaiMap[m.id] : ''
    }

    const handleChange = (id, value) => {
        if (value === '') {
            setEditedValues(prev => ({ ...prev, [id]: '' }))
            return
        }
        const num = parseFloat(value)
        if (!isNaN(num) && num >= 0 && num <= 4) {
            setEditedValues(prev => ({ ...prev, [id]: value }))
        }
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
                await nilaiPusbangkatarService.upsert(id, tahunAkademik, { nilai_semapta: numValue })
            }
            setNilaiMap(prev => {
                const updated = { ...prev }
                changedIds.forEach(id => {
                    updated[id] = editedValues[id] === '' ? null : parseFloat(editedValues[id])
                })
                return updated
            })
            setEditedValues({})
            setSaveStatus({ type: 'success', message: `${changedIds.length} nilai berhasil disimpan untuk ${tahunAkademik}` })
        } catch (error) {
            console.error('Error saving:', error)
            setSaveStatus({ type: 'error', message: 'Gagal menyimpan nilai: ' + error.message })
        } finally {
            setSaving(false)
            setTimeout(() => setSaveStatus(null), 4000)
        }
    }

    const handleExport = () => {
        const exportData = filteredMahasiswa.map((m, idx) => ({
            no: idx + 1,
            nim: m.nim_nip || '',
            nama: m.nama || '',
            prodi: m.prodi?.kode || '-',
            kelas: m.kelas?.nama || '-',
            nilai_semapta: getCurrentNilai(m)
        }))
        const headers = [
            { key: 'no', label: 'No' },
            { key: 'nim', label: 'NIM' },
            { key: 'nama', label: 'Nama' },
            { key: 'prodi', label: 'Prodi' },
            { key: 'kelas', label: 'Kelas' },
            { key: 'nilai_semapta', label: 'Nilai Semapta (0-4)' }
        ]
        exportToXLSX(exportData, headers, `nilai_semapta_${tahunAkademik.replace(/\//g, '-').replace(/ /g, '_')}`, 'Nilai Semapta')
    }

    const handleDownloadTemplate = () => {
        const templateHeaders = ['NIM', 'Nama', 'Nilai Semapta (0-4)']
        const sampleRows = filteredMahasiswa.slice(0, 3).map(m => [m.nim_nip || '', m.nama || '', ''])
        const infoRows = [
            [`# Tahun Akademik: ${tahunAkademik}`, '', ''],
            ['# Isi kolom "Nilai Semapta" dengan angka 0-4', '', '']
        ]
        downloadTemplate(templateHeaders, sampleRows, `template_semapta_${tahunAkademik.replace(/\//g, '-')}`, infoRows)
    }

    const handleImport = (e) => {
        const file = e.target.files[0]
        if (!file) return
        if (!isValidSpreadsheetFile(file.name)) {
            setSaveStatus({ type: 'error', message: 'Format file tidak didukung (.xlsx, .xls, .csv)' })
            e.target.value = ''
            return
        }
        importFromFile(file, ({ headers, rows, error }) => {
            if (error) {
                setSaveStatus({ type: 'error', message: error })
                e.target.value = ''
                return
            }
            let matched = 0
            const newEdits = { ...editedValues }
            rows.forEach(row => {
                const nim = String(row.nim || row.NIM || '').trim()
                const nilai = row['nilai semapta (0-4)'] || row['nilai_semapta'] || row['nilai semapta'] || row['nilai'] || ''
                if (!nim || nilai === '') return
                const mhs = mahasiswaList.find(m => (m.nim_nip || '').trim() === nim)
                if (mhs) {
                    const num = parseFloat(nilai)
                    if (!isNaN(num) && num >= 0 && num <= 4) {
                        newEdits[mhs.id] = String(num)
                        matched++
                    }
                }
            })
            setEditedValues(newEdits)
            setSaveStatus({ type: 'success', message: `${matched} dari ${rows.length} data berhasil dicocokkan. Klik Simpan untuk menyimpan.` })
            e.target.value = ''
            setTimeout(() => setSaveStatus(null), 5000)
        })
    }

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
            <div className="nk-container animate-fadeIn">
                <div className="nk-header">
                    <div>
                        <h1 className="nk-title">🏋️ Nilai Kesamaptaan</h1>
                        <p className="nk-subtitle">Input dan kelola nilai kesamaptaan mahasiswa (skala 0-4)</p>
                    </div>
                    <div className="nk-header-actions">
                        <button className="nk-btn nk-btn-outline" onClick={handleDownloadTemplate}><FileSpreadsheet size={16} /> Template</button>
                        <button className="nk-btn nk-btn-outline" onClick={() => fileInputRef.current?.click()}><Upload size={16} /> Import</button>
                        <button className="nk-btn nk-btn-outline" onClick={handleExport}><Download size={16} /> Export</button>
                        <button className="nk-btn nk-btn-primary" onClick={handleSaveAll} disabled={saving || Object.keys(editedValues).length === 0}>
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Simpan {Object.keys(editedValues).length > 0 && `(${Object.keys(editedValues).length})`}
                        </button>
                        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} hidden />
                    </div>
                </div>

                <div className="nk-ta-selector">
                    <Calendar size={16} />
                    <label>Tahun Akademik:</label>
                    <select value={tahunAkademik} onChange={e => setTahunAkademik(e.target.value)} className="nk-ta-select">
                        {TA_OPTIONS.map(ta => <option key={ta} value={ta}>{ta}</option>)}
                    </select>
                </div>

                {saveStatus && (
                    <div className={`nk-alert nk-alert-${saveStatus.type}`}>
                        {saveStatus.type === 'success' ? <CheckCircle size={16} /> : saveStatus.type === 'error' ? <XCircle size={16} /> : null}
                        {saveStatus.message}
                    </div>
                )}

                <div className="nk-stats-bar">
                    <div className="nk-stat-item"><Users size={18} /><div><span className="nk-stat-val">{totalMhs}</span><span className="nk-stat-label">Total</span></div></div>
                    <div className="nk-stat-item nk-stat-success"><CheckCircle size={18} /><div><span className="nk-stat-val">{sudahDinilai}</span><span className="nk-stat-label">Sudah</span></div></div>
                    <div className="nk-stat-item nk-stat-warning"><XCircle size={18} /><div><span className="nk-stat-val">{belumDinilai}</span><span className="nk-stat-label">Belum</span></div></div>
                    <div className="nk-stat-item nk-stat-info"><TrendingUp size={18} /><div><span className="nk-stat-val">{rataRata}</span><span className="nk-stat-label">Rata-rata</span></div></div>
                    <div className="nk-progress-wrap">
                        <div className="nk-progress-bar"><div className="nk-progress-fill" style={{ width: totalMhs > 0 ? `${(sudahDinilai / totalMhs) * 100}%` : '0%' }} /></div>
                        <span className="nk-progress-text">{totalMhs > 0 ? Math.round((sudahDinilai / totalMhs) * 100) : 0}%</span>
                    </div>
                </div>

                <div className="nk-filters">
                    <div className="nk-search-wrap">
                        <Search size={16} />
                        <input type="text" placeholder="Cari nama atau NIM..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="nk-search-input" />
                    </div>
                    <div className="nk-filter-group">
                        <Filter size={14} />
                        <select value={prodiFilter} onChange={e => setProdiFilter(e.target.value)} className="nk-filter-select">
                            <option value="all">Semua Prodi</option>
                            {prodiList.map(p => <option key={p.id} value={p.id}>{p.kode}</option>)}
                        </select>
                        <select value={kelasFilter} onChange={e => setKelasFilter(e.target.value)} className="nk-filter-select">
                            <option value="all">Semua Kelas</option>
                            {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="nk-loading"><Loader2 size={32} className="animate-spin" /><span>Memuat data {tahunAkademik}...</span></div>
                ) : filteredMahasiswa.length === 0 ? (
                    <div className="nk-empty"><Users size={40} /><p>Tidak ada data mahasiswa</p></div>
                ) : (
                    <div className="nk-table-wrap">
                        <table className="nk-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '50px' }}>No</th>
                                    <th style={{ width: '130px' }}>NIM</th>
                                    <th>Nama</th>
                                    <th style={{ width: '90px' }}>Prodi</th>
                                    <th style={{ width: '100px' }}>Kelas</th>
                                    <th style={{ width: '120px' }}>Nilai (0-4)</th>
                                    <th style={{ width: '80px' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMahasiswa.map((m, idx) => {
                                    const val = getCurrentNilai(m)
                                    const isEdited = editedValues.hasOwnProperty(m.id)
                                    const filled = val !== '' && val !== null && val !== undefined
                                    return (
                                        <tr key={m.id} className={isEdited ? 'nk-row-edited' : ''}>
                                            <td className="nk-td-center">{idx + 1}</td>
                                            <td className="nk-td-nim">{m.nim_nip || '-'}</td>
                                            <td className="nk-td-name">{m.nama}</td>
                                            <td className="nk-td-center">{m.prodi?.kode || '-'}</td>
                                            <td className="nk-td-center">{m.kelas?.nama || '-'}</td>
                                            <td>
                                                <input type="number" min="0" max="4" step="0.1"
                                                    value={val} onChange={e => handleChange(m.id, e.target.value)}
                                                    className={`nk-input ${isEdited ? 'nk-input-edited' : ''}`}
                                                    placeholder="0-4" />
                                            </td>
                                            <td className="nk-td-center">
                                                {filled
                                                    ? <span className="nk-badge nk-badge-success">✓ Sudah</span>
                                                    : <span className="nk-badge nk-badge-muted">— Belum</span>}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <style>{`
                .nk-container { max-width: 1100px; margin: 0 auto; }
                .nk-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 0.5rem; }
                .nk-title { font-size: 1.5rem; font-weight: 700; margin: 0; color: var(--color-text); }
                .nk-subtitle { font-size: 0.85rem; color: var(--text-muted); margin: 0.25rem 0 0; }
                .nk-header-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
                .nk-btn { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.5rem 0.875rem; border-radius: 0.5rem; font-size: 0.8125rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; }
                .nk-btn-outline { background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text); }
                .nk-btn-outline:hover { border-color: var(--color-primary); color: var(--color-primary); }
                .nk-btn-primary { background: var(--color-primary); color: white; }
                .nk-btn-primary:hover { opacity: 0.9; }
                .nk-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

                .nk-ta-selector { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.75rem; margin-bottom: 1rem; color: var(--color-text); }
                .nk-ta-selector label { font-size: 0.8125rem; font-weight: 600; white-space: nowrap; }
                .nk-ta-select { padding: 0.375rem 0.75rem; border: 1px solid var(--color-border); border-radius: 0.375rem; font-size: 0.8125rem; background: var(--color-bg); color: var(--color-text); min-width: 180px; }

                .nk-alert { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.8125rem; margin-bottom: 1rem; animation: nkSlideIn 0.3s ease; }
                .nk-alert-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
                .nk-alert-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
                .nk-alert-info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }

                .nk-stats-bar { display: flex; align-items: center; gap: 1.5rem; padding: 1rem 1.25rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
                .nk-stat-item { display: flex; align-items: center; gap: 0.5rem; color: var(--color-text); }
                .nk-stat-item svg { color: var(--color-primary); }
                .nk-stat-success svg { color: #059669; }
                .nk-stat-warning svg { color: #d97706; }
                .nk-stat-info svg { color: #6366f1; }
                .nk-stat-val { font-size: 1.25rem; font-weight: 800; display: block; line-height: 1; }
                .nk-stat-label { font-size: 0.6875rem; color: var(--text-muted); }
                .nk-progress-wrap { display: flex; align-items: center; gap: 0.5rem; margin-left: auto; }
                .nk-progress-bar { width: 120px; height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; }
                .nk-progress-fill { height: 100%; background: linear-gradient(90deg, #2563eb, #06b6d4); border-radius: 3px; transition: width 0.6s ease; }
                .nk-progress-text { font-size: 0.75rem; font-weight: 700; color: var(--color-primary); }

                .nk-filters { display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
                .nk-search-wrap { position: relative; flex: 1; min-width: 200px; }
                .nk-search-wrap svg { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
                .nk-search-input { width: 100%; padding: 0.5rem 0.75rem 0.5rem 2.25rem; border: 1px solid var(--color-border); border-radius: 0.5rem; font-size: 0.8125rem; background: var(--color-surface); color: var(--color-text); }
                .nk-filter-group { display: flex; gap: 0.5rem; align-items: center; }
                .nk-filter-group svg { color: var(--text-muted); }
                .nk-filter-select { padding: 0.5rem 0.75rem; border: 1px solid var(--color-border); border-radius: 0.5rem; font-size: 0.8125rem; background: var(--color-surface); color: var(--color-text); }

                .nk-table-wrap { overflow-x: auto; border: 1px solid var(--color-border); border-radius: 0.75rem; background: var(--color-surface); }
                .nk-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
                .nk-table thead { background: var(--color-bg); }
                .nk-table th { padding: 0.75rem 0.625rem; text-align: left; font-weight: 600; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.025em; border-bottom: 1px solid var(--color-border); }
                .nk-table td { padding: 0.5rem 0.625rem; border-bottom: 1px solid var(--color-border); color: var(--color-text); }
                .nk-table tbody tr:hover { background: rgba(59, 130, 246, 0.04); }
                .nk-table tbody tr:nth-child(even) { background: rgba(0,0,0,0.015); }
                .nk-row-edited { background: #fefce8 !important; }
                .nk-td-center { text-align: center; }
                .nk-td-nim { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.75rem; color: var(--color-primary); font-weight: 600; }
                .nk-td-name { font-weight: 500; }
                .nk-input { width: 80px; padding: 0.375rem 0.5rem; border: 1px solid var(--color-border); border-radius: 0.375rem; text-align: center; font-size: 0.8125rem; background: var(--color-surface); color: var(--color-text); }
                .nk-input:focus { border-color: var(--color-primary); outline: none; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
                .nk-input-edited { border-color: #f59e0b; background: #fffbeb; }
                .nk-badge { display: inline-flex; padding: 0.125rem 0.5rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; }
                .nk-badge-success { background: #ecfdf5; color: #059669; }
                .nk-badge-muted { background: #f3f4f6; color: #9ca3af; }

                .nk-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; gap: 1rem; color: var(--text-muted); }
                .nk-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; gap: 0.5rem; color: var(--text-muted); }

                @keyframes nkSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
                @media (max-width: 768px) {
                    .nk-header { flex-direction: column; }
                    .nk-header-actions { width: 100%; }
                    .nk-stats-bar { gap: 1rem; }
                    .nk-filters { flex-direction: column; }
                    .nk-progress-wrap { margin-left: 0; width: 100%; }
                    .nk-progress-bar { flex: 1; }
                }
            `}</style>
        </DashboardLayout>
    )
}

export default NilaiSemapta
