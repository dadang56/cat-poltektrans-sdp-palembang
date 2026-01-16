import { useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import {
    Building2,
    Save,
    Calendar,
    Check,
    User
} from 'lucide-react'
import './Dashboard.css'

// Tahun Ajaran options - dynamically generate
const generateTahunAjaranOptions = () => {
    const options = []
    const currentYear = new Date().getFullYear()
    for (let year = currentYear; year >= currentYear - 2; year--) {
        options.push({ value: `${year}/${year + 1}-1`, label: `${year}/${year + 1} Ganjil` })
        options.push({ value: `${year}/${year + 1}-2`, label: `${year}/${year + 1} Genap` })
    }
    return options
}

const TAHUN_AJARAN_OPTIONS = generateTahunAjaranOptions()

function AdminProdiSettings() {
    const { user } = useAuth()

    // Initialize settings from localStorage (lazy initialization)
    const [settings, setSettings] = useState(() => {
        const storageKey = `prodiSettings_${user?.prodiId || 'default'}`
        const savedSettings = localStorage.getItem(storageKey)
        if (savedSettings) {
            try {
                return { kaprodiNama: '', kaprodiNip: '', tahunAjaran: '2025/2026-1', ...JSON.parse(savedSettings) }
            } catch {
                return { kaprodiNama: '', kaprodiNip: '', tahunAjaran: '2025/2026-1' }
            }
        }
        return { kaprodiNama: '', kaprodiNip: '', tahunAjaran: '2025/2026-1' }
    })
    const [saveStatus, setSaveStatus] = useState(null)

    const handleChange = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }))
    }

    const handleSave = () => {
        const storageKey = `prodiSettings_${user?.prodiId || 'default'}`
        localStorage.setItem(storageKey, JSON.stringify(settings))

        // Also save kaprodiInfo for printouts (keyed by prodiId)
        localStorage.setItem(`kaprodiInfo_${user?.prodiId || 'default'}`, JSON.stringify({
            nama: settings.kaprodiNama,
            nip: settings.kaprodiNip
        }))

        // Save current tahun ajaran for data filtering
        localStorage.setItem(`tahunAjaran_${user?.prodiId || 'default'}`, settings.tahunAjaran)

        setSaveStatus('success')
        setTimeout(() => setSaveStatus(null), 3000)
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

                <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    {/* Tahun Akademik */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-3">
                                <Calendar size={20} className="text-secondary" />
                                <h3 className="font-semibold">Tahun Akademik</h3>
                            </div>
                            <span className="badge badge-primary">{settings.tahunAjaran.replace('-1', ' Ganjil').replace('-2', ' Genap')}</span>
                        </div>
                        <div className="card-body">
                            <p className="text-sm text-muted mb-4">
                                Pilih tahun akademik aktif. Data ujian, nilai, dan kehadiran akan disimpan berdasarkan tahun akademik ini.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Tahun Akademik Aktif</label>
                                <select
                                    className="form-input"
                                    value={settings.tahunAjaran}
                                    onChange={(e) => handleChange('tahunAjaran', e.target.value)}
                                >
                                    {TAHUN_AJARAN_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
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
                                    value={settings.kaprodiNama}
                                    onChange={(e) => handleChange('kaprodiNama', e.target.value)}
                                    placeholder="Dr. Nama Lengkap, M.T."
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">NIP</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={settings.kaprodiNip}
                                    onChange={(e) => handleChange('kaprodiNip', e.target.value)}
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
            `}</style>
        </DashboardLayout>
    )
}

export default AdminProdiSettings
