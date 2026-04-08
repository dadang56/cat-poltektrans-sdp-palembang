import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useSettings } from '../../contexts/SettingsContext'
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


function RekapBeritaAcaraPage() {
    const { user } = useAuth()
    const { settings } = useSettings()
    const [search, setSearch] = useState('')
    const [prodiFilter, setProdiFilter] = useState(user?.prodi_id || 'all')
    const [dateFilter, setDateFilter] = useState('')
    const [viewModal, setViewModal] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [beritaAcaraData, setBeritaAcaraData] = useState([])
    const [prodiList, setProdiList] = useState([])

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

                    if (prodiData) setProdiList(JSON.parse(prodiData))
                    if (baData) setBeritaAcaraData(JSON.parse(baData))
                }
            } catch (err) {
                console.error('Error loading data:', err)
                setError('Gagal memuat data dari Supabase. Menggunakan data lokal.')

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
                    @page { size: A4 portrait; margin: 15mm; }
                    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Times New Roman', serif !important; }
                    body { font-size: 11pt; padding: 20px; }
                    .print-header { display: flex; align-items: center; gap: 15px; border-bottom: 3px double #000; padding-bottom: 10px; margin-bottom: 20px; }
                    .print-logo { width: 60px; height: 60px; object-fit: contain; }
                    .print-institution { flex: 1; text-align: center; }
                    .print-institution h2 { font-size: 14pt; text-transform: uppercase; }
                    .print-institution p { font-size: 10pt; margin: 3px 0 0; }
                    .print-title { text-align: center; margin: 20px 0; }
                    .print-title h3 { font-size: 13pt; text-decoration: underline; }
                    .print-title p { font-size: 10pt; }
                    .section-title { font-weight: bold; margin: 15px 0 8px; }
                    .print-info td { padding: 3px 10px 3px 0; vertical-align: top; }
                    .print-info td:first-child { width: 150px; }
                    .summary-table { width: 100%; border-collapse: collapse; margin: 10px 0 20px; }
                    .summary-table th, .summary-table td { border: 1px solid #000; padding: 6px 8px; text-align: center; }
                    .summary-table th { background: #f0f0f0; font-weight: bold; }
                    .incident-box { border: 1px solid #ccc; padding: 10px; margin: 10px 0 20px; min-height: 40px; }
                    .closing { margin-top: 20px; font-style: italic; }
                    .signature { margin-top: 40px; display: flex; justify-content: flex-end; }
                    .signature-box { text-align: center; width: 220px; }
                    .signature-line { border-bottom: 1px solid #000; margin-top: 60px; margin-bottom: 5px; }
                </style>
            </head>
            <body>
                <div class="print-header">
                    ${settings?.logoUrl
                ? `<img src="${settings.logoUrl}" alt="Logo" class="print-logo" />`
                : `<div style="width:60px;height:60px;background:#333;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold">CAT</div>`
            }
                    <div class="print-institution">
                        <h2>${settings?.institution || 'Politeknik Transportasi SDP Palembang'}</h2>
                        <p>${settings?.address || 'Jl. Residen Abdul Rozak, Palembang'}</p>
                    </div>
                </div>
                <div class="print-title">
                    <h3>BERITA ACARA PELAKSANAAN UJIAN</h3>
                    <p>Nomor: ......../BA-UJIAN/${new Date().getFullYear()}</p>
                </div>

                <p class="section-title">I. Informasi Ujian</p>
                <table class="print-info">
                    <tbody>
                        <tr><td>Nama Ujian</td><td>: ${item.examName}</td></tr>
                        <tr><td>Mata Kuliah</td><td>: ${item.matkul || item.examName}</td></tr>
                        <tr><td>Hari/Tanggal</td><td>: ${new Date(item.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
                        <tr><td>Waktu Pelaksanaan</td><td>: ${item.time} WIB</td></tr>
                        <tr><td>Ruangan</td><td>: ${item.room}</td></tr>
                    </tbody>
                </table>

                <p class="section-title">II. Rekapitulasi Kehadiran</p>
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th>Keterangan</th>
                            <th>Jumlah</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td style="text-align:left">Jumlah Peserta Terdaftar</td><td>${item.attendance?.total || 0} orang</td></tr>
                        <tr><td style="text-align:left">Hadir</td><td>${item.attendance?.hadir || 0} orang</td></tr>
                        <tr><td style="text-align:left">Sakit</td><td>${item.attendance?.sakit || 0} orang</td></tr>
                        <tr><td style="text-align:left">Izin Khusus</td><td>${item.attendance?.izin || 0} orang</td></tr>
                        <tr><td style="text-align:left">Tanpa Keterangan</td><td>${item.attendance?.alpha || 0} orang</td></tr>
                    </tbody>
                </table>

                <p class="section-title">III. Catatan Kejadian</p>
                <div class="incident-box">
                    ${item.incidents || 'Tidak ada kejadian khusus.'}
                </div>

                <p class="closing">Demikian berita acara ini dibuat dengan sebenarnya.</p>

                <div class="signature">
                    <div class="signature-box">
                        <p>Palembang, ${new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p>Pengawas Ujian,</p>
                        <div class="signature-line"></div>
                        <p><strong>${item.pengawas}</strong></p>
                        <p>NIP. ${item.nip || '_______________'}</p>
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
