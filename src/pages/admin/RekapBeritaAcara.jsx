import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { exportToXLSX } from '../../utils/excelUtils'
import { beritaAcaraService, prodiService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    FileText,
    Search,
    Download,
    Printer,
    Filter,
    Calendar,
    Eye,
    FileSpreadsheet,
    Loader2
} from 'lucide-react'
import '../admin/Dashboard.css'

// LocalStorage keys (fallback)
const BERITA_ACARA_KEY = 'cat_berita_acara_data'
const PRODI_KEY = 'cat_prodi_data'

function RekapBeritaAcaraPage() {
    const { user } = useAuth()
    const [search, setSearch] = useState('')
    const [prodiFilter, setProdiFilter] = useState(user?.prodi_id || 'all')
    const [dateFilter, setDateFilter] = useState('')
    const [viewModal, setViewModal] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Data from Supabase or localStorage
    const [beritaAcaraData, setBeritaAcaraData] = useState([])
    const [prodiList, setProdiList] = useState([])

    // Load data from Supabase or fallback to localStorage
    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            setError(null)

            try {
                if (isSupabaseConfigured()) {
                    // Load from Supabase
                    const [baData, prodi] = await Promise.all([
                        beritaAcaraService.getAll(),
                        prodiService.getAll()
                    ])

                    // Transform berita acara data to match expected format
                    const transformedData = baData.map(item => ({
                        id: item.id,
                        examName: item.jadwal?.matkul?.nama || 'Unknown',
                        room: item.jadwal?.ruangan?.nama || '-',
                        date: item.jadwal?.tanggal || '',
                        time: `${item.jadwal?.waktu_mulai || ''} - ${item.jadwal?.waktu_selesai || ''}`,
                        pengawas: item.pengawas?.nama || '-',
                        nip: item.pengawas?.nim_nip || '-',
                        prodiId: item.jadwal?.kelas?.prodi_id,
                        attendance: {
                            total: (item.jumlah_hadir || 0) + (item.jumlah_tidak_hadir || 0),
                            hadir: item.jumlah_hadir || 0,
                            sakit: 0,
                            izin: 0,
                            alpha: item.jumlah_tidak_hadir || 0
                        },
                        incidents: item.catatan || 'Tidak ada kejadian',
                        notes: item.catatan || '',
                        createdAt: new Date(item.created_at).toLocaleDateString('id-ID')
                    }))

                    setBeritaAcaraData(transformedData)
                    setProdiList(prodi)
                } else {
                    // Fallback to localStorage
                    const baData = localStorage.getItem(BERITA_ACARA_KEY)
                    const prodiData = localStorage.getItem(PRODI_KEY)

                    if (prodiData) setProdiList(JSON.parse(prodiData))
                    if (baData) setBeritaAcaraData(JSON.parse(baData))
                }
            } catch (err) {
                console.error('Error loading data:', err)
                setError('Gagal memuat data dari Supabase. Menggunakan data lokal.')

                // Fallback to localStorage on error
                const baData = localStorage.getItem(BERITA_ACARA_KEY)
                const prodiData = localStorage.getItem(PRODI_KEY)
                if (prodiData) setProdiList(JSON.parse(prodiData))
                if (baData) setBeritaAcaraData(JSON.parse(baData))
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [])

    // Filter based on admin prodi or show all for superadmin
    const filteredData = beritaAcaraData.filter(item => {
        const matchesProdi = user?.role === 'superadmin'
            ? (prodiFilter === 'all' || item.prodiId === prodiFilter)
            : item.prodiId === user?.prodi_id  // Fixed: was user?.prodiId
        const matchesSearch = item.examName.toLowerCase().includes(search.toLowerCase()) ||
            item.pengawas.toLowerCase().includes(search.toLowerCase())
        const matchesDate = !dateFilter || item.date === dateFilter
        return matchesProdi && matchesSearch && matchesDate
    })

    const getProdiName = (prodiId) => {
        return prodiList.find(p => p.id === prodiId)?.kode || '-'
    }

    const handleExportExcel = () => {
        // Export data in XLSX format
        const exportData = filteredData.map(item => ({
            ujian: item.examName,
            ruang: item.room,
            tanggal: item.date,
            waktu: item.time,
            pengawas: item.pengawas,
            nip: item.nip,
            total: item.attendance?.total || 0,
            hadir: item.attendance?.hadir || 0,
            sakit: item.attendance?.sakit || 0,
            izin: item.attendance?.izin || 0,
            alpha: item.attendance?.alpha || 0,
            kejadian: item.incidents,
            catatan: item.notes,
            dibuat: item.createdAt
        }))

        const headers = [
            { key: 'ujian', label: 'Ujian' },
            { key: 'ruang', label: 'Ruang' },
            { key: 'tanggal', label: 'Tanggal' },
            { key: 'waktu', label: 'Waktu' },
            { key: 'pengawas', label: 'Pengawas' },
            { key: 'nip', label: 'NIP' },
            { key: 'total', label: 'Total' },
            { key: 'hadir', label: 'Hadir' },
            { key: 'sakit', label: 'Sakit' },
            { key: 'izin', label: 'Izin' },
            { key: 'alpha', label: 'Alpha' },
            { key: 'kejadian', label: 'Kejadian' },
            { key: 'catatan', label: 'Catatan' },
            { key: 'dibuat', label: 'Dibuat' }
        ]

        exportToXLSX(exportData, headers, `rekap_berita_acara_${dateFilter || 'all'}_${new Date().toISOString().split('T')[0]}`, 'Berita Acara')
    }

    const handlePrintAll = () => {
        const printWindow = window.open('', '_blank')
        printWindow.document.write(`
            <html>
            <head>
                <title>Rekap Berita Acara</title>
                <style>
                    body { font-family: 'Times New Roman', serif; padding: 20px; }
                    h1 { text-align: center; margin-bottom: 10px; }
                    .subtitle { text-align: center; color: #666; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                    th { background: #f0f0f0; }
                </style>
            </head>
            <body>
                <h1>Rekap Berita Acara Ujian</h1>
                <p class="subtitle">Tanggal: ${dateFilter || 'Semua Tanggal'} | Dicetak: ${new Date().toLocaleDateString('id-ID')}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Ujian</th>
                            <th>Ruang</th>
                            <th>Tanggal</th>
                            <th>Waktu</th>
                            <th>Pengawas</th>
                            <th>Kejadian</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredData.map(item => `
                            <tr>
                                <td>${item.examName}</td>
                                <td>${item.room}</td>
                                <td>${item.date}</td>
                                <td>${item.time}</td>
                                <td>${item.pengawas}</td>
                                <td>${item.incidents?.includes('Tidak ada') ? 'Normal' : item.incidents}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.print()
    }

    const handlePrintSingle = (item) => {
        const printWindow = window.open('', '_blank')
        printWindow.document.write(`
            <html>
            <head>
                <title>Berita Acara - ${item.examName}</title>
                <style>
                    body { font-family: 'Times New Roman', serif; padding: 40px; }
                    h1 { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                    .section { margin-bottom: 20px; }
                    .section h3 { margin-bottom: 10px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                    .field { margin-bottom: 8px; }
                    .field .label { font-weight: bold; color: #666; }
                    .summary { display: flex; gap: 20px; margin: 20px 0; }
                    .summary-item { padding: 10px 20px; border: 1px solid #ccc; text-align: center; }
                    .summary-item .value { font-size: 20px; font-weight: bold; }
                    .summary-item .label { font-size: 11px; color: #666; }
                    .signature { margin-top: 40px; display: flex; justify-content: flex-end; }
                    .signature-box { text-align: center; width: 200px; }
                    .signature-line { border-bottom: 1px solid #333; margin: 60px 0 10px; }
                </style>
            </head>
            <body>
                <h1>BERITA ACARA UJIAN</h1>
                
                <div class="section">
                    <h3>Informasi Ujian</h3>
                    <div class="grid">
                        <div class="field"><span class="label">Nama Ujian:</span> ${item.examName}</div>
                        <div class="field"><span class="label">Ruang:</span> ${item.room}</div>
                        <div class="field"><span class="label">Tanggal:</span> ${item.date}</div>
                        <div class="field"><span class="label">Waktu:</span> ${item.time}</div>
                    </div>
                </div>

                <div class="section">
                    <h3>Rekapitulasi Kehadiran</h3>
                    <div class="summary">
                        <div class="summary-item"><div class="value">${item.attendance?.total || 0}</div><div class="label">Total Peserta</div></div>
                        <div class="summary-item"><div class="value">${item.attendance?.hadir || 0}</div><div class="label">Hadir</div></div>
                        <div class="summary-item"><div class="value">${item.attendance?.sakit || 0}</div><div class="label">Sakit</div></div>
                        <div class="summary-item"><div class="value">${item.attendance?.izin || 0}</div><div class="label">Izin</div></div>
                        <div class="summary-item"><div class="value">${item.attendance?.alpha || 0}</div><div class="label">Tanpa Keterangan</div></div>
                    </div>
                </div>

                <div class="section">
                    <h3>Catatan Kejadian</h3>
                    <p>${item.incidents || '-'}</p>
                </div>

                <div class="section">
                    <h3>Catatan Tambahan</h3>
                    <p>${item.notes || '-'}</p>
                </div>

                <div class="signature">
                    <div class="signature-box">
                        <p>Palembang, ${new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p>Pengawas Ujian,</p>
                        <div class="signature-line"></div>
                        <p><strong>${item.pengawas}</strong></p>
                        <p>NIP. ${item.nip}</p>
                    </div>
                </div>
            </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.print()
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Rekap Berita Acara</h1>
                        <p className="page-subtitle">Data berita acara ujian dari pengawas yang tersinkronisasi</p>
                    </div>
                    <div className="header-actions">
                        <button className="btn btn-secondary" onClick={handleExportExcel}>
                            <FileSpreadsheet size={18} />
                            Export Excel
                        </button>
                        <button className="btn btn-primary" onClick={handlePrintAll}>
                            <Printer size={18} />
                            Cetak Semua
                        </button>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="card mb-4">
                        <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                            <p style={{ marginTop: 'var(--space-2)', color: 'var(--text-muted)' }}>Memuat data...</p>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="card mb-4" style={{ borderColor: 'var(--warning-500)' }}>
                        <div className="card-body" style={{ color: 'var(--warning-700)', background: 'var(--warning-50)' }}>
                            ⚠️ {error}
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="card mb-4">
                    <div className="card-body">
                        <div className="filters-row">
                            <div className="search-box">
                                <Search size={18} className="search-icon" />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Cari ujian atau pengawas..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            {user?.role === 'superadmin' && (
                                <div className="filter-group">
                                    <Filter size={16} />
                                    <select
                                        className="form-input"
                                        value={prodiFilter}
                                        onChange={e => setProdiFilter(e.target.value)}
                                    >
                                        <option value="all">Semua Prodi</option>
                                        {prodiList.map(p => (
                                            <option key={p.id} value={p.id}>{p.kode}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="filter-group">
                                <Calendar size={16} />
                                <input
                                    type="date"
                                    className="form-input"
                                    value={dateFilter}
                                    onChange={e => setDateFilter(e.target.value)}
                                />
                                {dateFilter && (
                                    <button className="btn btn-ghost btn-sm" onClick={() => setDateFilter('')}>
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Data Table */}
                <div className="card">
                    <div className="card-body">
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Ujian</th>
                                        <th>Ruang</th>
                                        <th>Tanggal</th>
                                        <th>Pengawas</th>
                                        <th>Kejadian</th>
                                        <th>Dibuat</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.map(item => (
                                        <tr key={item.id}>
                                            <td>
                                                <div className="exam-name-cell">
                                                    <span className="font-medium">{item.examName}</span>
                                                    <span className="time-text">{item.time}</span>
                                                </div>
                                            </td>
                                            <td>{item.room}</td>
                                            <td>{item.date}</td>
                                            <td>{item.pengawas}</td>
                                            <td>
                                                <span className={`incident-badge ${item.incidents?.includes('Tidak ada') ? 'normal' : 'warning'}`}>
                                                    {item.incidents?.includes('Tidak ada') ? 'Normal' : 'Ada Catatan'}
                                                </span>
                                            </td>
                                            <td className="text-muted">{item.createdAt}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => setViewModal(item)}
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => handlePrintSingle(item)}
                                                    >
                                                        <Printer size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredData.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="text-center text-muted" style={{ padding: 'var(--space-8)' }}>
                                                Tidak ada data berita acara
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* View Modal */}
                {viewModal && (
                    <div className="modal-overlay" onClick={() => setViewModal(null)}>
                        <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Berita Acara Ujian</h3>
                                <button className="btn btn-icon btn-ghost" onClick={() => setViewModal(null)}>×</button>
                            </div>
                            <div className="modal-body">
                                <div className="ba-detail">
                                    <div className="ba-section">
                                        <h4>Informasi Ujian</h4>
                                        <div className="ba-grid">
                                            <div><strong>Nama Ujian:</strong> {viewModal.examName}</div>
                                            <div><strong>Ruang:</strong> {viewModal.room}</div>
                                            <div><strong>Tanggal:</strong> {viewModal.date}</div>
                                            <div><strong>Waktu:</strong> {viewModal.time}</div>
                                        </div>
                                    </div>

                                    <div className="ba-section">
                                        <h4>Kehadiran</h4>
                                        <div className="ba-attendance">
                                            <span>Total: <strong>{viewModal.attendance?.total || 0}</strong></span>
                                            <span>Hadir: <strong className="success">{viewModal.attendance?.hadir || 0}</strong></span>
                                            <span>Sakit: <strong>{viewModal.attendance?.sakit || 0}</strong></span>
                                            <span>Izin: <strong>{viewModal.attendance?.izin || 0}</strong></span>
                                            <span>Alpha: <strong className="error">{viewModal.attendance?.alpha || 0}</strong></span>
                                        </div>
                                    </div>

                                    <div className="ba-section">
                                        <h4>Catatan Kejadian</h4>
                                        <p>{viewModal.incidents || '-'}</p>
                                    </div>

                                    <div className="ba-section">
                                        <h4>Catatan Tambahan</h4>
                                        <p>{viewModal.notes || '-'}</p>
                                    </div>

                                    <div className="ba-section">
                                        <h4>Pengawas</h4>
                                        <p><strong>{viewModal.pengawas}</strong></p>
                                        <p className="text-muted">NIP: {viewModal.nip}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-ghost" onClick={() => setViewModal(null)}>Tutup</button>
                                <button className="btn btn-primary" onClick={() => handlePrintSingle(viewModal)}>
                                    <Printer size={16} />
                                    Cetak
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .mb-4 {
                    margin-bottom: var(--space-4);
                }
                .header-actions {
                    display: flex;
                    gap: var(--space-3);
                }
                .action-buttons {
                    display: flex;
                    gap: var(--space-1);
                }
                .exam-name-cell {
                    display: flex;
                    flex-direction: column;
                }
                .time-text {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
                .incident-badge {
                    display: inline-flex;
                    padding: var(--space-1) var(--space-2);
                    border-radius: var(--radius-md);
                    font-size: var(--font-size-xs);
                    font-weight: var(--font-medium);
                }
                .incident-badge.normal {
                    background: var(--success-100);
                    color: var(--success-700);
                }
                .incident-badge.warning {
                    background: var(--warning-100);
                    color: var(--warning-700);
                }
                .ba-detail {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-5);
                }
                .ba-section h4 {
                    margin: 0 0 var(--space-2);
                    color: var(--text-secondary);
                    font-size: var(--font-size-sm);
                }
                .ba-section p {
                    margin: 0;
                    line-height: 1.6;
                }
                .ba-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--space-2);
                }
                .ba-attendance {
                    display: flex;
                    gap: var(--space-4);
                    flex-wrap: wrap;
                }
                .ba-attendance .success { color: var(--success-600); }
                .ba-attendance .error { color: var(--error-600); }
            `}</style>
        </DashboardLayout>
    )
}

export default RekapBeritaAcaraPage
