import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useSettings } from '../../contexts/SettingsContext'
import { prodiService } from '../../services/supabaseService'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
    Building2,
    Save,
    Calendar,
    Check,
    User
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
            if (!user?.prodiId) {
                setLoading(false)
                return
            }

            try {
                if (isSupabaseConfigured()) {
                    const prodi = await prodiService.getById(user.prodiId)
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
    }, [user?.prodiId])

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
            // Save Ka.Prodi to Supabase prodi table
            if (isSupabaseConfigured() && user?.prodiId) {
                await prodiService.update(user.prodiId, {
                    ketua_prodi_nama: localSettings.kaprodiNama,
                    ketua_prodi_nip: localSettings.kaprodiNip
                })
            }

            // Save tahun akademik to SettingsContext (syncs across app)
            saveSettings({ ...appSettings, tahunAkademik: selectedTahunAkademik })

            setSaveStatus('success')
            setTimeout(() => setSaveStatus(null), 3000)
        } catch (error) {
            console.error('Error saving prodi settings:', error)
            setSaveStatus('error')
            setTimeout(() => setSaveStatus(null), 3000)
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
