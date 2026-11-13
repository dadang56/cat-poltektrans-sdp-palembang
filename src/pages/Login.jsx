import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../App'
import { useSettings } from '../contexts/SettingsContext'
import { isSupabaseConfigured } from '../services/supabaseService'
import { supabase } from '../lib/supabase'
import {
    User,
    KeyRound,
    Eye,
    EyeOff,
    GraduationCap,
    CalendarDays,
    ShieldCheck,
    ArrowRight
} from 'lucide-react'
import './LoginSheet.css'
import { generateAcademicYearOptions } from '../utils/academicYear'
import { isRealSeb, sebQuitUrl } from '../utils/sebGate'

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
    const [capsLock, setCapsLock] = useState(false)
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



    // Play the cover video unless the device asks for less motion / data
    const playVideo = (() => {
        try {
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
            if (navigator.connection?.saveData) return false
        } catch { /* old browser: just play */ }
        return true
    })()
    // Start the video only once the page has finished loading and the
    // whole clip is buffered, so it doesn't stutter while the app is still
    // starting up. If a browser never reports "ready" (iOS often doesn't
    // preload), start anyway after 2.5 s.
    const videoRef = useRef(null)
    useEffect(() => {
        const v = videoRef.current
        if (!v) return
        let started = false
        const play = () => {
            if (started) return
            started = true
            v.muted = true
            requestAnimationFrame(() => { v.play().catch(() => { /* stays on the poster */ }) })
        }
        const maybeStart = () => {
            if (v.readyState >= 4 && document.readyState === 'complete') play()
        }
        v.addEventListener('canplaythrough', maybeStart)
        window.addEventListener('load', maybeStart)
        maybeStart()
        const fallback = setTimeout(play, 2500)
        return () => {
            clearTimeout(fallback)
            v.removeEventListener('canplaythrough', maybeStart)
            window.removeEventListener('load', maybeStart)
        }
    }, [])

    const appName = settings?.appName || 'Si-PANDU'
    const tagline = settings?.appSubtitle || 'Sistem Penilaian Terpadu'
    // Caps Lock on is the usual reason a correct password "doesn't work"
    const checkCaps = (e) => {
        if (typeof e.getModifierState === 'function') setCapsLock(e.getModifierState('CapsLock'))
    }

    return (
        <div className="login-page login-sheet-page">
            <main className="login-card">
                {/* Top: brand area with the logo, like an app cover */}
                <section className="login-hero has-video">
                    {/* Captain at the ship's wheel: plays once, then stays on
                        the last frame. Still image instead when the phone
                        asks for less motion or to save data. */}
                    {playVideo ? (
                        <video
                            ref={videoRef}
                            className="login-hero-video"
                            src="/media/kapten-kemudi.mp4"
                            poster="/media/kapten-kemudi-awal.webp"
                            muted
                            playsInline
                            preload="auto"
                            disablePictureInPicture
                            aria-hidden="true"
                            tabIndex={-1}
                        />
                    ) : (
                        <img className="login-hero-video" src="/media/kapten-kemudi-akhir.webp" alt="" aria-hidden="true" />
                    )}
                    <div className="login-hero-brand">
                        <div className="login-hero-logo">
                            {settings?.logoUrl ? (
                                <img src={settings.logoUrl} alt={`Logo ${appName}`} />
                            ) : (
                                <GraduationCap size={36} />
                            )}
                        </div>
                        <div className="login-hero-text">
                            <div className="login-hero-name">{appName}</div>
                            <div className="login-hero-tagline">{tagline}</div>
                        </div>
                    </div>
                </section>

                {/* Bottom sheet: the form */}
                <section className="login-sheet">
                    <header className="login-sheet-head">
                        <h1>Selamat Datang</h1>
                        <p>Silakan masuk ke akun Anda</p>
                    </header>

                    <form onSubmit={handleSubmit} className="login-sheet-form" autoComplete="off">
                        {error && (
                            <div className="login-error animate-shake" role="alert">
                                {error}
                            </div>
                        )}

                        <label className="login-field">
                            <span className="login-field-label">Username / NIM</span>
                            <span className="login-input">
                                <User size={18} aria-hidden="true" />
                                <input
                                    type="text"
                                    id="username"
                                    name="username"
                                    placeholder="Username atau NIM"
                                    value={formData.username}
                                    onChange={handleChange}
                                    required
                                    autoComplete="off"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    enterKeyHint="next"
                                />
                            </span>
                        </label>

                        <label className="login-field">
                            <span className="login-field-label">Password</span>
                            <span className="login-input">
                                <KeyRound size={18} aria-hidden="true" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    name="password"
                                    placeholder="Password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    onKeyUp={checkCaps}
                                    onKeyDown={checkCaps}
                                    onBlur={() => setCapsLock(false)}
                                    required
                                    autoComplete="new-password"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    enterKeyHint="go"
                                />
                                <button
                                    type="button"
                                    className="login-eye"
                                    onClick={() => setShowPassword(v => !v)}
                                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </span>
                            {capsLock && <span className="login-hint-warn">Caps Lock sedang aktif</span>}
                        </label>

                        {sebRequired && (
                            <label className="login-field">
                                <span className="login-field-label">Password uji coba (admin)</span>
                                <span className="login-input">
                                    <ShieldCheck size={18} aria-hidden="true" />
                                    <input
                                        type="password"
                                        id="sebBypass"
                                        name="sebBypass"
                                        placeholder="Diisi admin"
                                        value={sebBypass}
                                        onChange={e => { setSebBypass(e.target.value); setError('') }}
                                        autoComplete="off"
                                        autoFocus
                                    />
                                </span>
                            </label>
                        )}

                        <label className="login-year">
                            <CalendarDays size={16} aria-hidden="true" />
                            <span>Tahun akademik</span>
                            <select
                                id="tahunAkademik"
                                name="tahunAkademik"
                                value={formData.tahunAkademik}
                                onChange={handleChange}
                                required
                            >
                                {TAHUN_AJARAN_OPTIONS.map(ta => (
                                    <option key={ta} value={ta}>{ta}</option>
                                ))}
                            </select>
                        </label>

                        <button type="submit" className="login-submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <span className="spinner" />
                                    Memproses…
                                </>
                            ) : (
                                <>
                                    Masuk
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <footer className="login-sheet-foot">
                        <span className={`db-status db-status-${dbStatus}`} role="status" aria-live="polite">
                            <span className="db-status-dot" aria-hidden="true" />
                            {dbStatus === 'checking' && 'Menghubungkan…'}
                            {dbStatus === 'ok' && 'Server terhubung'}
                            {dbStatus === 'error' && 'Server bermasalah'}
                        </span>
                        <span className="login-copy">© 2026 Poltektrans SDP Palembang</span>
                        {isRealSeb() && (
                            // quitURL in the SEB config: closes SEB without the password
                            <a className="login-seb-quit" href={sebQuitUrl()}>Keluar dari Safe Exam Browser</a>
                        )}
                    </footer>
                </section>
            </main>
        </div>
    )
}

export default Login
