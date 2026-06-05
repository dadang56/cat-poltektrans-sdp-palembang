import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useSettings } from '../../contexts/SettingsContext'
import { prodiService, backupService } from '../../services/supabaseService'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
    Building2,
    Save,
    Calendar,
    Check,
    User,
    Download,
    Upload,
    Database,
    Loader2,
    AlertCircle
} from 'lucide-react'
import './Dashboard.css'

// Tahun Ajaran options - generate with consistent format matching Dashboard
const generateTahunAjaranOptions = () => {
    const options = []
    const currentYear = new Date().getFullYear()
    for (let year = currentYear + 1; year >= currentYear - 2; year--) {
        options.push(`${year}/${year + 1} Ganjil`)
        options.push(`${year}/${year + 1} Genap`)
    }
    return options
}

const TAHUN_AJARAN_OPTIONS = generateTahunAjaranOptions()

function AdminProdiSettings() {
    const { user } = useAuth()
    const { settings: appSettings, saveSettings } = useSettings()

    // Local state for Ka. Prodi info
    const [localSettings, setLocalSettings] = useState({ kaprodiNama: '', kaprodiNip: '' })
    const [loading, setLoading] = useState(true)

    // Tahun Akademik from SettingsContext (synchronized across app)
    const [selectedTahunAkademik, setSelectedTahunAkademik] = useState('')
    const [saveStatus, setSaveStatus] = useState(null)

    // Load Ka.Prodi from Supabase prodi table
    useEffect(() => {
        const loadProdiSettings = async () => {
            const userProdiId = user?.prodiId || user?.prodi_id
            if (!userProdiId) {
                setLoading(false)
                return
            }

            try {
                if (isSupabaseConfigured()) {
                    const prodi = await prodiService.getById(userProdiId)
                    if (prodi) {
                        setLocalSettings({
                            kaprodiNama: prodi.ketua_prodi_nama || '',
                            kaprodiNip: prodi.ketua_prodi_nip || ''
                        })
                    }
                }
            } catch (error) {
                console.error('Error loading prodi settings:', error)
            }
            setLoading(false)
        }

        loadProdiSettings()
    }, [user?.prodiId, user?.prodi_id])

    // Load tahun akademik from app settings
    useEffect(() => {
        if (appSettings?.tahunAkademik) {
            setSelectedTahunAkademik(appSettings.tahunAkademik)
        } else if (TAHUN_AJARAN_OPTIONS.length > 0) {
            setSelectedTahunAkademik(TAHUN_AJARAN_OPTIONS[0])
        }
    }, [appSettings])

    const handleLocalChange = (field, value) => {
        setLocalSettings(prev => ({ ...prev, [field]: value }))
    }

    const handleTahunAkademikChange = (value) => {
        setSelectedTahunAkademik(value)
    }

    const handleSave = async () => {
        setSaveStatus('saving')

        try {
            const saveProdiId = user?.prodiId || user?.prodi_id
            if (isSupabaseConfigured() && saveProdiId) {
                console.log('[Settings] Saving Ka.Prodi to prodi:', saveProdiId)
                await prodiService.update(saveProdiId, {
                    ketua_prodi_nama: localSettings.kaprodiNama,
                    ketua_prodi_nip: localSettings.kaprodiNip
                })
                console.log('[Settings] Ka.Prodi saved successfully')
            } else {
                console.warn('[Settings] Cannot save Ka.Prodi - no prodi_id found. User:', JSON.stringify({prodiId: user?.prodiId, prodi_id: user?.prodi_id}))
            }

            // Save tahun akademik to SettingsContext (syncs across app)
            saveSettings({ tahunAkademik: selectedTahunAkademik })

            setSaveStatus('success')
            setTimeout(() => setSaveStatus(null), 3000)
        } catch (error) {
            console.error('Error saving prodi settings:', error)
            setSaveStatus('error')
            setTimeout(() => setSaveStatus(null), 3000)
        }
    }

    // Backup & Restore
    const [backupLoading, setBackupLoading] = useState(false)
    const [restoreLoading, setRestoreLoading] = useState(false)
    const [backupStatus, setBackupStatus] = useState(null)

    const handleBackup = async () => {
        setBackupLoading(true)
        setBackupStatus(null)
        try {
            const backup = await backupService.exportAll()
            const json = JSON.stringify(backup, null, 2)
            const blob = new Blob([json], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            const date = new Date().toISOString().split('T')[0]
            a.href = url
            a.download = `backup-sipandu-${date}.json`
            a.click()
            URL.revokeObjectURL(url)

            // Show summary
            const totalRows = Object.values(backup.tables).reduce((sum, t) => sum + t.length, 0)
            const tableCount = Object.keys(backup.tables).length
            setBackupStatus({ type: 'success', message: `Backup berhasil! ${totalRows} data dari ${tableCount} tabel.` })
        } catch (err) {
            console.error('Backup error:', err)
            setBackupStatus({ type: 'error', message: 'Gagal membuat backup: ' + err.message })
        } finally {
            setBackupLoading(false)
        }
    }

    const handleRestore = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        e.target.value = '' // Reset input

        if (!confirm('⚠️ PERINGATAN: Restore akan menimpa data yang sudah ada dengan data dari file backup.\n\nLanjutkan?')) return

        setRestoreLoading(true)
        setBackupStatus(null)
        try {
            const text = await file.text()
            const backup = JSON.parse(text)

            if (!backup.version || !backup.tables) {
                throw new Error('Format file backup tidak valid')
            }

            // Restore order matters: parent tables first
            const restoreOrder = [
                'prodi', 'ruangan', 'users', 'kelas', 'mata_kuliah',
                'jadwal_ujian', 'soal', 'hasil_ujian', 'jawaban_mahasiswa',
                'kehadiran', 'berita_acara', 'nilai_pusbangkatar'
            ]

            let totalInserted = 0
            let totalErrors = 0

            for (const table of restoreOrder) {
                if (backup.tables[table] && backup.tables[table].length > 0) {
                    const result = await backupService.restoreTable(table, backup.tables[table])
                    totalInserted += result.inserted
                    totalErrors += result.errors
                }
            }

            setBackupStatus({
                type: totalErrors > 0 ? 'warning' : 'success',
                message: `Restore selesai! ${totalInserted} data berhasil, ${totalErrors} gagal. Backup dari: ${new Date(backup.timestamp).toLocaleString('id-ID')}`
            })
        } catch (err) {
            console.error('Restore error:', err)
            setBackupStatus({ type: 'error', message: 'Gagal restore: ' + err.message })
        } finally {
            setRestoreLoading(false)
        }
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Pengaturan Prodi</h1>
                        <p className="page-subtitle">Konfigurasi data program studi dan tahun akademik</p>
                    </div>
                </div>

                <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    {/* Tahun Akademik */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-3">
                                <Calendar size={20} className="text-secondary" />
                                <h3 className="font-semibold">Tahun Akademik</h3>
                            </div>
                            <span className="badge badge-primary">{selectedTahunAkademik}</span>
                        </div>
                        <div className="card-body">
                            <p className="text-sm text-muted mb-4">
                                Pilih tahun akademik aktif. Pengaturan ini akan disinkronkan ke seluruh halaman aplikasi.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Tahun Akademik Aktif</label>
                                <select
                                    className="form-input"
                                    value={selectedTahunAkademik}
                                    onChange={(e) => handleTahunAkademikChange(e.target.value)}
                                >
                                    {TAHUN_AJARAN_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Ka. Prodi Info */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-3">
                                <User size={20} className="text-secondary" />
                                <h3 className="font-semibold">Ka. Program Studi</h3>
                            </div>
                            <span className="text-muted text-sm">Untuk Tanda Tangan</span>
                        </div>
                        <div className="card-body">
                            <p className="text-sm text-muted mb-4">
                                Data Ka. Prodi akan otomatis muncul pada printout rekap nilai, kehadiran, dan berita acara.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Nama Ka. Prodi</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={localSettings.kaprodiNama}
                                    onChange={(e) => handleLocalChange('kaprodiNama', e.target.value)}
                                    placeholder="Dr. Nama Lengkap, M.T."
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">NIP</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={localSettings.kaprodiNip}
                                    onChange={(e) => handleLocalChange('kaprodiNip', e.target.value)}
                                    placeholder="197012345678901234"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Backup & Restore */}
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <div className="card-header">
                        <div className="flex items-center gap-3">
                            <Database size={20} className="text-secondary" />
                            <h3 className="font-semibold">Backup & Restore Data</h3>
                        </div>
                    </div>
                    <div className="card-body">
                        <p className="text-sm text-muted mb-4">
                            Backup seluruh data ke file lokal (JSON). Gunakan untuk mencegah kehilangan data.
                            Disarankan backup secara rutin sebelum menghapus data.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                            <button
                                className="btn btn-primary"
                                onClick={handleBackup}
                                disabled={backupLoading || restoreLoading}
                            >
                                {backupLoading ? (
                                    <><Loader2 size={18} className="spin" /> Membuat Backup...</>
                                ) : (
                                    <><Download size={18} /> Download Backup</>
                                )}
                            </button>
                            <label
                                className="btn btn-outline"
                                style={{ cursor: restoreLoading ? 'not-allowed' : 'pointer' }}
                            >
                                {restoreLoading ? (
                                    <><Loader2 size={18} className="spin" /> Memulihkan...</>
                                ) : (
                                    <><Upload size={18} /> Restore dari File</>
                                )}
                                <input
                                    type="file"
                                    accept=".json"
                                    style={{ display: 'none' }}
                                    onChange={handleRestore}
                                    disabled={restoreLoading}
                                />
                            </label>
                        </div>
                        {backupStatus && (
                            <div style={{
                                padding: '0.75rem 1rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: backupStatus.type === 'success' ? 'var(--success-50)' : backupStatus.type === 'warning' ? 'var(--warning-50)' : 'var(--error-50)',
                                color: backupStatus.type === 'success' ? 'var(--success-700)' : backupStatus.type === 'warning' ? 'var(--warning-700)' : 'var(--error-700)',
                                border: `1px solid ${backupStatus.type === 'success' ? 'var(--success-200)' : backupStatus.type === 'warning' ? 'var(--warning-200)' : 'var(--error-200)'}`
                            }}>
                                {backupStatus.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                                {backupStatus.message}
                            </div>
                        )}
                    </div>
                </div>

                {/* Save Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    <button className="btn btn-primary" onClick={handleSave}>
                        <Save size={18} />
                        Simpan Pengaturan
                    </button>
                </div>

                {/* Save Status Toast */}
                {saveStatus && (
                    <div style={{
                        position: 'fixed',
                        bottom: '2rem',
                        right: '2rem',
                        padding: '1rem 1.5rem',
                        borderRadius: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        color: 'white',
                        fontWeight: 500,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                        animation: 'slideIn 0.3s ease',
                        zIndex: 1000,
                        background: 'var(--success-500)'
                    }}>
                        <Check size={18} />
                        Pengaturan berhasil disimpan!
                    </div>
                )}
            </div>

            <style>{`
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @media (max-width: 480px) {
                    .settings-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </DashboardLayout>
    )
}

export default AdminProdiSettings
