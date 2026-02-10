import { useState, useRef, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useSettings, COLOR_PRESETS } from '../../contexts/SettingsContext'
import {
    Upload,
    Palette,
    Type,
    Building2,
    Save,
    RotateCcw,
    Check,
    Image,
    X,
    Shield,
    AlertTriangle
} from 'lucide-react'

function SettingsPage() {
    const { settings, updateSettings, resetSettings, isLoaded } = useSettings()
    const [localSettings, setLocalSettings] = useState(settings)
    const [logoPreview, setLogoPreview] = useState(settings.logoUrl)
    const [saveStatus, setSaveStatus] = useState(null)
    const fileInputRef = useRef(null)

    // Sync localSettings when settings are loaded from Supabase
    useEffect(() => {
        if (isLoaded) {
            setLocalSettings(settings)
            setLogoPreview(settings.logoUrl)
        }
    }, [isLoaded, settings])

    const handleInputChange = (field, value) => {
        setLocalSettings(prev => ({ ...prev, [field]: value }))
    }

    const handleLogoUpload = (e) => {
        const file = e.target.files[0]
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert('Ukuran file maksimal 2MB')
                return
            }
            const reader = new FileReader()
            reader.onloadend = () => {
                setLogoPreview(reader.result)
                setLocalSettings(prev => ({ ...prev, logoUrl: reader.result }))
            }
            reader.readAsDataURL(file)
        }
    }

    const handleRemoveLogo = () => {
        setLogoPreview(null)
        setLocalSettings(prev => ({ ...prev, logoUrl: null }))
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleColorSelect = (preset) => {
        setLocalSettings(prev => ({
            ...prev,
            primaryColor: preset.primary,
            secondaryColor: preset.secondary
        }))
    }

    const handleSave = () => {
        updateSettings(localSettings)
        setSaveStatus('success')
        setTimeout(() => setSaveStatus(null), 3000)
    }

    const handleReset = () => {
        if (confirm('Yakin ingin mengembalikan semua pengaturan ke default?')) {
            resetSettings()
            setLocalSettings({
                appName: 'CAT POLTEKTRANS',
                appSubtitle: 'Sistem Ujian Online',
                logoUrl: null,
                primaryColor: '#0891b2',
                secondaryColor: '#ca8a04',
                institution: 'Politeknik Transportasi SDP Palembang',
                address: 'Jl. Residen Abdul Rozak, Palembang',
                phone: '(0711) 712345',
                email: 'info@poltektrans.ac.id'
            })
            setLogoPreview(null)
            setSaveStatus('reset')
            setTimeout(() => setSaveStatus(null), 3000)
        }
    }

    return (
        <DashboardLayout>
            <div className="settings-page animate-fadeIn">
                <div className="page-header">
                    <h1 className="page-title">Pengaturan Aplikasi</h1>
                    <p className="page-subtitle">Kustomisasi tampilan dan informasi aplikasi</p>
                </div>

                <div className="settings-grid">
                    {/* Logo Upload */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-3">
                                <Image size={20} className="text-secondary" />
                                <h3 className="font-semibold">Logo Aplikasi</h3>
                            </div>
                        </div>
                        <div className="card-body">
                            <div className="logo-upload-area">
                                {logoPreview ? (
                                    <div className="logo-preview-container">
                                        <img src={logoPreview} alt="Logo Preview" className="logo-preview" />
                                        <button
                                            className="btn btn-icon btn-ghost remove-logo-btn"
                                            onClick={handleRemoveLogo}
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        className="upload-placeholder"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload size={48} className="upload-icon" />
                                        <span>Klik untuk upload logo</span>
                                        <span className="text-muted text-sm">PNG, JPG (Max 2MB)</span>
                                    </div>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg"
                                    onChange={handleLogoUpload}
                                    style={{ display: 'none' }}
                                />
                            </div>
                            {logoPreview && (
                                <button
                                    className="btn btn-outline btn-sm mt-3"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload size={16} />
                                    Ganti Logo
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Color Theme */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-3">
                                <Palette size={20} className="text-secondary" />
                                <h3 className="font-semibold">Tema Warna</h3>
                            </div>
                        </div>
                        <div className="card-body">
                            <div className="color-presets">
                                {COLOR_PRESETS.map((preset, idx) => (
                                    <button
                                        key={idx}
                                        className={`color-preset-btn ${localSettings.primaryColor === preset.primary ? 'active' : ''}`}
                                        onClick={() => handleColorSelect(preset)}
                                        title={preset.name}
                                    >
                                        <div
                                            className="color-swatch"
                                            style={{
                                                background: `linear-gradient(135deg, ${preset.primary} 50%, ${preset.secondary} 50%)`
                                            }}
                                        />
                                        <span className="color-name">{preset.name}</span>
                                        {localSettings.primaryColor === preset.primary && (
                                            <Check size={14} className="color-check" />
                                        )}
                                    </button>
                                ))}
                            </div>
                            <div className="color-custom mt-4">
                                <label className="form-label">Warna Kustom</label>
                                <div className="flex gap-3">
                                    <div className="color-input-group">
                                        <label className="text-sm text-muted">Primary</label>
                                        <input
                                            type="color"
                                            value={localSettings.primaryColor}
                                            onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                                            className="color-input"
                                        />
                                    </div>
                                    <div className="color-input-group">
                                        <label className="text-sm text-muted">Secondary</label>
                                        <input
                                            type="color"
                                            value={localSettings.secondaryColor}
                                            onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                                            className="color-input"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* App Name */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-3">
                                <Type size={20} className="text-secondary" />
                                <h3 className="font-semibold">Nama Aplikasi</h3>
                            </div>
                        </div>
                        <div className="card-body">
                            <div className="form-group">
                                <label className="form-label">Nama Utama</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={localSettings.appName}
                                    onChange={(e) => handleInputChange('appName', e.target.value)}
                                    placeholder="CAT POLTEKTRANS"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Sub Judul</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={localSettings.appSubtitle}
                                    onChange={(e) => handleInputChange('appSubtitle', e.target.value)}
                                    placeholder="Sistem Ujian Online"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Institution Info */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-3">
                                <Building2 size={20} className="text-secondary" />
                                <h3 className="font-semibold">Informasi Institusi</h3>
                            </div>
                            <span className="text-muted text-sm">Untuk Kop Surat</span>
                        </div>
                        <div className="card-body">
                            <div className="form-group">
                                <label className="form-label">Nama Institusi</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={localSettings.institution}
                                    onChange={(e) => handleInputChange('institution', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Alamat</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={localSettings.address}
                                    onChange={(e) => handleInputChange('address', e.target.value)}
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Telepon</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={localSettings.phone}
                                        onChange={(e) => handleInputChange('phone', e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        value={localSettings.email}
                                        onChange={(e) => handleInputChange('email', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Kepala BAA Info */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-3">
                                <Building2 size={20} className="text-secondary" />
                                <h3 className="font-semibold">Kepala Bag. Administrasi Akademik</h3>
                            </div>
                            <span className="text-muted text-sm">Untuk Tanda Tangan</span>
                        </div>
                        <div className="card-body">
                            <div className="form-group">
                                <label className="form-label">Nama Kepala BAA</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={localSettings.kepalaBaaName || ''}
                                    onChange={(e) => handleInputChange('kepalaBaaName', e.target.value)}
                                    placeholder="Contoh: IKKA SUKARNI, S.Pd., M.M.Tr"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">NIP Kepala BAA</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={localSettings.kepalaBaaNip || ''}
                                    onChange={(e) => handleInputChange('kepalaBaaNip', e.target.value)}
                                    placeholder="Contoh: 197806051999032001"
                                />
                            </div>
                        </div>
                    </div>

                    {/* SEB & Anti-Cheat Settings */}
                    <div className="card">
                        <div className="card-header">
                            <div className="flex items-center gap-3">
                                <Shield size={20} className="text-secondary" />
                                <h3 className="font-semibold">Pengaturan Anti-Kecurangan</h3>
                            </div>
                            <span className="text-muted text-sm">Safe Exam Browser</span>
                        </div>
                        <div className="card-body">
                            <div className="form-group">
                                <label className="form-label">Wajibkan Safe Exam Browser</label>
                                <div className="toggle-container">
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={localSettings.requireSEB || false}
                                            onChange={(e) => handleInputChange('requireSEB', e.target.checked)}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                    <span className="toggle-label">
                                        {localSettings.requireSEB ? 'Aktif - Ujian hanya bisa diakses via SEB' : 'Nonaktif - Ujian bisa diakses browser biasa'}
                                    </span>
                                </div>
                                <p className="form-hint">
                                    <AlertTriangle size={14} />
                                    Jika diaktifkan, mahasiswa wajib menggunakan Safe Exam Browser untuk mengakses ujian.
                                </p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Batas Peringatan</label>
                                <select
                                    className="form-input"
                                    value={localSettings.maxWarnings || 5}
                                    onChange={(e) => handleInputChange('maxWarnings', parseInt(e.target.value))}
                                >
                                    <option value={3}>3 Peringatan (Ketat)</option>
                                    <option value={5}>5 Peringatan (Normal)</option>
                                    <option value={10}>10 Peringatan (Longgar)</option>
                                </select>
                                <p className="form-hint">Ujian akan otomatis diakhiri jika pelanggaran mencapai batas ini.</p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Level Anti-Kecurangan</label>
                                <select
                                    className="form-input"
                                    value={localSettings.antiCheatLevel || 'medium'}
                                    onChange={(e) => handleInputChange('antiCheatLevel', e.target.value)}
                                >
                                    <option value="low">Rendah - Hanya deteksi tab switch</option>
                                    <option value="medium">Sedang - Blokir copy/paste & shortcuts</option>
                                    <option value="high">Tinggi - Fullscreen wajib + semua fitur</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="settings-actions">
                    <button className="btn btn-outline" onClick={handleReset}>
                        <RotateCcw size={18} />
                        Reset Default
                    </button>
                    <button className="btn btn-primary" onClick={handleSave}>
                        <Save size={18} />
                        Simpan Pengaturan
                    </button>
                </div>

                {/* Save Status Toast */}
                {saveStatus && (
                    <div className={`toast toast-${saveStatus === 'success' ? 'success' : 'info'}`}>
                        <Check size={18} />
                        {saveStatus === 'success' ? 'Pengaturan berhasil disimpan!' : 'Pengaturan dikembalikan ke default'}
                    </div>
                )}
            </div>

            <style>{`
                .settings-page {
                    padding: 0;
                }
                .settings-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }
                @media (max-width: 768px) {
                    .settings-grid {
                        grid-template-columns: 1fr;
                    }
                }
                .logo-upload-area {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .upload-placeholder {
                    width: 200px;
                    height: 200px;
                    border: 2px dashed var(--color-border);
                    border-radius: 1rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    background: var(--color-surface);
                }
                .upload-placeholder:hover {
                    border-color: var(--color-primary);
                    background: var(--color-primary-alpha);
                }
                .upload-icon {
                    color: var(--color-text-muted);
                }
                .logo-preview-container {
                    position: relative;
                    width: 200px;
                    height: 200px;
                }
                .logo-preview {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    border-radius: 1rem;
                    border: 2px solid var(--color-border);
                    background: white;
                }
                .remove-logo-btn {
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    background: var(--color-danger) !important;
                    color: white !important;
                    border-radius: 50%;
                    width: 28px;
                    height: 28px;
                }
                .color-presets {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    gap: 0.75rem;
                }
                .color-preset-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem;
                    border: 2px solid var(--color-border);
                    border-radius: 0.75rem;
                    background: var(--color-surface);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                }
                .color-preset-btn:hover {
                    border-color: var(--color-primary);
                }
                .color-preset-btn.active {
                    border-color: var(--color-primary);
                    background: var(--color-primary-alpha);
                }
                .color-swatch {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                }
                .color-name {
                    font-size: 0.75rem;
                    color: var(--color-text-muted);
                    text-align: center;
                }
                .color-check {
                    position: absolute;
                    top: 0.5rem;
                    right: 0.5rem;
                    color: var(--color-primary);
                }
                .color-input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }
                .color-input {
                    width: 60px;
                    height: 40px;
                    border: 2px solid var(--color-border);
                    border-radius: 0.5rem;
                    cursor: pointer;
                    padding: 0;
                    overflow: hidden;
                }
                .color-input::-webkit-color-swatch {
                    border: none;
                }
                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }
                @media (max-width: 480px) {
                    .form-row {
                        grid-template-columns: 1fr;
                    }
                }
                .settings-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 1rem;
                    padding-top: 1rem;
                    border-top: 1px solid var(--color-border);
                }
                .toast {
                    position: fixed;
                    bottom: 2rem;
                    right: 2rem;
                    padding: 1rem 1.5rem;
                    border-radius: 0.75rem;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    color: white;
                    font-weight: 500;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                    animation: slideIn 0.3s ease;
                    z-index: 1000;
                }
                .toast-success {
                    background: var(--color-success);
                }
                .toast-info {
                    background: var(--color-primary);
                }
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
                /* Toggle Switch */
                .toggle-container {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin: 0.5rem 0;
                }
                .toggle-switch {
                    position: relative;
                    display: inline-block;
                    width: 50px;
                    height: 28px;
                    flex-shrink: 0;
                }
                .toggle-switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .toggle-slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: var(--color-border);
                    transition: 0.3s;
                    border-radius: 28px;
                }
                .toggle-slider:before {
                    position: absolute;
                    content: "";
                    height: 20px;
                    width: 20px;
                    left: 4px;
                    bottom: 4px;
                    background-color: white;
                    transition: 0.3s;
                    border-radius: 50%;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                .toggle-switch input:checked + .toggle-slider {
                    background-color: var(--color-primary);
                }
                .toggle-switch input:checked + .toggle-slider:before {
                    transform: translateX(22px);
                }
                .toggle-label {
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                }
                .form-hint {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.75rem;
                    color: var(--color-text-muted);
                    margin-top: 0.5rem;
                }
                .form-hint svg {
                    color: var(--color-warning);
                    flex-shrink: 0;
                }
            `}</style>
        </DashboardLayout>
    )
}

export default SettingsPage
