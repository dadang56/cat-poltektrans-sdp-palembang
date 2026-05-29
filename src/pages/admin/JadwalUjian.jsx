import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useConfirm } from '../../components/ConfirmDialog'
import { jadwalService, matkulService, prodiService, kelasService, ruangService, userService, hasilUjianService, isSupabaseConfigured } from '../../services/supabaseService'
import { useSettings } from '../../contexts/SettingsContext'
import {
    Calendar,
    Plus,
    Edit2,
    Trash2,
    X,
    Save,
    Clock,
    MapPin,
    Users,
    Filter,
    Printer,
    RefreshCw,
    AlertCircle,
    RotateCcw,
    Archive
} from 'lucide-react'
import '../admin/Dashboard.css'


function JadwalModal({ isOpen, onClose, jadwal, onSave, matkulList = [], kelasList = [], ruangList = [], dosenList = [], jadwalList = [], isLoading }) {
    const getDefaultFormData = () => ({
        matkul_id: '',
        kelas_id: '',
        tipe_ujian: '',
        tanggal: '',
        waktu_mulai: '',
        waktu_selesai: '',
        durasi: '',
        ruangan_id: '',
        dosen_id: '',
        parent_jadwal_id: '',
        ulang_ke: 0
    })

    const [formData, setFormData] = useState(jadwal || getDefaultFormData())
    const [matkulSearch, setMatkulSearch] = useState('')
    const [mengulangStudents, setMengulangStudents] = useState([])
    const [loadingMengulang, setLoadingMengulang] = useState(false)
    const [maxUlangReached, setMaxUlangReached] = useState(false)

    useEffect(() => {
        if (isOpen) {
            if (jadwal) {
                setFormData({
                    ...jadwal,
                    matkul_id: jadwal.matkul?.id || jadwal.matkul_id || jadwal.matkulId || '',
                    kelas_id: jadwal.kelas?.id || jadwal.kelas_id || jadwal.kelasId || '',
                    tipe_ujian: jadwal.tipe_ujian || jadwal.tipeUjian || jadwal.tipe || '',
                    waktu_mulai: jadwal.waktu_mulai || jadwal.waktuMulai || '',
                    waktu_selesai: jadwal.waktu_selesai || jadwal.waktuSelesai || '',
                    durasi: jadwal.durasi || '',
                    ruangan_id: jadwal.ruangan?.id || jadwal.ruangan_id || '',
                    dosen_id: jadwal.dosen?.id || jadwal.dosen_id || '',
                    parent_jadwal_id: jadwal.parent_jadwal_id || '',
                    ulang_ke: jadwal.ulang_ke || 0
                })
            } else {
                setFormData(getDefaultFormData())
            }
            setMatkulSearch('')
            setMengulangStudents([])
            setMaxUlangReached(false)
        }
    }, [jadwal, isOpen, matkulList, kelasList])

    // Load mengulang students when parent jadwal is selected
    useEffect(() => {
        const loadMengulang = async () => {
            if (!formData.parent_jadwal_id || formData.tipe_ujian !== 'ULANG') {
                setMengulangStudents([])
                return
            }
            setLoadingMengulang(true)
            try {
                // Get students who scored < 70 on the parent exam
                const students = await hasilUjianService.getMengulangStudents(formData.parent_jadwal_id)
                setMengulangStudents(students || [])

                // Check how many remedial exams already exist for this parent
                const maxUlang = await jadwalService.getMaxUlangKe(formData.parent_jadwal_id)
                const nextUlang = maxUlang + 1
                if (nextUlang > 2) {
                    setMaxUlangReached(true)
                    setFormData(prev => ({ ...prev, ulang_ke: maxUlang }))
                } else {
                    setMaxUlangReached(false)
                    setFormData(prev => ({ ...prev, ulang_ke: nextUlang }))
                }

                // Auto-fill matkul, kelas, dosen from parent
                const parentJadwal = jadwalList.find(j => j.id === formData.parent_jadwal_id)
                if (parentJadwal) {
                    setFormData(prev => ({
                        ...prev,
                        matkul_id: parentJadwal.matkul?.id || parentJadwal.matkul_id || prev.matkul_id,
                        kelas_id: parentJadwal.kelas?.id || parentJadwal.kelas_id || prev.kelas_id,
                        dosen_id: parentJadwal.dosen?.id || parentJadwal.dosen_id || prev.dosen_id
                    }))
                }
            } catch (err) {
                console.error('Error loading mengulang students:', err)
            } finally {
                setLoadingMengulang(false)
            }
        }
        loadMengulang()
    }, [formData.parent_jadwal_id, formData.tipe_ujian])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (formData.tipe_ujian === 'ULANG') {
            if (!formData.parent_jadwal_id) {
                alert('Silakan pilih Jadwal Ujian Asli untuk ujian ulang')
                return
            }
            if (maxUlangReached) {
                alert('Batas ujian ulang (2 kali) sudah tercapai untuk jadwal ini')
                return
            }
            if (mengulangStudents.length === 0) {
                alert('Tidak ada mahasiswa yang mengulang pada ujian asli')
                return
            }
        } else {
            if (!formData.matkul_id) {
                alert('Silakan pilih Mata Kuliah')
                return
            }
        }
        if (!formData.durasi || parseInt(formData.durasi) < 1) {
            alert('Silakan isi durasi ujian (minimal 1 menit)')
            return
        }
        onSave({ ...formData, durasi: parseInt(formData.durasi) })
    }

    // Filter lists based on search - only for Matkul
    const filteredMatkul = matkulList.filter(m =>
        m.nama?.toLowerCase().includes(matkulSearch.toLowerCase()) ||
        m.kode?.toLowerCase().includes(matkulSearch.toLowerCase())
    )

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '95%' }}>
                <div className="modal-header">
                    <h3>{jadwal ? 'Edit Jadwal Ujian' : 'Tambah Jadwal Ujian'}</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Mata Kuliah with Search */}
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Mata Kuliah</label>
                            {formData.matkul_id ? (
                                // Show selected matkul with change button
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.75rem 1rem',
                                    background: 'var(--primary-50)',
                                    border: '1px solid var(--primary-200)',
                                    borderRadius: 'var(--radius-md)'
                                }}>
                                    <span style={{ flex: 1, color: 'var(--primary-700)', fontWeight: '500' }}>
                                        ✓ {matkulList.find(m => m.id === formData.matkul_id)?.kode} - {matkulList.find(m => m.id === formData.matkul_id)?.nama}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-ghost"
                                        onClick={() => setFormData({ ...formData, matkul_id: '' })}
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                    >
                                        Ganti
                                    </button>
                                </div>
                            ) : (
                                // Show search and list
                                <>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="🔍 Cari mata kuliah (kode/nama)..."
                                        value={matkulSearch}
                                        onChange={e => setMatkulSearch(e.target.value)}
                                        style={{ marginBottom: '0.5rem' }}
                                    />
                                    <div style={{
                                        maxHeight: '150px',
                                        overflowY: 'auto',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'var(--bg-primary)'
                                    }}>
                                        {filteredMatkul.length === 0 ? (
                                            <div style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                                Tidak ada hasil
                                            </div>
                                        ) : (
                                            filteredMatkul.slice(0, 10).map(m => (
                                                <div
                                                    key={m.id}
                                                    onClick={() => {
                                                        setFormData({ ...formData, matkul_id: m.id })
                                                        setMatkulSearch('')
                                                    }}
                                                    style={{
                                                        padding: '0.75rem 1rem',
                                                        cursor: 'pointer',
                                                        borderBottom: '1px solid var(--border-color)'
                                                    }}
                                                    className="matkul-item"
                                                    onMouseEnter={e => e.target.style.background = 'var(--gray-100)'}
                                                    onMouseLeave={e => e.target.style.background = 'transparent'}
                                                >
                                                    {m.kode} - {m.nama}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Kelas - Simple Dropdown */}
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Kelas</label>
                            <select
                                className="form-input"
                                value={formData.kelas_id}
                                onChange={e => setFormData({ ...formData, kelas_id: e.target.value })}
                                required
                            >
                                <option value="">Pilih Kelas</option>
                                {kelasList.map(k => (
                                    <option key={k.id} value={k.id}>{k.nama} ({k.angkatan})</option>
                                ))}
                            </select>
                        </div>

                        {/* Tipe Ujian - Full Width */}
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Tipe Ujian</label>
                            <select
                                className="form-input"
                                value={formData.tipe_ujian}
                                onChange={e => {
                                    const tipe = e.target.value
                                    setFormData({ ...formData, tipe_ujian: tipe, parent_jadwal_id: '', ulang_ke: 0 })
                                    setMengulangStudents([])
                                    setMaxUlangReached(false)
                                }}
                                required
                            >
                                <option value="">Pilih Tipe Ujian</option>
                                <option value="UTS">UTS</option>
                                <option value="UAS">UAS</option>
                                <option value="ULANG">Ujian Ulang (Remedial)</option>
                            </select>
                        </div>

                        {/* ULANG-specific fields */}
                        {formData.tipe_ujian === 'ULANG' && (
                            <>
                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label className="form-label">Jadwal Ujian Asli (yang di-ulang)</label>
                                    <select
                                        className="form-input"
                                        value={formData.parent_jadwal_id}
                                        onChange={e => setFormData({ ...formData, parent_jadwal_id: e.target.value })}
                                        required
                                    >
                                        <option value="">Pilih Jadwal Ujian Asli</option>
                                        {jadwalList
                                            .filter(j => (j.tipe === 'UTS' || j.tipe === 'UAS') && j.status !== 'cancelled')
                                            .map(j => {
                                                const matkulName = j.matkul?.nama || matkulList.find(m => m.id === j.matkul_id)?.nama || ''
                                                const kelasName = j.kelas?.nama || kelasList.find(k => k.id === j.kelas_id)?.nama || ''
                                                return (
                                                    <option key={j.id} value={j.id}>
                                                        {j.tipe} - {matkulName} - Kelas {kelasName} ({j.tanggal})
                                                    </option>
                                                )
                                            })}
                                    </select>
                                </div>

                                {formData.parent_jadwal_id && (
                                    <>
                                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                                            <label className="form-label">Ujian Ulang ke-</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={formData.ulang_ke}
                                                readOnly
                                                style={{ background: 'var(--bg-tertiary)', fontWeight: 'bold' }}
                                            />
                                            {maxUlangReached && (
                                                <small style={{ color: 'var(--error-600)', fontWeight: '600' }}>
                                                    ⚠️ Batas ujian ulang (2 kali) sudah tercapai!
                                                </small>
                                            )}
                                        </div>

                                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                                            <label className="form-label">
                                                Mahasiswa yang Mengulang
                                                {!loadingMengulang && <span style={{ marginLeft: '8px', color: 'var(--text-muted)' }}>({mengulangStudents.length} mahasiswa)</span>}
                                            </label>
                                            {loadingMengulang ? (
                                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat data...</div>
                                            ) : mengulangStudents.length === 0 ? (
                                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--warning-600)', background: 'var(--warning-50)', borderRadius: 'var(--radius-md)' }}>
                                                    Tidak ada mahasiswa yang mengulang (nilai &lt; 70)
                                                </div>
                                            ) : (
                                                <div style={{
                                                    maxHeight: '150px',
                                                    overflowY: 'auto',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: 'var(--radius-md)',
                                                    background: 'var(--bg-primary)',
                                                    fontSize: '0.85rem'
                                                }}>
                                                    {mengulangStudents.map((s, idx) => (
                                                        <div key={s.id} style={{
                                                            padding: '0.5rem 0.75rem',
                                                            borderBottom: idx < mengulangStudents.length - 1 ? '1px solid var(--border-color)' : 'none',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center'
                                                        }}>
                                                            <span>{s.mahasiswa?.nim_nip} — {s.mahasiswa?.nama}</span>
                                                            <span style={{ color: 'var(--error-600)', fontWeight: '600' }}>
                                                                Nilai: {Math.round(s.nilai_total)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                                ℹ️ Nilai maksimal ujian ulang: 70. Batas ujian ulang: 2 kali.
                                            </small>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                        <div className="form-group">
                            <label className="form-label">Tanggal</label>
                            <input
                                type="date"
                                className="form-input"
                                value={formData.tanggal}
                                onChange={e => setFormData({ ...formData, tanggal: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Waktu Mulai</label>
                                <input
                                    type="time"
                                    className="form-input"
                                    value={formData.waktu_mulai}
                                    onChange={e => setFormData({ ...formData, waktu_mulai: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Waktu Selesai</label>
                                <input
                                    type="time"
                                    className="form-input"
                                    value={formData.waktu_selesai}
                                    onChange={e => setFormData({ ...formData, waktu_selesai: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Durasi Ujian (menit)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={formData.durasi}
                                onChange={e => setFormData({ ...formData, durasi: e.target.value === '' ? '' : parseInt(e.target.value) || '' })}
                                min={1}
                                max={600}
                                required
                                placeholder="Masukkan durasi (menit)"
                            />
                            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                Durasi personal per mahasiswa. Mahasiswa bisa mulai kapan saja dalam jendela waktu di atas.
                            </small>
                        </div>
                        {/* Ruangan */}
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Ruangan</label>
                            <select
                                className="form-input"
                                value={formData.ruangan_id}
                                onChange={e => setFormData({ ...formData, ruangan_id: e.target.value })}
                            >
                                <option value="">Pilih Ruangan</option>
                                {ruangList.map(r => (
                                    <option key={r.id} value={r.id}>{r.nama}</option>
                                ))}
                            </select>
                        </div>
                        {/* Dosen Pengampu */}
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Dosen Pengampu</label>
                            <select
                                className="form-input"
                                value={formData.dosen_id}
                                onChange={e => setFormData({ ...formData, dosen_id: e.target.value })}
                            >
                                <option value="">Pilih Dosen</option>
                                {dosenList.map(d => (
                                    <option key={d.id} value={d.id}>{d.nama} ({d.nim_nip})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
                        <button type="submit" className="btn btn-primary" disabled={isLoading}>
                            {isLoading ? <span className="spinner"></span> : <Save size={16} />}
                            {isLoading ? 'Menyimpan...' : 'Simpan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function JadwalUjianPage() {
    const { user } = useAuth()
    const { settings } = useSettings()
    const { showConfirm } = useConfirm()

    // State
    const [jadwalList, setJadwalList] = useState([])
    const [matkulList, setMatkulList] = useState([])
    const [prodiList, setProdiList] = useState([])
    const [kelasList, setKelasList] = useState([])
    const [ruangList, setRuangList] = useState([])
    const [dosenList, setDosenList] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState(null)
    const [useSupabase, setUseSupabase] = useState(false)

    const [modalOpen, setModalOpen] = useState(false)
    const [editingJadwal, setEditingJadwal] = useState(null)
    const [dateFilter, setDateFilter] = useState('')
    const [prodiFilter, setProdiFilter] = useState(user?.role === 'superadmin' ? 'all' : (user?.prodiId || 'all'))

    // Load data on mount
    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setIsLoading(true)
        setError(null)

        try {
            if (isSupabaseConfigured()) {
                const [jadwalData, matkulData, prodiData, kelasData, ruangData, dosenData] = await Promise.all([
                    jadwalService.getAll(),
                    matkulService.getAll(),
                    prodiService.getAll(),
                    kelasService.getAll(),
                    ruangService.getAll(),
                    userService.getAll({ role: 'dosen' })
                ])
                setJadwalList(jadwalData)
                setMatkulList(matkulData)
                setProdiList(prodiData)
                setKelasList(kelasData)
                setRuangList(ruangData || [])
                setDosenList(dosenData || [])
                setUseSupabase(true)
            } else {
                setJadwalList(jadwal ? JSON.parse(jadwal) : [])
                setMatkulList(matkul ? JSON.parse(matkul) : [])
                setProdiList(prodi ? JSON.parse(prodi) : [])
                setKelasList(kelas ? JSON.parse(kelas) : [])
                setUseSupabase(false)
            }
        } catch (err) {
            console.error('Error loading jadwal:', err)
            setError('Gagal memuat data. Menggunakan data lokal.')
            setJadwalList(jadwal ? JSON.parse(jadwal) : [])
            setMatkulList(matkul ? JSON.parse(matkul) : [])
            setProdiList(prodi ? JSON.parse(prodi) : [])
            setKelasList(kelas ? JSON.parse(kelas) : [])
            setUseSupabase(false)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (jadwalList.length > 0 && !useSupabase) {
        }
    }, [jadwalList, useSupabase])

    const isSuperAdmin = user?.role === 'superadmin'

    // Helper to get prodi_id from jadwal via kelas relation
    const getJadwalProdiId = (j) => {
        if (j.prodi_id || j.prodiId) return j.prodi_id || j.prodiId
        // Otherwise get from kelas
        const kelasId = j.kelas_id || j.kelasId
        const kelas = kelasList.find(k => k.id === kelasId)
        return kelas?.prodi_id || kelas?.prodiId || null
    }
    const getJadwalMatkul = (j) => j.matkul_id || j.matkulId
    const getJadwalKelas = (j) => j.kelas_id || j.kelasId
    const getJadwalTipe = (j) => j.tipe_ujian || j.tipeUjian || j.tipe
    const getJadwalWaktuMulai = (j) => j.waktu_mulai || j.waktuMulai
    const getJadwalWaktuSelesai = (j) => j.waktu_selesai || j.waktuSelesai
    const getJadwalRuang = (j) => j.ruangan?.nama || (typeof j.ruangan === 'string' ? j.ruangan : null) || j.ruang || '-'

    // Filter berdasarkan prodi untuk stats
    const prodiFilteredJadwal = jadwalList.filter(j => {
        const prodiId = getJadwalProdiId(j)
        return isSuperAdmin
            ? (prodiFilter === 'all' || prodiId === prodiFilter)
            : prodiId === user?.prodiId
    })

    const filteredJadwal = prodiFilteredJadwal.filter(j => {
        return !dateFilter || j.tanggal === dateFilter
    }).sort((a, b) => {
        if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal)
        return (getJadwalWaktuMulai(a) || '').localeCompare(getJadwalWaktuMulai(b) || '')
    })

    const handleAdd = () => {
        setEditingJadwal(null)
        setModalOpen(true)
    }

    const handleEdit = (jadwal) => {
        setEditingJadwal(jadwal)
        setModalOpen(true)
    }

    const handleSave = async (data) => {
        setIsSaving(true)
        try {
            const jadwalData = {
                matkul_id: data.matkul_id || data.matkulId,
                kelas_id: data.kelas_id || data.kelasId,
                tipe: data.tipe_ujian || data.tipeUjian || data.tipe || 'UTS',
                tanggal: data.tanggal,
                waktu_mulai: data.waktu_mulai || data.waktuMulai,
                waktu_selesai: data.waktu_selesai || data.waktuSelesai,
                durasi: parseInt(data.durasi) || 90,
                ruangan_id: data.ruangan_id || null,
                dosen_id: data.dosen_id || null,
                tahun_akademik: settings?.tahunAkademik || null,
                parent_jadwal_id: data.parent_jadwal_id || null,
                ulang_ke: data.ulang_ke || 0
            }

            if (useSupabase) {
                if (editingJadwal) {
                    await jadwalService.update(editingJadwal.id, jadwalData)
                } else {
                    await jadwalService.create(jadwalData)
                }
                await loadData()
            } else {
                const localData = {
                    ...jadwalData,
                    prodiId: jadwalData.prodi_id,
                    matkulId: jadwalData.matkul_id,
                    kelasId: jadwalData.kelas_id,
                    tipeUjian: jadwalData.tipe,
                    waktuMulai: jadwalData.waktu_mulai,
                    waktuSelesai: jadwalData.waktu_selesai
                }
                if (editingJadwal) {
                    setJadwalList(jadwalList.map(j => j.id === editingJadwal.id ? { ...localData, id: editingJadwal.id } : j))
                } else {
                    setJadwalList([...jadwalList, { ...localData, id: Date.now() }])
                }
            }
            setModalOpen(false)
        } catch (err) {
            console.error('Error saving jadwal:', err)
            setError('Gagal menyimpan jadwal.')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id) => {
        try {
            // Count related data to warn user
            let relatedInfo = ''
            if (useSupabase) {
                const counts = await jadwalService.countRelated(id)
                const parts = []
                if (counts.hasilUjian > 0) parts.push(`${counts.hasilUjian} hasil ujian`)
                if (counts.jawaban > 0) parts.push(`${counts.jawaban} jawaban mahasiswa`)
                if (counts.kehadiran > 0) parts.push(`${counts.kehadiran} data kehadiran`)
                if (counts.beritaAcara > 0) parts.push(`${counts.beritaAcara} berita acara`)
                if (parts.length > 0) {
                    relatedInfo = `\n\n⚠️ Data terkait: ${parts.join(', ')}\n\nJadwal akan dipindahkan ke Trash dan bisa di-restore kapan saja.`
                }
            }

            showConfirm({
                title: 'Konfirmasi Hapus Jadwal',
                message: `Apakah Anda yakin ingin menghapus jadwal ujian ini?${relatedInfo}`,
                onConfirm: async () => {
                    try {
                        if (useSupabase) {
                            await jadwalService.delete(id) // Soft delete
                            await loadData()
                        } else {
                            setJadwalList(jadwalList.filter(j => j.id !== id))
                        }
                    } catch (err) {
                        console.error('Error deleting:', err)
                        setError('Gagal menghapus jadwal.')
                    }
                }
            })
        } catch (err) {
            console.error('Error checking related data:', err)
            // Fallback to simple confirm if count fails
            showConfirm({
                title: 'Konfirmasi Hapus',
                message: 'Hapus jadwal ujian ini? Jadwal akan dipindahkan ke Trash.',
                onConfirm: async () => {
                    try {
                        if (useSupabase) {
                            await jadwalService.delete(id)
                            await loadData()
                        } else {
                            setJadwalList(jadwalList.filter(j => j.id !== id))
                        }
                    } catch (err2) {
                        console.error('Error deleting:', err2)
                        setError('Gagal menghapus jadwal.')
                    }
                }
            })
        }
    }

    // Trash/Recovery
    const [trashOpen, setTrashOpen] = useState(false)
    const [deletedJadwal, setDeletedJadwal] = useState([])
    const [loadingTrash, setLoadingTrash] = useState(false)

    const loadTrash = async () => {
        if (!useSupabase) return
        setLoadingTrash(true)
        try {
            const deleted = await jadwalService.getDeleted()
            setDeletedJadwal(deleted)
        } catch (err) {
            console.error('Error loading trash:', err)
        } finally {
            setLoadingTrash(false)
        }
    }

    const handleRestore = async (id) => {
        try {
            await jadwalService.restore(id)
            await loadTrash()
            await loadData()
        } catch (err) {
            console.error('Error restoring:', err)
            setError('Gagal memulihkan jadwal.')
        }
    }

    const handlePermanentDelete = async (id) => {
        showConfirm({
            title: '⚠️ Hapus Permanen',
            message: 'PERINGATAN: Tindakan ini TIDAK BISA DIBATALKAN!\n\nSemua data yang terkait (hasil ujian, jawaban, kehadiran, berita acara) juga akan dihapus secara permanen.\n\nLanjutkan hapus permanen?',
            onConfirm: async () => {
                try {
                    await jadwalService.permanentDelete(id)
                    await loadTrash()
                } catch (err) {
                    console.error('Error permanent delete:', err)
                    setError('Gagal menghapus permanen.')
                }
            }
        })
    }

    const getMatkulName = (id) => {
        const m = matkulList.find(mk => mk.id === id)
        return m ? `${m.kode} - ${m.nama}` : '-'
    }

    const getKelasName = (id) => {
        const k = kelasList.find(kl => kl.id === id)
        return k ? `Kelas ${k.nama}` : '-'
    }

    const getProdiName = (prodiId, kelasId) => {
        // First try direct prodiId
        if (prodiId) {
            const p = prodiList.find(pr => pr.id === prodiId)
            if (p) return p.kode
        }
        // Fallback: get prodi from kelas
        if (kelasId) {
            const k = kelasList.find(kl => kl.id === kelasId)
            if (k?.prodi_id || k?.prodiId) {
                const p = prodiList.find(pr => pr.id === (k.prodi_id || k.prodiId))
                if (p) return p.kode
            }
        }
        return '-'
    }

    const getTipeBadge = (tipe) => {
        switch (tipe) {
            case 'UAS': return 'error'
            case 'UTS': return 'warning'
            case 'ULANG': return 'accent'
            default: return 'info'
        }
    }

    // Group by date
    const groupedJadwal = filteredJadwal.reduce((acc, j) => {
        if (!acc[j.tanggal]) acc[j.tanggal] = []
        acc[j.tanggal].push(j)
        return acc
    }, {})

    const handlePrint = () => {
        const printContent = `
            <html>
            <head>
                <title>Jadwal Ujian</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { text-align: center; font-size: 18px; margin-bottom: 5px; }
                    h2 { text-align: center; font-size: 14px; color: #666; margin-bottom: 20px; }
                    .date-section { margin-bottom: 20px; }
                    .date-header { font-weight: bold; background: #f0f0f0; padding: 8px; margin-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background: #f5f5f5; }
                </style>
            </head>
            <body>
                <h1>JADWAL UJIAN</h1>
                <h2>POLTEKTRANS SDP PALEMBANG</h2>
                ${Object.keys(groupedJadwal).sort().map(date => `
                    <div class="date-section">
                        <div class="date-header">${new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Waktu</th>
                                    <th>Mata Kuliah</th>
                                    <th>Kelas</th>
                                    <th>Tipe</th>
                                    <th>Ruang</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${groupedJadwal[date].map(j => `
                                    <tr>
                                        <td>${getJadwalWaktuMulai(j)} - ${getJadwalWaktuSelesai(j)}</td>
                                        <td>${getMatkulName(getJadwalMatkul(j))}</td>
                                        <td>${getKelasName(getJadwalKelas(j))}</td>
                                        <td>${getJadwalTipe(j)}</td>
                                        <td>${getJadwalRuang(j)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `).join('')}
            </body>
            </html>
        `
        const printWindow = window.open('', '_blank')
        printWindow.document.write(printContent)
        printWindow.document.close()
        printWindow.print()
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">
                            Jadwal Ujian
                            <span className={`badge badge-${useSupabase ? 'success' : 'warning'}`} style={{ marginLeft: '12px', fontSize: '12px' }}>
                                {useSupabase ? 'Database' : 'Local'}
                            </span>
                        </h1>
                        <p className="page-subtitle">
                            {isSuperAdmin
                                ? 'Lihat jadwal ujian dari seluruh program studi'
                                : 'Kelola jadwal ujian untuk program studi Anda'}
                        </p>
                    </div>
                    <div className="header-actions">
                        <button className="btn btn-outline" onClick={loadData} disabled={isLoading}>
                            <RefreshCw size={18} className={isLoading ? 'spin' : ''} />
                            {isLoading ? 'Memuat...' : 'Refresh'}
                        </button>
                        {useSupabase && (
                            <button className="btn btn-outline" onClick={() => { setTrashOpen(true); loadTrash() }} style={{ color: 'var(--text-muted)' }}>
                                <Archive size={18} />
                                Trash
                            </button>
                        )}
                        <button className="btn btn-outline" onClick={handlePrint}>
                            <Printer size={18} />
                            Cetak
                        </button>
                        {!isSuperAdmin && (
                            <button className="btn btn-primary" onClick={handleAdd}>
                                <Plus size={18} />
                                Tambah Jadwal
                            </button>
                        )}
                    </div>
                </div>

                {/* Error Alert */}
                {error && (
                    <div className="alert alert-error mb-4" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={18} />
                        {error}
                        <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Stats */}
                <div className="mini-stats">
                    <div className="mini-stat">
                        <span className="mini-stat-value">{prodiFilteredJadwal.length}</span>
                        <span className="mini-stat-label">Total Jadwal</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">{prodiFilteredJadwal.filter(j => j.tipeUjian === 'UTS').length}</span>
                        <span className="mini-stat-label">UTS</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">{prodiFilteredJadwal.filter(j => j.tipeUjian === 'UAS').length}</span>
                        <span className="mini-stat-label">UAS</span>
                    </div>

                </div>

                {/* Filter */}
                <div className="card mb-4">
                    <div className="card-body">
                        <div className="filter-group" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                            <Filter size={16} />
                            {isSuperAdmin && (
                                <>
                                    <span>Program Studi:</span>
                                    <select
                                        className="form-input"
                                        value={prodiFilter}
                                        onChange={e => setProdiFilter(e.target.value)}
                                        style={{ width: 'auto', minWidth: '200px' }}
                                    >
                                        <option value="all">Semua Prodi</option>
                                        {prodiList.map(p => (
                                            <option key={p.id} value={p.id}>{p.kode} - {p.nama}</option>
                                        ))}
                                    </select>
                                </>
                            )}
                            <span>Tanggal:</span>
                            <input
                                type="date"
                                className="form-input"
                                value={dateFilter}
                                onChange={e => setDateFilter(e.target.value)}
                                style={{ width: 'auto' }}
                            />
                            {(dateFilter || (isSuperAdmin && prodiFilter !== 'all')) && (
                                <button className="btn btn-ghost btn-sm" onClick={() => { setDateFilter(''); setProdiFilter('all') }}>
                                    Reset Filter
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Jadwal List */}
                <div className="jadwal-groups">
                    {Object.keys(groupedJadwal).sort().map(date => (
                        <div key={date} className="card mb-4">
                            <div className="card-header">
                                <div className="date-header">
                                    <Calendar size={18} />
                                    <span>{new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                </div>
                                <span className="text-muted">{groupedJadwal[date].length} ujian</span>
                            </div>
                            <div className="card-body">
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Waktu</th>
                                                <th>Mata Kuliah</th>
                                                <th>Kelas</th>
                                                {isSuperAdmin && <th>Prodi</th>}
                                                <th>Tipe</th>
                                                {!isSuperAdmin && <th>Aksi</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {groupedJadwal[date].map(j => (
                                                <tr key={j.id}>
                                                    <td>
                                                        <div className="time-cell">
                                                            <Clock size={14} />
                                                            <span>{getJadwalWaktuMulai(j)} - {getJadwalWaktuSelesai(j)}</span>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px' }}>({j.durasi || 90}m)</span>
                                                        </div>
                                                    </td>
                                                    <td className="font-medium">{getMatkulName(getJadwalMatkul(j))}</td>
                                                    <td>{getKelasName(getJadwalKelas(j))}</td>
                                                    {isSuperAdmin && (
                                                        <td>
                                                            <span className="badge badge-primary">{getProdiName(getJadwalProdiId(j), getJadwalKelas(j))}</span>
                                                        </td>
                                                    )}
                                                    <td>
                                                        <span className={`badge badge-${getTipeBadge(getJadwalTipe(j))}`}>
                                                            {getJadwalTipe(j) === 'ULANG' ? `ULANG-${j.ulang_ke || 1}` : getJadwalTipe(j)}
                                                        </span>
                                                    </td>

                                                    {!isSuperAdmin && (
                                                        <td>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    className="btn btn-icon btn-ghost btn-sm"
                                                                    onClick={() => handleEdit(j)}
                                                                >
                                                                    <Edit2 size={14} />
                                                                </button>
                                                                <button
                                                                    className="btn btn-icon btn-ghost btn-sm text-error"
                                                                    onClick={(e) => { e.stopPropagation(); handleDelete(j.id); }}
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ))}

                    {Object.keys(groupedJadwal).length === 0 && (
                        <div className="empty-state">
                            <Calendar size={48} />
                            <h3>Tidak ada jadwal</h3>
                            <p>Belum ada jadwal ujian yang dibuat</p>
                            <button className="btn btn-primary" onClick={handleAdd}>
                                <Plus size={16} />
                                Tambah Jadwal
                            </button>
                        </div>
                    )}
                </div>

                <JadwalModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    jadwal={editingJadwal}
                    onSave={handleSave}
                    isLoading={isSaving}
                    matkulList={user?.role === 'superadmin' ? matkulList : matkulList.filter(m => (m.prodi_id || m.prodiId) === user?.prodiId)}
                    kelasList={user?.role === 'superadmin' ? kelasList : kelasList.filter(k => (k.prodi_id || k.prodiId) === user?.prodiId)}
                    ruangList={ruangList}
                    dosenList={user?.role === 'superadmin' ? dosenList : dosenList.filter(d => {
                        const adminProdiId = String(user?.prodiId || '')
                        // Check primary prodi_id
                        if (String(d.prodi_id || d.prodiId || '') === adminProdiId) return true
                        // Check prodi_ids array (multi-prodi dosen)
                        let prodiIds = d.prodi_ids
                        if (typeof prodiIds === 'string') {
                            try { prodiIds = JSON.parse(prodiIds) } catch { prodiIds = [] }
                        }
                        if (Array.isArray(prodiIds) && prodiIds.map(String).includes(adminProdiId)) return true
                        return false
                    })}
                    jadwalList={prodiFilteredJadwal}
                />
            </div>

            <style>{`
                .mb-4 {
                    margin-bottom: var(--space-4);
                }
                .filter-group {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                }
                .date-header {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    font-weight: var(--font-semibold);
                }
                .time-cell, .room-cell {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                }
                .time-cell {
                    color: var(--primary-600);
                    font-weight: var(--font-medium);
                }
                .room-cell {
                    color: var(--text-secondary);
                }
                .empty-state {
                    text-align: center;
                    padding: var(--space-12);
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
                .empty-state p {
                    margin-bottom: var(--space-4);
                }
                .text-error {
                    color: var(--error-500);
                }
                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--space-4);
                }
                /* Trash Modal */
                .trash-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.5);
                    z-index: 1000;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 2rem;
                }
                .trash-modal {
                    background: var(--bg-primary);
                    border-radius: var(--radius-xl);
                    width: 100%;
                    max-width: 700px;
                    max-height: 80vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                .trash-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.5rem;
                    border-bottom: 1px solid var(--border-color);
                }
                .trash-header h2 {
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 1.1rem;
                }
                .trash-body {
                    overflow-y: auto;
                    padding: 1rem 1.5rem;
                    flex: 1;
                }
                .trash-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.75rem 1rem;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-md);
                    margin-bottom: 0.5rem;
                    border-left: 3px solid var(--error-400);
                }
                .trash-item-info h4 {
                    margin: 0 0 2px;
                    font-size: 0.9rem;
                }
                .trash-item-info p {
                    margin: 0;
                    font-size: 0.8rem;
                    color: var(--text-muted);
                }
                .trash-actions {
                    display: flex;
                    gap: 0.5rem;
                }
            `}</style>

            {/* Trash Modal */}
            {trashOpen && (
                <div className="trash-overlay" onClick={() => setTrashOpen(false)}>
                    <div className="trash-modal" onClick={e => e.stopPropagation()}>
                        <div className="trash-header">
                            <h2><Archive size={20} /> Trash - Jadwal Terhapus</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setTrashOpen(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="trash-body">
                            {loadingTrash ? (
                                <div className="empty-state" style={{ padding: '2rem' }}>
                                    <RefreshCw size={24} className="spin" style={{ color: 'var(--primary)' }} />
                                    <p>Memuat data...</p>
                                </div>
                            ) : deletedJadwal.length === 0 ? (
                                <div className="empty-state" style={{ padding: '2rem' }}>
                                    <Archive size={32} />
                                    <p>Trash kosong — tidak ada jadwal yang dihapus</p>
                                </div>
                            ) : (
                                deletedJadwal.map(j => (
                                    <div key={j.id} className="trash-item">
                                        <div className="trash-item-info">
                                            <h4>{j.tipe?.toUpperCase()} {j.matkul?.nama || '-'}</h4>
                                            <p>
                                                {j.kelas?.nama || '-'} • {j.tanggal} • Dosen: {j.dosen?.nama || '-'}
                                                <br />
                                                <span style={{ color: 'var(--error-500)', fontSize: '0.75rem' }}>
                                                    Dihapus: {new Date(j.deleted_at).toLocaleString('id-ID')}
                                                </span>
                                            </p>
                                        </div>
                                        <div className="trash-actions">
                                            <button
                                                className="btn btn-sm"
                                                style={{ background: 'var(--success-500)', color: '#fff', fontSize: '0.8rem' }}
                                                onClick={() => handleRestore(j.id)}
                                                title="Pulihkan jadwal"
                                            >
                                                <RotateCcw size={14} />
                                                Restore
                                            </button>
                                            <button
                                                className="btn btn-sm"
                                                style={{ background: 'var(--error-500)', color: '#fff', fontSize: '0.8rem' }}
                                                onClick={() => handlePermanentDelete(j.id)}
                                                title="Hapus permanen"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}

export default JadwalUjianPage
