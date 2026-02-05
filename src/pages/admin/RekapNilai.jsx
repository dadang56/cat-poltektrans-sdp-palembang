import { useState, useRef, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useSettings } from '../../contexts/SettingsContext'
import { exportToXLSX } from '../../utils/excelUtils'
import { hasilUjianService, prodiService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    Award,
    Download,
    Printer,
    Filter,
    Eye,
    ChevronDown,
    ChevronUp,
    FileSpreadsheet,
    RefreshCw
} from 'lucide-react'
import '../admin/Dashboard.css'

function RekapNilaiPage() {
    const { user } = useAuth()
    const { settings } = useSettings()
    const [prodiFilter, setProdiFilter] = useState(user?.prodi_id || 'all')
    const [examTypeFilter, setExamTypeFilter] = useState('all')
    const [tahunAkademik, setTahunAkademik] = useState('2024/2025')
    const [expandedRow, setExpandedRow] = useState(null)
    const [viewMode, setViewMode] = useState('matkul') // 'matkul', 'kelas', 'mahasiswa'
    const printRef = useRef()
    const [nilaiData, setNilaiData] = useState([])
    const [prodiList, setProdiList] = useState([])
    const [loading, setLoading] = useState(true)

    // Get Ka. Prodi info from localStorage (kept for signature)
    const kaprodiInfo = JSON.parse(localStorage.getItem(`kaprodiInfo_${user?.prodi_id || 'default'}`) || '{"nama":"","nip":""}')

    // Load data from Supabase
    useEffect(() => {
        const loadData = async () => {
            if (!isSupabaseConfigured()) {
                console.log('Supabase not configured')
                setLoading(false)
                return
            }

            setLoading(true)
            try {
                // Get prodi list for filters
                const prodiData = await prodiService.getAll()
                setProdiList(prodiData || [])

                // Get all hasil ujian with related data
                const results = await hasilUjianService.getAll()
                console.log('[RekapNilai] Loaded results:', results?.length)

                // Group results by jadwal (exam)
                const examGroups = {}
                results?.forEach(r => {
                    const jadwal = r.jadwal || {}
                    const matkul = jadwal.matkul || {}
                    const kelas = jadwal.kelas || {}
                    const dosen = jadwal.dosen || {}
                    const mahasiswa = r.mahasiswa || {}

                    const examKey = jadwal.id
                    if (!examKey) return

                    if (!examGroups[examKey]) {
                        examGroups[examKey] = {
                            id: jadwal.id,
                            matkul: matkul.nama || 'N/A',
                            matkulKode: matkul.kode || '',
                            kelas: kelas.nama || mahasiswa.kelas?.nama || 'N/A',
                            dosen: dosen.nama || 'Dosen',
                            examType: jadwal.tipe || 'UAS',
                            prodiId: matkul.prodi_id,
                            date: jadwal.tanggal,
                            tahunAkademik: jadwal.tahun_akademik || '2024/2025',
                            students: []
                        }
                    }

                    // Calculate percentage score
                    const percentScore = r.nilai_total || 0

                    examGroups[examKey].students.push({
                        nim: mahasiswa.nim_nip || '-',
                        name: mahasiswa.nama || 'Unknown',
                        nilai: Math.round(percentScore),
                        status: percentScore >= 70 ? 'lulus' : 'mengulang',
                        isFullyCorrected: r.status === 'graded'
                    })
                })

                setNilaiData(Object.values(examGroups))
            } catch (error) {
                console.error('[RekapNilai] Error loading data:', error)
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [user])

    // Filter based on admin prodi or show all for superadmin
    const filteredData = nilaiData.filter(item => {
        const matchesProdi = user?.role === 'superadmin'
            ? (prodiFilter === 'all' || item.prodiId === prodiFilter)
            : item.prodiId === user?.prodi_id  // Fixed: was user?.prodiId
        const matchesExamType = examTypeFilter === 'all' || item.examType === examTypeFilter
        return matchesProdi && matchesExamType
    })

    const getProdiName = (prodiId) => {
        return prodiList.find(p => p.id === prodiId)?.kode || '-'
    }

    const handleExportExcel = () => {
        // Flatten data for export
        const exportData = []
        filteredData.forEach(item => {
            item.students.forEach(student => {
                exportData.push({
                    matkul: item.matkul,
                    jenisUjian: item.examType,
                    dosen: item.dosen,
                    kelas: item.kelas,
                    nim: student.nim,
                    nama: student.name,
                    nilai: student.nilai,
                    status: student.status === 'lulus' ? 'Lulus' : 'Mengulang'
                })
            })
        })

        const headers = [
            { key: 'matkul', label: 'Mata Kuliah' },
            { key: 'jenisUjian', label: 'Jenis Ujian' },
            { key: 'dosen', label: 'Dosen' },
            { key: 'kelas', label: 'Kelas' },
            { key: 'nim', label: 'NIM' },
            { key: 'nama', label: 'Nama Mahasiswa' },
            { key: 'nilai', label: 'Nilai' },
            { key: 'status', label: 'Status' }
        ]

        exportToXLSX(exportData, headers, `rekap_nilai_${new Date().toISOString().split('T')[0]}`, 'Rekap Nilai')
    }

    const handlePrint = () => {
        const printWindow = window.open('', '_blank')
        printWindow.document.write(`
            <html>
            <head>
                <title>Rekap Nilai</title>
                <style>
                    @page { size: A4 portrait; margin: 15mm; }
                    body { font-family: 'Times New Roman', serif; padding: 20px; font-size: 12pt; }
                    .letterhead {
                        display: flex;
                        align-items: center;
                        gap: 20px;
                        border-bottom: 3px double #000;
                        padding-bottom: 15px;
                        margin-bottom: 25px;
                    }
                    .letterhead-logo {
                        width: 70px;
                        height: 70px;
                        border: 2px solid #1e3a5f;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-direction: column;
                        background: white;
                    }
                    .letterhead-logo .logo-icon {
                        font-size: 24pt;
                        line-height: 1;
                    }
                    .letterhead-logo .logo-text {
                        font-size: 6pt;
                        color: #1e3a5f;
                        font-weight: bold;
                    }
                    .letterhead-text {
                        flex: 1;
                        text-align: center;
                    }
                    .letterhead-text h2 {
                        margin: 0;
                        font-size: 14pt;
                        text-transform: uppercase;
                    }
                    .letterhead-text h1 {
                        margin: 5px 0;
                        font-size: 18pt;
                        text-transform: uppercase;
                    }
                    .letterhead-text p {
                        margin: 3px 0;
                        font-size: 10pt;
                    }
                    .document-title {
                        text-align: center;
                        margin: 25px 0;
                    }
                    .document-title h3 {
                        text-decoration: underline;
                        margin: 0;
                        font-size: 14pt;
                    }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; font-size: 11pt; }
                    th { background: #f0f0f0; font-weight: bold; }
                    .text-center { text-align: center; }
                    .lulus { color: #166534; font-weight: bold; }
                    .mengulang { color: #dc2626; font-weight: bold; }
                    .exam-type { display: inline-block; padding: 2px 8px; background: #1e3a5f; color: white; border-radius: 4px; font-size: 10pt; margin-left: 8px; }
                    .section-title { margin: 20px 0 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                    .signature-section { margin-top: 50px; display: flex; justify-content: flex-end; }
                    .signature-box { text-align: center; width: 250px; }
                    .signature-line { margin-top: 60px; padding-top: 5px; }
                </style>
            </head>
            <body>
                <div class="letterhead">
                    ${settings?.logoUrl
                ? `<img src="${settings.logoUrl}" alt="Logo" class="letterhead-logo-img" style="width: 70px; height: 70px; object-fit: contain;"/>`
                : `<div class="letterhead-logo">
                            <span class="logo-icon">⚓</span>
                            <span class="logo-text">POLTEKTRANS</span>
                        </div>`
            }
                    <div class="letterhead-text">
                        <h1>${settings?.institution || 'Politeknik Transportasi SDP Palembang'}</h1>
                        <p>${settings?.address || 'Jl. Residen Abdul Rozak, Palembang, Sumatera Selatan'}</p>
                        <p>Telp: ${settings?.phone || '(0711) 123456'} | Email: ${settings?.email || 'info@poltektrans.ac.id'}</p>
                    </div>
                </div>
                <div class="document-title">
                    <h3>REKAP NILAI MAHASISWA</h3>
                    <p>Tahun Akademik 2025/2026 ${examTypeFilter !== 'all' ? '- ' + examTypeFilter : ''}</p>
                </div>
                <p>Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                ${filteredData.map(item => `
                    <h3>${item.matkul} <span class="exam-type">${item.examType}</span></h3>
                    <p>Dosen: ${item.dosen} | Kelas: ${item.kelas}</p>
                    <table>
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>NIM</th>
                                <th>Nama Mahasiswa</th>
                                <th class="text-center">Nilai ${item.examType}</th>
                                <th class="text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${item.students.map((s, idx) => `
                                <tr>
                                    <td>${idx + 1}</td>
                                    <td>${s.nim}</td>
                                    <td>${s.name}</td>
                                    <td class="text-center ${s.nilai >= 70 ? 'lulus' : 'mengulang'}">${s.nilai}</td>
                                    <td class="text-center ${s.status}">${s.status === 'lulus' ? 'Lulus' : 'Mengulang'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `).join('')}
                
                <div class="signature-section">
                    <div class="signature-box">
                        <p>Palembang, ${new Date().toLocaleDateString('id-ID')}</p>
                        <p>Ka. Program Studi</p>
                        <div class="signature-line">
                            <p><strong>${kaprodiInfo.nama || '_________________________'}</strong></p>
                            <p>NIP. ${kaprodiInfo.nip || '_______________'}</p>
                        </div>
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
                        <h1 className="page-title">Rekap Nilai Ujian</h1>
                        <p className="page-subtitle">Data nilai dari seluruh dosen yang tersinkronisasi</p>
                    </div>
                    <div className="header-actions">
                        <button className="btn btn-secondary" onClick={handleExportExcel}>
                            <FileSpreadsheet size={18} />
                            Export Excel
                        </button>
                        <button className="btn btn-primary" onClick={handlePrint}>
                            <Printer size={18} />
                            Cetak
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="card mb-4">
                    <div className="card-body">
                        {/* View Mode Tabs */}
                        <div className="view-mode-tabs mb-3">
                            <button
                                className={`view-tab ${viewMode === 'matkul' ? 'active' : ''}`}
                                onClick={() => setViewMode('matkul')}
                            >
                                Setiap Mata Kuliah
                            </button>
                            <button
                                className={`view-tab ${viewMode === 'kelas' ? 'active' : ''}`}
                                onClick={() => setViewMode('kelas')}
                            >
                                Setiap Kelas
                            </button>
                            <button
                                className={`view-tab ${viewMode === 'mahasiswa' ? 'active' : ''}`}
                                onClick={() => setViewMode('mahasiswa')}
                            >
                                Setiap Mahasiswa
                            </button>
                        </div>
                        <div className="filters-row">
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
                                <select
                                    className="form-input"
                                    value={examTypeFilter}
                                    onChange={e => setExamTypeFilter(e.target.value)}
                                >
                                    <option value="all">Semua Jenis</option>
                                    <option value="UTS">UTS</option>
                                    <option value="UAS">UAS</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Data Table */}
                <div className="card" id="print-content" ref={printRef}>
                    <div className="card-body">
                        <div className="rekap-list">
                            {filteredData.map(item => (
                                <div key={item.id} className="rekap-item">
                                    <div
                                        className="rekap-header"
                                        onClick={() => setExpandedRow(expandedRow === item.id ? null : item.id)}
                                    >
                                        <div className="rekap-info">
                                            <h4>
                                                {item.matkul}
                                                <span className={`badge badge-${item.examType === 'UTS' ? 'primary' : 'error'} ml-2`}>
                                                    {item.examType}
                                                </span>
                                            </h4>
                                            <p>
                                                <span className="badge badge-info">{getProdiName(item.prodiId)}</span>
                                                <span>Kelas {item.kelas}</span>
                                                <span>• {item.dosen}</span>
                                            </p>
                                        </div>
                                        <div className="rekap-meta">
                                            <span className="student-count">{item.students.length} mahasiswa</span>
                                            {expandedRow === item.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                    </div>

                                    {expandedRow === item.id && (
                                        <div className="rekap-detail">
                                            <table className="table">
                                                <thead>
                                                    <tr>
                                                        <th>No</th>
                                                        <th>NIM</th>
                                                        <th>Nama Mahasiswa</th>
                                                        <th className="text-center">Nilai {item.examType}</th>
                                                        <th className="text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {item.students.map((student, idx) => (
                                                        <tr key={student.nim}>
                                                            <td>{idx + 1}</td>
                                                            <td>{student.nim}</td>
                                                            <td className="font-medium">{student.name}</td>
                                                            <td className="text-center">
                                                                <span className={`nilai-badge ${student.nilai >= 70 ? 'lulus' : 'mengulang'}`}>
                                                                    {student.nilai}
                                                                </span>
                                                            </td>
                                                            <td className="text-center">
                                                                <span className={`status-label ${student.status}`}>
                                                                    {student.status === 'lulus' ? 'Lulus' : 'Mengulang'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {filteredData.length === 0 && (
                                <div className="empty-state">
                                    <Award size={48} />
                                    <h3>Tidak ada data nilai</h3>
                                    <p>Belum ada nilai yang tersinkronisasi dari dosen</p>
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
                .header-actions {
                    display: flex;
                    gap: var(--space-3);
                }
                .rekap-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4);
                }
                .rekap-item {
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--border-color);
                    overflow: hidden;
                }
                .rekap-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--space-4);
                    cursor: pointer;
                    transition: background var(--transition-fast);
                }
                .rekap-header:hover {
                    background: var(--bg-secondary);
                }
                .rekap-info h4 {
                    margin: 0 0 var(--space-1);
                }
                .rekap-info p {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    margin: 0;
                    font-size: var(--font-size-sm);
                    color: var(--text-secondary);
                }
                .rekap-meta {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                }
                .student-count {
                    font-size: var(--font-size-sm);
                    color: var(--text-muted);
                }
                .rekap-detail {
                    padding: var(--space-4);
                    border-top: 1px solid var(--border-color);
                    background: var(--bg-secondary);
                    overflow-x: auto;
                }
                .text-center {
                    text-align: center;
                }
                .nh-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 28px;
                    padding: var(--space-1) var(--space-2);
                    border-radius: var(--radius-md);
                    font-weight: var(--font-bold);
                    font-size: var(--font-size-xs);
                    color: white;
                }
                .nh-badge.success { background: var(--success-500); }
                .nh-badge.warning { background: var(--warning-500); }
                .nh-badge.info { background: var(--info-500); }
                .nh-badge.error { background: var(--error-500); }
                .nilai-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 36px;
                    padding: var(--space-1) var(--space-2);
                    border-radius: var(--radius-md);
                    font-weight: var(--font-bold);
                    font-size: var(--font-size-sm);
                }
                .nilai-badge.lulus {
                    background: var(--success-100);
                    color: var(--success-700);
                }
                .nilai-badge.mengulang {
                    background: var(--error-100);
                    color: var(--error-700);
                }
                .status-label {
                    display: inline-block;
                    padding: var(--space-1) var(--space-2);
                    border-radius: var(--radius-md);
                    font-size: var(--font-size-xs);
                    font-weight: var(--font-medium);
                }
                .status-label.lulus {
                    background: var(--success-100);
                    color: var(--success-700);
                }
                .status-label.mengulang {
                    background: var(--error-100);
                    color: var(--error-700);
                }
                .ml-2 {
                    margin-left: var(--space-2);
                }
                .empty-state {
                    text-align: center;
                    padding: var(--space-8);
                    color: var(--text-muted);
                }
                .empty-state svg {
                    margin-bottom: var(--space-4);
                }
                .empty-state h3 {
                    margin-bottom: var(--space-2);
                    color: var(--text-secondary);
                }
                .view-mode-tabs {
                    display: flex;
                    gap: var(--space-2);
                    padding-bottom: var(--space-3);
                    border-bottom: 1px solid var(--border-color);
                }
                .view-tab {
                    padding: var(--space-2) var(--space-4);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-lg);
                    background: var(--bg-secondary);
                    color: var(--text-secondary);
                    font-weight: var(--font-medium);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .view-tab:hover {
                    background: var(--bg-tertiary);
                }
                .view-tab.active {
                    background: var(--primary-500);
                    color: white;
                    border-color: var(--primary-500);
                }
                .mb-3 {
                    margin-bottom: var(--space-3);
                }
            `}</style>
        </DashboardLayout>
    )
}

export default RekapNilaiPage
