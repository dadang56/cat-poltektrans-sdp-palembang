import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useSettings } from '../../contexts/SettingsContext'
import { userService, nilaiPusbangkatarService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    Users, ClipboardCheck, Award, TrendingUp, ChevronRight, BarChart3, Calendar
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

function PusbangkatarDashboard() {
    const { user } = useAuth()
    const { settings, saveSettings } = useSettings()
    const [tahunAkademik, setTahunAkademik] = useState('')
    const [stats, setStats] = useState({
        totalMahasiswa: 0,
        nilaiKonditeCount: 0,
        nilaiSemaptaCount: 0
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (settings?.tahunAkademik) setTahunAkademik(settings.tahunAkademik)
        else if (TA_OPTIONS.length > 0) setTahunAkademik(TA_OPTIONS[0])
    }, [settings])

    useEffect(() => {
        if (!tahunAkademik) return
        loadStats()
    }, [tahunAkademik])

    const handleTAChange = (ta) => {
        setTahunAkademik(ta)
        saveSettings({ ...settings, tahunAkademik: ta })
    }

    const loadStats = async () => {
        setLoading(true)
        try {
            if (isSupabaseConfigured()) {
                const [mahasiswa, nilaiData] = await Promise.all([
                    userService.getByRole('mahasiswa'),
                    nilaiPusbangkatarService.getByTA(tahunAkademik)
                ])
                const withNK = nilaiData.filter(n => n.nilai_kondite !== null && n.nilai_kondite !== undefined)
                const withNS = nilaiData.filter(n => n.nilai_semapta !== null && n.nilai_semapta !== undefined)
                setStats({
                    totalMahasiswa: mahasiswa.length,
                    nilaiKonditeCount: withNK.length,
                    nilaiSemaptaCount: withNS.length
                })
            }
        } catch (error) {
            console.error('Error loading stats:', error)
        } finally {
            setLoading(false)
        }
    }

    const pctNK = stats.totalMahasiswa > 0 ? Math.round((stats.nilaiKonditeCount / stats.totalMahasiswa) * 100) : 0
    const pctNS = stats.totalMahasiswa > 0 ? Math.round((stats.nilaiSemaptaCount / stats.totalMahasiswa) * 100) : 0
    const pctTotal = stats.totalMahasiswa > 0
        ? Math.round((stats.nilaiKonditeCount + stats.nilaiSemaptaCount) / (stats.totalMahasiswa * 2) * 100)
        : 0

    const statCards = [
        { label: 'Total Mahasiswa', value: stats.totalMahasiswa, icon: Users, color: '#2563eb', bg: '#eff6ff' },
        { label: 'Sudah Dinilai NK', value: stats.nilaiKonditeCount, icon: ClipboardCheck, color: '#059669', bg: '#ecfdf5', pct: pctNK },
        { label: 'Sudah Dinilai NS', value: stats.nilaiSemaptaCount, icon: Award, color: '#d97706', bg: '#fffbeb', pct: pctNS },
        { label: 'Kelengkapan', value: `${pctTotal}%`, icon: TrendingUp, color: '#7c3aed', bg: '#f5f3ff' }
    ]

    return (
        <DashboardLayout>
            <div className="pb-dashboard animate-fadeIn">
                <div className="pb-header">
                    <div>
                        <h1 className="pb-title">📊 Dashboard Pusbangkatar</h1>
                        <p className="pb-subtitle">Selamat datang, <strong>{user?.nama || 'Admin Pusbangkatar'}</strong></p>
                    </div>
                    <div className="pb-ta-selector">
                        <Calendar size={16} />
                        <select value={tahunAkademik} onChange={e => handleTAChange(e.target.value)} className="pb-ta-select">
                            {TA_OPTIONS.map(ta => <option key={ta} value={ta}>{ta}</option>)}
                        </select>
                    </div>
                </div>

                {/* Stats cards */}
                <div className="pb-stats-grid">
                    {statCards.map((stat, idx) => (
                        <div key={idx} className="pb-stat-card" style={{ '--card-color': stat.color, '--card-bg': stat.bg }}>
                            <div className="pb-stat-icon-wrap">
                                <stat.icon size={22} />
                            </div>
                            <div className="pb-stat-body">
                                <span className="pb-stat-value">{loading ? '...' : stat.value}</span>
                                <span className="pb-stat-label">{stat.label}</span>
                                {stat.pct !== undefined && !loading && (
                                    <div className="pb-stat-progress">
                                        <div className="pb-stat-progress-bar">
                                            <div className="pb-stat-progress-fill" style={{ width: `${stat.pct}%` }} />
                                        </div>
                                        <span className="pb-stat-pct">{stat.pct}%</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Overall progress */}
                <div className="pb-overview-card">
                    <div className="pb-overview-header">
                        <BarChart3 size={20} />
                        <h3>Progress Penilaian — {tahunAkademik}</h3>
                    </div>
                    <div className="pb-overview-bars">
                        <div className="pb-bar-item">
                            <div className="pb-bar-label">
                                <span>Nilai Kondite</span>
                                <span className="pb-bar-count">{loading ? '...' : `${stats.nilaiKonditeCount}/${stats.totalMahasiswa}`}</span>
                            </div>
                            <div className="pb-bar-track">
                                <div className="pb-bar-fill pb-bar-green" style={{ width: `${pctNK}%` }} />
                            </div>
                        </div>
                        <div className="pb-bar-item">
                            <div className="pb-bar-label">
                                <span>Nilai Kesamaptaan</span>
                                <span className="pb-bar-count">{loading ? '...' : `${stats.nilaiSemaptaCount}/${stats.totalMahasiswa}`}</span>
                            </div>
                            <div className="pb-bar-track">
                                <div className="pb-bar-fill pb-bar-amber" style={{ width: `${pctNS}%` }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick actions */}
                <h2 className="pb-section-title">Menu Utama</h2>
                <div className="pb-action-grid">
                    <a href="/pusbangkatar/nilai-kondite" className="pb-action-card">
                        <div className="pb-action-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                            <ClipboardCheck size={28} />
                        </div>
                        <div className="pb-action-body">
                            <strong>Input Nilai Kondite</strong>
                            <span>Kelola nilai kondite mahasiswa (0-4)</span>
                        </div>
                        <ChevronRight size={18} className="pb-action-arrow" />
                    </a>
                    <a href="/pusbangkatar/nilai-semapta" className="pb-action-card">
                        <div className="pb-action-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
                            <Award size={28} />
                        </div>
                        <div className="pb-action-body">
                            <strong>Input Nilai Kesamaptaan</strong>
                            <span>Kelola nilai kesamaptaan mahasiswa (0-4)</span>
                        </div>
                        <ChevronRight size={18} className="pb-action-arrow" />
                    </a>
                </div>
            </div>

            <style>{`
                .pb-dashboard { max-width: 1000px; margin: 0 auto; }
                .pb-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }
                .pb-title { font-size: 1.5rem; font-weight: 700; color: var(--color-text); margin: 0; }
                .pb-subtitle { font-size: 0.9rem; color: var(--text-muted, #6b7280); margin: 0.25rem 0 0; }
                .pb-subtitle strong { color: var(--color-text); }
                .pb-ta-selector { display: flex; align-items: center; gap: 0.5rem; }
                .pb-ta-select { padding: 0.5rem 0.75rem; border: 1px solid var(--color-border); border-radius: 0.5rem; background: var(--color-surface); color: var(--color-text); font-size: 0.8125rem; min-width: 180px; }

                .pb-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
                .pb-stat-card { display: flex; align-items: flex-start; gap: 0.875rem; padding: 1.25rem; background: var(--color-surface, white); border: 1px solid var(--color-border, #e5e7eb); border-radius: 0.875rem; transition: all 0.3s; }
                .pb-stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.06); }
                .pb-stat-icon-wrap { width: 44px; height: 44px; border-radius: 0.75rem; display: flex; align-items: center; justify-content: center; background: var(--card-bg); color: var(--card-color); flex-shrink: 0; }
                .pb-stat-body { flex: 1; display: flex; flex-direction: column; }
                .pb-stat-value { font-size: 1.5rem; font-weight: 800; color: var(--card-color); line-height: 1.2; }
                .pb-stat-label { font-size: 0.75rem; color: var(--text-muted, #6b7280); margin-top: 0.125rem; }
                .pb-stat-progress { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
                .pb-stat-progress-bar { flex: 1; height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden; }
                .pb-stat-progress-fill { height: 100%; background: var(--card-color); border-radius: 2px; transition: width 0.6s ease; }
                .pb-stat-pct { font-size: 0.6875rem; font-weight: 700; color: var(--card-color); }

                .pb-overview-card { background: var(--color-surface, white); border: 1px solid var(--color-border, #e5e7eb); border-radius: 0.875rem; padding: 1.25rem; margin-bottom: 2rem; }
                .pb-overview-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; color: var(--color-text); }
                .pb-overview-header h3 { font-size: 1rem; font-weight: 600; margin: 0; }
                .pb-overview-bars { display: flex; flex-direction: column; gap: 1rem; }
                .pb-bar-item { display: flex; flex-direction: column; gap: 0.375rem; }
                .pb-bar-label { display: flex; justify-content: space-between; font-size: 0.8125rem; color: var(--color-text); }
                .pb-bar-count { font-weight: 600; color: var(--text-muted); font-size: 0.75rem; }
                .pb-bar-track { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
                .pb-bar-fill { height: 100%; border-radius: 4px; transition: width 0.8s ease; }
                .pb-bar-green { background: linear-gradient(90deg, #059669, #34d399); }
                .pb-bar-amber { background: linear-gradient(90deg, #d97706, #fbbf24); }

                .pb-section-title { font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem; color: var(--color-text); }

                .pb-action-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
                .pb-action-card { display: flex; align-items: center; gap: 1rem; padding: 1.25rem; background: var(--color-surface, white); border: 1px solid var(--color-border, #e5e7eb); border-radius: 0.875rem; text-decoration: none; color: var(--color-text); transition: all 0.3s; }
                .pb-action-card:hover { border-color: var(--color-primary, #2563eb); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
                .pb-action-icon { width: 52px; height: 52px; border-radius: 0.75rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .pb-action-body { flex: 1; display: flex; flex-direction: column; gap: 0.125rem; }
                .pb-action-body strong { font-size: 0.9375rem; }
                .pb-action-body span { font-size: 0.75rem; color: var(--text-muted, #6b7280); }
                .pb-action-arrow { color: var(--text-muted, #9ca3af); transition: transform 0.2s; }
                .pb-action-card:hover .pb-action-arrow { transform: translateX(4px); color: var(--color-primary); }

                @media (max-width: 768px) {
                    .pb-header { flex-direction: column; }
                    .pb-stats-grid { grid-template-columns: repeat(2, 1fr); }
                    .pb-action-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </DashboardLayout>
    )
}

export default PusbangkatarDashboard
