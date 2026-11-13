import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { useSettings } from '../contexts/SettingsContext'
import { isSupabaseConfigured } from '../services/supabaseService'
import { supabase } from '../lib/supabase'
import {
    User,
    Lock,
    Eye,
    EyeOff,
    GraduationCap,
    Anchor,
    Ship,
    Waves,
    Calendar,
    ShieldCheck
} from 'lucide-react'
import './Login.css'
import './LoginGlass.css'
import { generateAcademicYearOptions } from '../utils/academicYear'

const TAHUN_AJARAN_OPTIONS = generateAcademicYearOptions()


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
    // "Wajib SEB": set when a mahasiswa login was refused outside SEB; shows
    // the admin's "password uji coba" field
    const [sebRequired, setSebRequired] = useState(false)
    const [sebBypass, setSebBypass] = useState('')
    // Database connection, checked once when the page opens (no button)
    const [dbStatus, setDbStatus] = useState('checking') // checking | ok | error

    useEffect(() => {
        let cancelled = false
        const check = async () => {
            if (!isSupabaseConfigured()) {
                if (!cancelled) setDbStatus('error')
                return
            }
            try {
                const { error } = await supabase.from('users').select('id', { head: true }).limit(1)
                if (!cancelled) setDbStatus(error ? 'error' : 'ok')
            } catch {
                if (!cancelled) setDbStatus('error')
            }
        }
        check()
        return () => { cancelled = true }
    }, [])

    // Clear form on mount/unmount and load settings
    useEffect(() => {
        // Reset form to clean state
        setFormData(() => ({
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
        // A different account starts over (no bypass field)
        if (name === 'username') { setSebRequired(false); setSebBypass('') }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        const { username, password, tahunAkademik } = formData
        const cleanUsername = username.trim()

        try {
            // Use authService via the login function from AuthContext
            // The login function now handles both Supabase Auth and demo mode
            const result = await login(cleanUsername, password, tahunAkademik, {
                sebBypassPassword: sebRequired ? sebBypass : ''
            })
            if (result?.success && ['superadmin', 'admin', 'admin_prodi'].includes(result.user?.role)) {
                await saveSettings({ tahunAkademik })
            }
            // On success, App.jsx will handle navigation via user state change
        } catch (err) {
            console.error('Login error:', err)
            if (err.code === 'SEB_REQUIRED' || err.code === 'SEB_BYPASS_WRONG' || err.code === 'SEB_BYPASS_NOT_SET') {
                setSebRequired(true)
                setError(err.code === 'SEB_REQUIRED'
                    ? 'Akun mahasiswa hanya bisa login menggunakan Safe Exam Browser (SEB). Untuk uji coba di browser biasa, admin dapat memasukkan password uji coba di bawah.'
                    : err.message)
            } else if (err.message?.includes('Invalid login credentials')) {
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
        <div className="login-page login-glass">
            {/* Animated Background */}
            <div className="login-bg">
                <div className="wave wave-1"></div>
                <div className="wave wave-2"></div>
                <div className="wave wave-3"></div>

                {/* Glowing Orbs for dynamic moving background */}
                <div className="glowing-orb orb-1"></div>
                <div className="glowing-orb orb-2"></div>
                <div className="glowing-orb orb-3"></div>
                <div className="glowing-orb orb-4"></div>

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
                        <p className="branding-tagline">{settings?.appSubtitle || 'Sistem Ujian Online Berbasis Komputer'}</p>
                        <p className="branding-subtitle">{settings?.institution || 'Politeknik Transportasi Sungai Danau dan Penyeberangan Palembang'}</p>
                    </div>
                </div>

                {/* Right Panel - Login Form */}
                <div className="login-form-panel">
                    <div className="login-form-content">
                        <div className="form-header">
                            <h2>Selamat Datang</h2>
                            <p>Masuk untuk melanjutkan</p>
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

                            {sebRequired && (
                                <div className="form-group">
                                    <label className="form-label" htmlFor="sebBypass">Password Uji Coba (Admin)</label>
                                    <div className="form-input-icon">
                                        <ShieldCheck className="icon" size={20} />
                                        <input
                                            type="password"
                                            id="sebBypass"
                                            name="sebBypass"
                                            className="form-input"
                                            placeholder="Diisi admin untuk membuka di browser biasa"
                                            value={sebBypass}
                                            onChange={e => { setSebBypass(e.target.value); setError('') }}
                                            autoComplete="off"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                            )}

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
                            <p>© 2026 Poltektrans SDP Palembang · v2.1</p>
                            <div className={`db-status db-status-${dbStatus}`} role="status" aria-live="polite">
                                <span className="db-status-dot" aria-hidden="true"></span>
                                {dbStatus === 'checking' && 'Memeriksa koneksi database…'}
                                {dbStatus === 'ok' && 'Koneksi database aman'}
                                {dbStatus === 'error' && 'Koneksi database terkendala'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Login
