import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useSettings } from '../../contexts/SettingsContext'
import { useAuth } from '../../App'
import {
    jadwalService,
    hasilUjianService,
    userService,
    beritaAcaraService,
    isSupabaseConfigured
} from '../../services/supabaseService'
import {
    FileText,
    Printer,
    Clock,
    Users,
    AlertCircle,
    CheckCircle,
    Calendar,
    Save
} from 'lucide-react'
import '../admin/Dashboard.css'


// Helper for field compatibility
const getField = (obj, snakeCase, camelCase) => obj?.[snakeCase] ?? obj?.[camelCase]

function BeritaAcaraPage() {
    const { settings } = useSettings()
    const { user } = useAuth()
    const [rooms, setRooms] = useState([])
    const [selectedRoom, setSelectedRoom] = useState(null)
    const [usersList, setUsersList] = useState([])
    const [roomStudentCount, setRoomStudentCount] = useState({ total: 0, hadir: 0 })
    const [formData, setFormData] = useState({
        incidents: '',
        notes: ''
    })
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const printRef = useRef(null)

    useEffect(() => {
        const loadData = async () => {
            try {
                if (isSupabaseConfigured()) {
                    const { ruangService } = await import('../../services/supabaseService')
                    const [jadwalData, usersData, allRuang] = await Promise.all([
                        jadwalService.getAll(),
                        userService.getAll(),
                        ruangService.getAll()
                    ])

                    setUsersList(usersData)

                    // Build ruang lookup
                    const ruangLookup = {}
                    allRuang.forEach(r => { ruangLookup[r.id] = r })

                    const now = new Date()
                    const today = now.toISOString().split('T')[0]
                    const todayJadwal = jadwalData.filter(j => j.tanggal === today)

                    // Group by ruangan
                    const roomMap = {}
                    todayJadwal.forEach(j => {
                        const roomId = j.ruangan_id || j.ruanganId || 'default'
                        const ruang = ruangLookup[roomId] || j.ruangan || {}
                        const roomName = ruang.nama || j.ruangan?.nama || 'Ruang Ujian'
                        const matkulName = j.matkul?.nama || 'Mata Kuliah'
                        const tipe = j.tipe || getField(j, 'tipe_ujian', 'tipeUjian') || 'UTS'
                        const examLabel = `${tipe} - ${matkulName}`
                        const waktuMulai = getField(j, 'waktu_mulai', 'waktuMulai')
                        const waktuSelesai = getField(j, 'waktu_selesai', 'waktuSelesai')

                        if (!roomMap[roomId]) {
                            roomMap[roomId] = {
                                id: roomId,
                                name: roomName,
                                exams: [examLabel],
                                jadwalIds: [j.id],
                                tanggal: j.tanggal,
                                waktuMulai,
                                waktuSelesai
                            }
                        } else {
                            if (!roomMap[roomId].exams.includes(examLabel)) {
                                roomMap[roomId].exams.push(examLabel)
                            }
                            roomMap[roomId].jadwalIds.push(j.id)
                        }
                    })
                    setRooms(Object.values(roomMap))
                }
            } catch (error) {
                console.error('[BeritaAcara] Error loading data:', error)
            }
            setLoading(false)
        }

        loadData()
    }, [])

    // Load student counts when room is selected
    const handleRoomSelect = async (roomId) => {
        const room = rooms.find(r => String(r.id) === String(roomId))
        setSelectedRoom(room || null)

        if (!room) return

        if (isSupabaseConfigured() && room.jadwalIds?.length > 0) {
            try {
                const allResults = await Promise.all(
                    room.jadwalIds.map(jId => hasilUjianService.getByJadwal(jId))
                )

                const seenStudents = new Set()
                let hadirCount = 0
                allResults.forEach(resultList => {
                    (resultList || []).forEach(hasil => {
                        const mhsId = hasil.mahasiswa_id
                        if (!seenStudents.has(mhsId)) {
                            seenStudents.add(mhsId)
                            const isHadir = hasil.status === 'submitted' || hasil.status === 'graded' || !!hasil.waktu_selesai
                            if (isHadir) hadirCount++
                        }
                    })
                })

                setRoomStudentCount({ total: seenStudents.size, hadir: hadirCount })
            } catch (error) {
                console.error('[BeritaAcara] Error loading room students:', error)
            }
        }
    }

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    // Save berita acara to Supabase
    const handleSaveBeritaAcara = async () => {
        if (!selectedRoom || !isSupabaseConfigured()) return

        setSaving(true)
        try {
            // Save for the first jadwal in the room
            await beritaAcaraService.upsert({
                jadwal_id: selectedRoom.jadwalIds[0],
                pengawas_id: user?.id,
                jumlah_hadir: roomStudentCount.hadir,
                jumlah_tidak_hadir: roomStudentCount.total - roomStudentCount.hadir,
                catatan: `${formData.incidents}\n\n${formData.notes}`.trim()
            })
            alert('Berita acara berhasil disimpan!')
        } catch (error) {
            console.error('[BeritaAcara] Save error:', error)
            alert('Gagal menyimpan berita acara. Silakan coba lagi.')
        }
        setSaving(false)
    }

    const handlePrint = () => {
        const printContent = printRef.current
        const originalContents = document.body.innerHTML
        document.body.innerHTML = printContent.innerHTML
        window.print()
        document.body.innerHTML = originalContents
        window.location.reload()
    }

    // Calculate attendance
    const attendance = {
        total: roomStudentCount.total,
        hadir: roomStudentCount.hadir,
        sakit: 0,
        izin: 0,
        alpha: roomStudentCount.total - roomStudentCount.hadir
    }

    return (
        <DashboardLayout>
            <div className="berita-acara-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Berita Acara Ujian</h1>
                        <p className="page-subtitle">Formulir laporan pelaksanaan ujian per ruangan</p>
                    </div>
                    <div className="page-actions">
                        {selectedRoom && (
                            <>
                                <button
                                    className="btn btn-success"
                                    onClick={handleSaveBeritaAcara}
                                    disabled={saving}
                                >
                                    <Save size={18} />
                                    {saving ? 'Menyimpan...' : 'Simpan'}
                                </button>
                                <button className="btn btn-primary" onClick={handlePrint}>
                                    <Printer size={18} />
                                    Print Berita Acara
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Room Selection */}
                <div className="card mb-4">
                    <div className="card-body">
                        <div className="room-selector">
                            <div className="selector-item">
                                <label>Pilih Ruangan:</label>
                                <select
                                    className="form-input"
                                    value={selectedRoom?.id || ''}
                                    onChange={(e) => handleRoomSelect(e.target.value)}
                                >
                                    <option value="">-- Pilih Ruangan Ujian Hari Ini --</option>
                                    {rooms.map(room => (
                                        <option key={room.id} value={room.id}>
                                            {room.name} — {room.exams.join(', ')} ({room.waktuMulai})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {selectedRoom && (
                                <>
                                    <div className="selector-item">
                                        <Calendar size={16} />
                                        <span className="session-info">{selectedRoom.tanggal}</span>
                                    </div>
                                    <div className="selector-item">
                                        <Clock size={16} />
                                        <span className="session-info">{selectedRoom.waktuMulai} - {selectedRoom.waktuSelesai}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {rooms.length === 0 ? (
                    <div className="card">
                        <div className="card-body text-center" style={{ padding: '48px', opacity: 0.6 }}>
                            <FileText size={48} style={{ marginBottom: '16px' }} />
                            <h4 style={{ margin: '0 0 8px' }}>Tidak Ada Ujian Hari Ini</h4>
                            <p style={{ margin: 0 }}>Tidak ada jadwal ujian yang terdaftar untuk hari ini.</p>
                        </div>
                    </div>
                ) : !selectedRoom ? (
                    <div className="card">
                        <div className="card-body text-center" style={{ padding: '48px', opacity: 0.6 }}>
                            <FileText size={48} style={{ marginBottom: '16px' }} />
                            <h4 style={{ margin: '0 0 8px' }}>Pilih Ruangan</h4>
                            <p style={{ margin: 0 }}>Pilih ruangan ujian dari dropdown di atas untuk mengisi berita acara.</p>
                        </div>
                    </div>
                ) : (
                    <div className="form-grid">
                        {/* Room Info */}
                        <div className="card">
                            <div className="card-header">
                                <h3><Clock size={18} /> Informasi Ruangan Ujian</h3>
                            </div>
                            <div className="card-body">
                                <div className="form-group">
                                    <label className="form-label">Ruangan</label>
                                    <input type="text" className="form-input" value={selectedRoom.name} readOnly style={{ background: 'var(--bg-tertiary)' }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Mata Ujian</label>
                                    <input type="text" className="form-input" value={selectedRoom.exams.join(', ')} readOnly style={{ background: 'var(--bg-tertiary)' }} />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Tanggal</label>
                                        <input type="text" className="form-input" value={selectedRoom.tanggal} readOnly style={{ background: 'var(--bg-tertiary)' }} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Waktu</label>
                                        <input type="text" className="form-input" value={`${selectedRoom.waktuMulai} - ${selectedRoom.waktuSelesai}`} readOnly style={{ background: 'var(--bg-tertiary)' }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Attendance Summary */}
                        <div className="card">
                            <div className="card-header">
                                <h3><Users size={18} /> Rekapitulasi Kehadiran</h3>
                            </div>
                            <div className="card-body">
                                <div className="attendance-recap">
                                    <div className="recap-item">
                                        <span className="recap-label">Jumlah Peserta Terdaftar</span>
                                        <span className="recap-value">{attendance.total} orang</span>
                                    </div>
                                    <div className="recap-item success">
                                        <span className="recap-label">Hadir</span>
                                        <span className="recap-value">{attendance.hadir} orang</span>
                                    </div>
                                    <div className="recap-item warning">
                                        <span className="recap-label">Sakit</span>
                                        <span className="recap-value">{attendance.sakit} orang</span>
                                    </div>
                                    <div className="recap-item info">
                                        <span className="recap-label">Izin Khusus</span>
                                        <span className="recap-value">{attendance.izin} orang</span>
                                    </div>
                                    <div className="recap-item error">
                                        <span className="recap-label">Tanpa Keterangan</span>
                                        <span className="recap-value">{attendance.alpha} orang</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Incidents & Notes */}
                        <div className="card card-wide">
                            <div className="card-header">
                                <h3><AlertCircle size={18} /> Catatan Kejadian</h3>
                            </div>
                            <div className="card-body">
                                <div className="form-group">
                                    <label className="form-label">Kejadian Penting Selama Ujian</label>
                                    <textarea
                                        className="form-input form-textarea"
                                        rows={4}
                                        placeholder="Tuliskan kejadian penting (jika tidak ada, tulis 'Tidak ada kejadian khusus')..."
                                        value={formData.incidents}
                                        onChange={(e) => handleInputChange('incidents', e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Catatan Tambahan</label>
                                    <textarea
                                        className="form-input form-textarea"
                                        rows={3}
                                        placeholder="Catatan tambahan lainnya (opsional)..."
                                        value={formData.notes}
                                        onChange={(e) => handleInputChange('notes', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Supervisor Info */}
                        <div className="card card-wide">
                            <div className="card-header">
                                <h3><CheckCircle size={18} /> Data Pengawas</h3>
                            </div>
                            <div className="card-body">
                                <p className="text-sm text-muted mb-3">Data pengawas diambil otomatis dari akun yang login.</p>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Nama Terang Pengawas</label>
                                        <input type="text" className="form-input" value={user?.name || ''} readOnly style={{ background: 'var(--bg-tertiary)' }} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">NIP</label>
                                        <input type="text" className="form-input" value={user?.nip || '-'} readOnly style={{ background: 'var(--bg-tertiary)' }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Print Template */}
            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    <style>{`
                        @page { size: A4 portrait; margin: 20mm; }
                        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Times New Roman', serif !important; }
                        body { font-size: 12pt; line-height: 1.5; }
                        .print-header { display: flex; align-items: center; gap: 15px; border-bottom: 3px double #000; padding-bottom: 15px; margin-bottom: 25px; }
                        .print-logo { width: 70px; height: 70px; object-fit: contain; }
                        .print-institution { flex: 1; text-align: center; }
                        .print-institution h2 { font-size: 16pt; text-transform: uppercase; }
                        .print-institution p { font-size: 11pt; margin: 3px 0 0; }
                        .print-title { text-align: center; margin: 25px 0; }
                        .print-title h3 { font-size: 14pt; text-decoration: underline; }
                        .print-section { margin-bottom: 20px; }
                        .print-section h4 { font-size: 12pt; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                        .print-info-table { width: 100%; border-collapse: collapse; }
                        .print-info-table td { padding: 5px 0; vertical-align: top; }
                        .print-info-table td:first-child { width: 180px; }
                        .print-attendance-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                        .print-attendance-table th, .print-attendance-table td { border: 1px solid #000; padding: 8px 12px; text-align: left; }
                        .print-attendance-table th { background: #f0f0f0; }
                        .print-attendance-table td:last-child { text-align: center; }
                        .print-notes { background: #fafafa; border: 1px solid #ddd; padding: 15px; min-height: 80px; margin-top: 10px; }
                        .print-footer { margin-top: 50px; display: flex; justify-content: flex-end; }
                        .print-sign { text-align: center; width: 250px; }
                        .print-sign-line { border-bottom: 1px solid #000; margin-top: 80px; margin-bottom: 5px; }
                    `}</style>

                    <div className="print-header">
                        {settings?.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className="print-logo" />
                        ) : (
                            <div style={{ width: 70, height: 70, background: '#333', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>CAT</div>
                        )}
                        <div className="print-institution">
                            <h2>{settings?.institution || 'Politeknik Transportasi SDP Palembang'}</h2>
                            <p>{settings?.address || 'Jl. Residen Abdul Rozak, Palembang'}</p>
                        </div>
                    </div>

                    <div className="print-title">
                        <h3>BERITA ACARA PELAKSANAAN UJIAN</h3>
                        <p>Nomor: ......../BA-UJIAN/{new Date().getFullYear()}</p>
                    </div>

                    {selectedRoom && (
                        <>
                            <div className="print-section">
                                <h4>I. Informasi Ruangan Ujian</h4>
                                <table className="print-info-table">
                                    <tbody>
                                        <tr><td>Ruangan</td><td>: {selectedRoom.name}</td></tr>
                                        <tr><td>Mata Ujian</td><td>: {selectedRoom.exams.join(', ')}</td></tr>
                                        <tr><td>Hari/Tanggal</td><td>: {new Date(selectedRoom.tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
                                        <tr><td>Waktu Pelaksanaan</td><td>: {selectedRoom.waktuMulai} - {selectedRoom.waktuSelesai} WIB</td></tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="print-section">
                                <h4>II. Rekapitulasi Kehadiran</h4>
                                <table className="print-attendance-table">
                                    <thead>
                                        <tr><th>Keterangan</th><th>Jumlah</th></tr>
                                    </thead>
                                    <tbody>
                                        <tr><td>Jumlah Peserta Terdaftar</td><td>{attendance.total} orang</td></tr>
                                        <tr><td>Hadir</td><td>{attendance.hadir} orang</td></tr>
                                        <tr><td>Sakit</td><td>{attendance.sakit} orang</td></tr>
                                        <tr><td>Izin Khusus</td><td>{attendance.izin} orang</td></tr>
                                        <tr><td>Tanpa Keterangan</td><td>{attendance.alpha} orang</td></tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="print-section">
                                <h4>III. Catatan Kejadian</h4>
                                <div className="print-notes">{formData.incidents || 'Tidak ada kejadian khusus.'}</div>
                            </div>

                            {formData.notes && (
                                <div className="print-section">
                                    <h4>IV. Catatan Tambahan</h4>
                                    <div className="print-notes">{formData.notes}</div>
                                </div>
                            )}
                        </>
                    )}

                    <p style={{ marginTop: '20px' }}>Demikian berita acara ini dibuat dengan sebenarnya.</p>

                    <div className="print-footer">
                        <div className="print-sign">
                            <p>Palembang, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            <p>Pengawas Ujian,</p>
                            <div className="print-sign-line"></div>
                            <p><strong>{user?.name || '________________________'}</strong></p>
                            <p>NIP. {user?.nip || '-'}</p>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .berita-acara-page { padding: 0; }
                .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }
                .page-actions { display: flex; gap: 0.75rem; }
                .mb-4 { margin-bottom: 1.5rem; }
                .room-selector { display: flex; flex-wrap: wrap; gap: 2rem; align-items: center; }
                .selector-item { display: flex; align-items: center; gap: 0.75rem; }
                .selector-item label { font-weight: 500; color: var(--text-secondary); }
                .selector-item .form-input { min-width: 280px; }
                .session-info { font-weight: 600; color: var(--primary-600); }
                .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
                .card-wide { grid-column: span 2; }
                .card-header { padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); }
                .card-header h3 { margin: 0; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; }
                .form-group { margin-bottom: 1rem; }
                .form-label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--text-secondary); font-size: 0.875rem; }
                .form-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
                .form-textarea { resize: vertical; min-height: 80px; }
                .attendance-recap { display: flex; flex-direction: column; gap: 0.75rem; }
                .recap-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--bg-tertiary); border-radius: 0.5rem; border-left: 3px solid var(--border-color); }
                .recap-item.success { border-left-color: var(--success-500); }
                .recap-item.warning { border-left-color: var(--warning-500); }
                .recap-item.info { border-left-color: var(--info-500); }
                .recap-item.error { border-left-color: var(--error-500); }
                .recap-label { font-size: 0.875rem; color: var(--text-secondary); }
                .recap-value { font-weight: 600; color: var(--text-primary); }
                .text-sm { font-size: 0.875rem; }
                .text-muted { color: var(--text-muted); }
                .mb-3 { margin-bottom: 0.75rem; }
                @media (max-width: 768px) { .form-grid { grid-template-columns: 1fr; } .card-wide { grid-column: span 1; } .form-row { grid-template-columns: 1fr; } }
            `}</style>
        </DashboardLayout>
    )
}

export default BeritaAcaraPage
