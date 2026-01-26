import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { useSettings } from '../contexts/SettingsContext'
import { userService, isSupabaseConfigured } from '../services/supabaseService'
import {
    User,
    Lock,
    Eye,
    EyeOff,
    GraduationCap,
    Anchor,
    Ship,
    Waves,
    Calendar
} from 'lucide-react'
import './Login.css'

// Generate Tahun Akademik options
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


function Login() {
    const { login } = useAuth()
    const { settings, saveSettings } = useSettings()
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        tahunAkademik: TAHUN_AJARAN_OPTIONS[0] || ''
    })
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    // Clear form on mount/unmount and load settings
    useEffect(() => {
        // Reset form to clean state
        setFormData(prev => ({
            username: '',
            password: '',
            tahunAkademik: settings?.tahunAkademik || TAHUN_AJARAN_OPTIONS[0] || ''
        }))
        setShowPassword(false)
        setError('')
    }, [settings?.tahunAkademik]) // Re-run if default academic year changes

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
        setError('')
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        const { username, password, tahunAkademik } = formData
        const cleanUsername = username.trim()

        // Save tahunAkademik to settings (non-blocking)
        try {
            if (saveSettings) {
                saveSettings({ ...settings, tahunAkademik })
            }
        } catch (e) {
            console.error('Error saving settings:', e)
        }

        try {
            // Use authService via the login function from AuthContext
            // The login function now handles both Supabase Auth and demo mode
            await login(cleanUsername, password)
            // On success, App.jsx will handle navigation via user state change
        } catch (err) {
            console.error('Login error:', err)
            if (err.message?.includes('Invalid login credentials')) {
                setError('Username atau password salah.')
            } else if (err.message) {
                setError(err.message)
            } else {
                setError('Terjadi kesalahan saat login. Silakan coba lagi.')
            }
        } finally {
            setIsLoading(false)
        }
    }



    return (
        <div className="login-page">
            {/* Animated Background */}
            <div className="login-bg">
                <div className="wave wave-1"></div>
                <div className="wave wave-2"></div>
                <div className="wave wave-3"></div>
                <div className="ship-container-1">
                    <Ship className="floating-icon ship-1" size={48} />
                </div>
                <div className="ship-container-2">
                    <Ship className="floating-icon ship-2" size={32} />
                </div>
                <Anchor className="floating-icon anchor-1" size={40} />
                <Waves className="floating-icon waves-1" size={36} />
            </div>

            {/* Login Container */}
            <div className="login-container animate-scaleIn">
                {/* Left Panel - Branding */}
                <div className="login-branding">
                    <div className="branding-content">
                        <div className="logo-container">
                            {settings?.logoUrl ? (
                                <img src={settings.logoUrl} alt="Logo" className="logo-image-lg" />
                            ) : (
                                <div className="logo-icon">
                                    <GraduationCap size={48} />
                                </div>
                            )}
                        </div>
                        <h1 className="branding-title">{settings?.appName || 'CAT POLTEKTRANS'}</h1>
                        <p className="branding-subtitle">{settings?.institution || 'Politeknik Transportasi Sungai Danau dan Penyeberangan Palembang'}</p>
                        <div className="branding-divider"></div>
                        <p className="branding-tagline">{settings?.appSubtitle || 'Sistem Ujian Online Berbasis Komputer'}</p>

                        <div className="branding-features">
                            <div className="feature-item">
                                <span className="feature-icon">🔒</span>
                                <span>Keamanan Terjamin</span>
                            </div>
                            <div className="feature-item">
                                <span className="feature-icon">⚡</span>
                                <span>Cepat & Responsif</span>
                            </div>
                            <div className="feature-item">
                                <span className="feature-icon">📊</span>
                                <span>Hasil Real-time</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Login Form */}
                <div className="login-form-panel">
                    <div className="login-form-content">
                        <div className="form-header">
                            <h2>Selamat Datang</h2>
                            <p>Silakan masuk ke akun Anda</p>
                        </div>

                        <form onSubmit={handleSubmit} className="login-form" autoComplete="off">
                            {error && (
                                <div className="alert alert-error animate-shake">
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label" htmlFor="username">Username / NIM</label>
                                <div className="form-input-icon">
                                    <User className="icon" size={20} />
                                    <input
                                        type="text"
                                        id="username"
                                        name="username"
                                        className="form-input"
                                        placeholder="Masukkan username atau NIM"
                                        value={formData.username}
                                        onChange={handleChange}
                                        required
                                        autoComplete="off"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="password">Password</label>
                                <div className="form-input-icon">
                                    <Lock className="icon" size={20} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        id="password"
                                        name="password"
                                        className="form-input"
                                        placeholder="Masukkan password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        autoComplete="new-password"
                                        style={{ paddingRight: '48px' }}
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="tahunAkademik">Tahun Akademik</label>
                                <div className="form-input-icon">
                                    <Calendar className="icon" size={20} />
                                    <select
                                        id="tahunAkademik"
                                        name="tahunAkademik"
                                        className="form-input"
                                        value={formData.tahunAkademik}
                                        onChange={handleChange}
                                        required
                                    >
                                        {TAHUN_AJARAN_OPTIONS.map(ta => (
                                            <option key={ta} value={ta}>{ta}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary btn-lg login-btn"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="spinner"></span>
                                        <span>Memproses...</span>
                                    </>
                                ) : (
                                    'Masuk'
                                )}
                            </button>
                        </form>



                        <div className="login-footer">
                            <p>© 2026 Politeknik Transportasi SDP Palembang</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Login
