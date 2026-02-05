import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { userService, prodiService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    Users,
    ClipboardCheck,
    Award,
    TrendingUp
} from 'lucide-react'
import '../admin/Dashboard.css'

function PusbangkatarDashboard() {
    const { user } = useAuth()
    const [stats, setStats] = useState({
        totalMahasiswa: 0,
        nilaiKonditeCount: 0,
        nilaiSemaptaCount: 0
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadStats = async () => {
            try {
                if (isSupabaseConfigured()) {
                    const mahasiswa = await userService.getByRole('mahasiswa')
                    const withNK = mahasiswa.filter(m => m.nilai_kondite !== null)
                    const withNS = mahasiswa.filter(m => m.nilai_semapta !== null)

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
        loadStats()
    }, [])

    const statCards = [
        {
            label: 'Total Mahasiswa',
            value: stats.totalMahasiswa,
            icon: Users,
            color: 'primary'
        },
        {
            label: 'Sudah Dinilai NK',
            value: stats.nilaiKonditeCount,
            icon: ClipboardCheck,
            color: 'success'
        },
        {
            label: 'Sudah Dinilai NS',
            value: stats.nilaiSemaptaCount,
            icon: Award,
            color: 'warning'
        },
        {
            label: 'Persentase Lengkap',
            value: stats.totalMahasiswa > 0
                ? `${Math.round((stats.nilaiKonditeCount + stats.nilaiSemaptaCount) / (stats.totalMahasiswa * 2) * 100)}%`
                : '0%',
            icon: TrendingUp,
            color: 'info'
        }
    ]

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <h1 className="page-title">Dashboard Pusbangkatar</h1>
                    <p className="page-subtitle">Selamat datang, {user?.nama || 'Admin Pusbangkatar'}</p>
                </div>

                <div className="stats-grid">
                    {statCards.map((stat, idx) => (
                        <div key={idx} className={`stat-card stat-card-${stat.color}`}>
                            <div className="stat-icon">
                                <stat.icon size={24} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-value">{loading ? '...' : stat.value}</span>
                                <span className="stat-label">{stat.label}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="quick-actions">
                    <h2>Menu Utama</h2>
                    <div className="action-grid">
                        <a href="/pusbangkatar/nilai-kondite" className="action-card">
                            <ClipboardCheck size={32} />
                            <span>Input Nilai Kondite</span>
                        </a>
                        <a href="/pusbangkatar/nilai-semapta" className="action-card">
                            <Award size={32} />
                            <span>Input Nilai Semapta</span>
                        </a>
                    </div>
                </div>
            </div>

            <style>{`
                .quick-actions {
                    margin-top: 2rem;
                }
                .quick-actions h2 {
                    font-size: 1.25rem;
                    margin-bottom: 1rem;
                    color: var(--color-text);
                }
                .action-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                }
                .action-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                    padding: 1.5rem;
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: 1rem;
                    text-decoration: none;
                    color: var(--color-text);
                    transition: all 0.3s ease;
                }
                .action-card:hover {
                    border-color: var(--color-primary);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px var(--shadow-color);
                }
                .action-card svg {
                    color: var(--color-primary);
                }
            `}</style>
        </DashboardLayout>
    )
}

export default PusbangkatarDashboard
