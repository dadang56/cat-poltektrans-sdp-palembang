import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useSettings } from '../../contexts/SettingsContext'
import {
    Award,
    Search,
    Filter,
    Printer,
    Clock,
    CheckCircle,
    XCircle,
    Eye,
    Download,
    Calendar
} from 'lucide-react'
import '../admin/Dashboard.css'

// LocalStorage keys
const EXAM_RESULTS_KEY = 'cat_exam_results'
const MATKUL_KEY = 'cat_matkul_data'
const JADWAL_KEY = 'cat_jadwal_data'
const USERS_KEY = 'cat_users_data'

function HasilUjianPage() {
    const { user } = useAuth()
    const { settings } = useSettings()
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [selectedResult, setSelectedResult] = useState(null)
    const [hasilUjian, setHasilUjian] = useState([])

    // Get semester and Ka.Prodi info from settings
    const academicYear = settings?.academicYear || '2025/2026'
    const semester = settings?.semester || 'Ganjil'
    const kaprodiInfo = JSON.parse(localStorage.getItem(`kaprodiInfo_${user?.prodiId || 'default'}`) || '{"nama":"","nip":""}')

    // Load exam results from localStorage
    useEffect(() => {
        const examResults = localStorage.getItem(EXAM_RESULTS_KEY)
        const matkulData = localStorage.getItem(MATKUL_KEY)
        const jadwalData = localStorage.getItem(JADWAL_KEY)
        const usersData = localStorage.getItem(USERS_KEY)

        const matkul = matkulData ? JSON.parse(matkulData) : []
        const jadwal = jadwalData ? JSON.parse(jadwalData) : []
        const users = usersData ? JSON.parse(usersData) : []

        if (examResults && user?.id) {
            const results = JSON.parse(examResults)
            // Filter only this mahasiswa's results using String comparison
            const myResults = results
                .filter(r => String(r.mahasiswaId) === String(user.id))
                .map(r => {
                    // Link through jadwal to get matkulId and tipeUjian
                    const examJadwal = jadwal.find(j => String(j.id) === String(r.examId))
                    const matkulId = examJadwal?.matkulId
                    const matkulItem = matkul.find(m => m.id === matkulId)
                    const dosen = users.find(u => u.id === examJadwal?.dosenId)

                    // Calculate percentage score
                    const percentScore = r.maxScore > 0 ? Math.round((r.totalScore / r.maxScore) * 100) : null
                    const tipeUjian = examJadwal?.tipeUjian || 'UAS'

                    return {
                        id: r.id,
                        name: r.examName || `${tipeUjian} ${matkulItem?.nama || 'Ujian'}`,
                        matkul: matkulItem?.nama || r.matkulName || '-',
                        dosen: dosen?.nama || dosen?.name || 'Dosen',
                        date: examJadwal?.tanggal || r.submittedAt?.split('T')[0] || '-',
                        type: tipeUjian,
                        totalQuestions: r.answers?.length || 0,
                        correctAnswers: r.answers?.filter(a => a.isCorrect).length || null,
                        score: percentScore,
                        status: r.isFullyCorrected ? 'graded' : 'pending',
                        rawScore: r.totalScore,
                        maxScore: r.maxScore
                    }
                })
            setHasilUjian(myResults)
        }
    }, [user])

    const filteredResults = hasilUjian.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.matkul.toLowerCase().includes(search.toLowerCase())
        const matchesType = typeFilter === 'all' || item.type === typeFilter
        const matchesStatus = statusFilter === 'all' || item.status === statusFilter
        return matchesSearch && matchesType && matchesStatus
    })

    const getStatusBadge = (status) => {
        if (status === 'graded') {
            return <span className="badge badge-success"><CheckCircle size={12} /> Dinilai</span>
        }
        return <span className="badge badge-warning"><Clock size={12} /> Belum Dinilai</span>
    }

    const getScoreColor = (score) => {
        if (score === null) return ''
        if (score >= 80) return 'score-excellent'
        if (score >= 70) return 'score-good'
        if (score >= 60) return 'score-average'
        return 'score-poor'
    }

    const handlePrint = (result) => {
        const printWindow = window.open('', '_blank')
        printWindow.document.write(`
            <html>
            <head>
                <title>Hasil Ujian - ${result.name}</title>
                <style>
                    body { font-family: 'Times New Roman', serif; padding: 40px; }
                    h1 { text-align: center; margin-bottom: 5px; font-size: 18px; }
                    h2 { text-align: center; font-size: 14px; color: #666; margin-bottom: 30px; }
                    .info-section { margin-bottom: 30px; }
                    .info-row { display: flex; margin-bottom: 10px; }
                    .info-label { width: 150px; font-weight: bold; }
                    .info-value { flex: 1; }
                    .score-section { text-align: center; margin: 30px 0; padding: 20px; border: 2px solid #333; }
                    .score-value { font-size: 48px; font-weight: bold; color: ${result.score >= 70 ? '#22c55e' : '#ef4444'}; }
                    .score-label { font-size: 14px; color: #666; }
                    .grade-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    .grade-table th, .grade-table td { border: 1px solid #ccc; padding: 10px; text-align: center; }
                    .grade-table th { background: #f0f0f0; }
                    .footer { margin-top: 50px; text-align: right; }
                    .signature { margin-top: 60px; }
                </style>
            </head>
            <body>
                <h1>HASIL UJIAN</h1>
                <h2>POLTEKTRANS SDP PALEMBANG</h2>
                
                <div class="info-section">
                    <div class="info-row"><div class="info-label">Nama Mahasiswa</div><div class="info-value">: ${user?.name || user?.nama}</div></div>
                    <div class="info-row"><div class="info-label">NIM</div><div class="info-value">: ${user?.nim}</div></div>
                    <div class="info-row"><div class="info-label">Mata Kuliah</div><div class="info-value">: ${result.matkul}</div></div>
                    <div class="info-row"><div class="info-label">Jenis Ujian</div><div class="info-value">: ${result.name}</div></div>
                    <div class="info-row"><div class="info-label">Tanggal Ujian</div><div class="info-value">: ${result.date}</div></div>
                    <div class="info-row"><div class="info-label">Dosen Pengampu</div><div class="info-value">: ${result.dosen}</div></div>
                </div>
                
                ${result.status === 'graded' ? `
                    <div class="score-section">
                        <div class="score-value">${result.score}</div>
                        <div class="score-label">NILAI UJIAN</div>
                    </div>
                    
                    ${result.nak !== null ? `
                        <table class="grade-table">
                            <thead>
                                <tr>
                                    <th>NT (10%)</th>
                                    <th>NUTS (${result.np !== null ? '20%' : '30%'})</th>
                                    ${result.np !== null ? '<th>NP (20%)</th>' : ''}
                                    <th>UAS (${result.np !== null ? '50%' : '60%'})</th>
                                    <th>NAK</th>
                                    <th>NH</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>${result.nt ?? '-'}</td>
                                    <td>${result.nuts ?? '-'}</td>
                                    ${result.np !== null ? `<td>${result.np}</td>` : ''}
                                    <td>${result.uas ?? '-'}</td>
                                    <td><strong>${result.nak?.toFixed(1) ?? '-'}</strong></td>
                                    <td><strong>${result.nh ?? '-'}</strong></td>
                                </tr>
                            </tbody>
                        </table>
                    ` : ''}
                ` : `
                    <div class="score-section">
                        <div class="score-value" style="color: #f59e0b;">-</div>
                        <div class="score-label">BELUM DINILAI</div>
                    </div>
                `}
                
                <div class="footer">
                    <p>Palembang, ${new Date().toLocaleDateString('id-ID')}</p>
                    <p>Dosen Pengampu,</p>
                    <div class="signature">
                        <p>${result.dosen}</p>
                    </div>
                </div>
            </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.print()
    }

    const handlePrintAll = () => {
        const gradedResults = hasilUjian.filter(r => r.status === 'graded')
        if (gradedResults.length === 0) {
            alert('Tidak ada hasil ujian yang sudah dinilai.')
            return
        }

        const printWindow = window.open('', '_blank')
        printWindow.document.write(`
            <html>
            <head>
                <title>Rekap Hasil Ujian - ${user?.name || user?.nama}</title>
                <style>
                    body { font-family: 'Times New Roman', serif; padding: 40px; }
                    h1 { text-align: center; margin-bottom: 5px; font-size: 18px; }
                    h2 { text-align: center; font-size: 14px; color: #666; margin-bottom: 30px; }
                    .info-section { margin-bottom: 30px; }
                    .info-row { display: flex; margin-bottom: 8px; }
                    .info-label { width: 150px; font-weight: bold; }
                    .info-value { flex: 1; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ccc; padding: 10px; text-align: center; }
                    th { background: #3b679f; color: white; }
                    tr:nth-child(even) { background: #f5f5f5; }
                    .passing { color: #22c55e; font-weight: bold; }
                    .failing { color: #ef4444; font-weight: bold; }
                    .summary { margin-top: 30px; padding: 20px; background: #f0f8ff; border-radius: 8px; }
                    .footer { margin-top: 50px; text-align: right; }
                    .signature { margin-top: 60px; }
                </style>
            </head>
            <body>
                <h1>REKAP HASIL UJIAN</h1>
                <h2>POLTEKTRANS SDP PALEMBANG</h2>
                
                <div class="info-section">
                    <div class="info-row"><div class="info-label">Nama Mahasiswa</div><div class="info-value">: ${user?.name || user?.nama}</div></div>
                    <div class="info-row"><div class="info-label">NIM</div><div class="info-value">: ${user?.nim}</div></div>
                    <div class="info-row"><div class="info-label">Semester</div><div class="info-value">: ${semester} ${academicYear}</div></div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>Mata Kuliah</th>
                            <th>Jenis Ujian</th>
                            <th>Tanggal</th>
                            <th>Dosen</th>
                            <th>Nilai</th>
                            <th>NAK</th>
                            <th>NH</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${gradedResults.map((r, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td style="text-align: left;">${r.matkul}</td>
                                <td>${r.type}</td>
                                <td>${r.date}</td>
                                <td style="text-align: left;">${r.dosen}</td>
                                <td class="${r.score >= 70 ? 'passing' : 'failing'}">${r.score}</td>
                                <td>${r.nak?.toFixed(1) ?? '-'}</td>
                                <td><strong>${r.nh ?? '-'}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="summary">
                    <strong>Ringkasan:</strong><br>
                    Total Ujian Dinilai: ${gradedResults.length}<br>
                    Rata-rata Nilai: ${(gradedResults.reduce((sum, r) => sum + (r.score || 0), 0) / gradedResults.length).toFixed(1)}
                </div>
                
                <div class="footer">
                    <p>Palembang, ${new Date().toLocaleDateString('id-ID')}</p>
                    <p>Ka. Prodi,</p>
                    <div class="signature">
                        <p><strong>${kaprodiInfo.nama || '_________________________'}</strong></p>
                        <p>NIP. ${kaprodiInfo.nip || '_______________'}</p>
                    </div>
                </div>
            </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.print()
    }

    // Stats
    const stats = {
        total: hasilUjian.length,
        graded: hasilUjian.filter(r => r.status === 'graded').length,
        pending: hasilUjian.filter(r => r.status === 'pending').length,
        average: hasilUjian.filter(r => r.score !== null).length > 0
            ? Math.round(hasilUjian.filter(r => r.score !== null).reduce((sum, r) => sum + r.score, 0) /
                hasilUjian.filter(r => r.score !== null).length)
            : 0
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Hasil Ujian</h1>
                        <p className="page-subtitle">Lihat hasil ujian yang telah Anda ikuti</p>
                    </div>
                    <button className="btn btn-primary" onClick={handlePrintAll}>
                        <Printer size={16} />
                        Cetak Semua Hasil
                    </button>
                </div>

                {/* Stats */}
                <div className="mini-stats">
                    <div className="mini-stat">
                        <span className="mini-stat-value">{stats.total}</span>
                        <span className="mini-stat-label">Total Ujian</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">{stats.graded}</span>
                        <span className="mini-stat-label">Sudah Dinilai</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">{stats.pending}</span>
                        <span className="mini-stat-label">Menunggu Nilai</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">{stats.average}</span>
                        <span className="mini-stat-label">Rata-rata</span>
                    </div>
                </div>

                {/* Filters */}
                <div className="card mb-4">
                    <div className="card-body">
                        <div className="filters-row">
                            <div className="search-box">
                                <Search size={18} className="search-icon" />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Cari ujian..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            <div className="filter-group">
                                <Filter size={16} />
                                <select
                                    className="form-input"
                                    value={typeFilter}
                                    onChange={e => setTypeFilter(e.target.value)}
                                >
                                    <option value="all">Semua Jenis</option>
                                    <option value="UTS">UTS</option>
                                    <option value="UAS">UAS</option>
                                </select>
                            </div>
                            <div className="filter-group">
                                <select
                                    className="form-input"
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value)}
                                >
                                    <option value="all">Semua Status</option>
                                    <option value="graded">Sudah Dinilai</option>
                                    <option value="pending">Belum Dinilai</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results List */}
                <div className="card">
                    <div className="card-body">
                        <div className="results-list">
                            {filteredResults.map(result => (
                                <div key={result.id} className="result-card">
                                    <div className="result-main">
                                        <div className="result-info">
                                            <div className="result-header">
                                                <span className={`badge badge-${result.type === 'UTS' ? 'primary' : result.type === 'UAS' ? 'error' : 'info'}`}>
                                                    {result.type}
                                                </span>
                                                {getStatusBadge(result.status)}
                                            </div>
                                            <h4 className="result-name">{result.name}</h4>
                                            <p className="result-matkul">{result.matkul} • {result.dosen}</p>
                                            <div className="result-meta">
                                                <span><Calendar size={14} /> {result.date}</span>
                                            </div>
                                        </div>
                                        <div className="result-score-section">
                                            {result.status === 'graded' ? (
                                                <div className={`result-score ${getScoreColor(result.score)}`}>
                                                    <span className="score-number">{result.score}</span>
                                                    <span className="score-label">Nilai</span>
                                                </div>
                                            ) : (
                                                <div className="result-score score-pending">
                                                    <Clock size={24} />
                                                    <span className="score-label">Menunggu</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="result-actions">
                                        {result.status === 'graded' && (
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => handlePrint(result)}
                                            >
                                                <Printer size={14} />
                                                Cetak Hasil
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {filteredResults.length === 0 && (
                                <div className="empty-state">
                                    <Award size={48} />
                                    <h3>Tidak ada hasil ujian</h3>
                                    <p>Belum ada ujian yang Anda ikuti</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .mb-4 {
                    margin-bottom: var(--space-4);
                }
                .results-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4);
                }
                .result-card {
                    padding: var(--space-4);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--border-color);
                }
                .result-main {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: var(--space-4);
                }
                .result-info {
                    flex: 1;
                }
                .result-header {
                    display: flex;
                    gap: var(--space-2);
                    margin-bottom: var(--space-2);
                }
                .result-name {
                    font-size: var(--font-size-lg);
                    font-weight: var(--font-semibold);
                    margin-bottom: var(--space-1);
                }
                .result-matkul {
                    font-size: var(--font-size-sm);
                    color: var(--text-secondary);
                    margin-bottom: var(--space-2);
                }
                .result-meta {
                    display: flex;
                    gap: var(--space-3);
                    font-size: var(--font-size-sm);
                    color: var(--text-muted);
                }
                .result-meta span {
                    display: flex;
                    align-items: center;
                    gap: var(--space-1);
                }
                .result-score-section {
                    display: flex;
                    align-items: center;
                }
                .result-score {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-width: 80px;
                    padding: var(--space-3);
                    border-radius: var(--radius-lg);
                    text-align: center;
                }
                .score-number {
                    font-size: var(--font-size-2xl);
                    font-weight: var(--font-bold);
                }
                .score-label {
                    font-size: var(--font-size-xs);
                    text-transform: uppercase;
                }
                .score-excellent {
                    background: var(--success-100);
                    color: var(--success-700);
                }
                .score-good {
                    background: var(--primary-100);
                    color: var(--primary-700);
                }
                .score-average {
                    background: var(--warning-100);
                    color: var(--warning-700);
                }
                .score-poor {
                    background: var(--error-100);
                    color: var(--error-700);
                }
                .score-pending {
                    background: var(--bg-secondary);
                    color: var(--text-muted);
                }
                .result-actions {
                    display: flex;
                    gap: var(--space-2);
                    margin-top: var(--space-3);
                    padding-top: var(--space-3);
                    border-top: 1px solid var(--border-color);
                }
                .empty-state {
                    text-align: center;
                    padding: var(--space-8);
                    color: var(--text-muted);
                }
                .empty-state svg {
                    margin-bottom: var(--space-4);
                    opacity: 0.5;
                }
                .empty-state h3 {
                    margin-bottom: var(--space-2);
                    color: var(--text-secondary);
                }
            `}</style>
        </DashboardLayout>
    )
}

export default HasilUjianPage
