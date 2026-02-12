import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useSettings } from '../../contexts/SettingsContext'
import { useAuth } from '../../App'
import { prodiService, kelasService, userService, ruangService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    Layout,
    Shuffle,
    Printer,
    Users,
    Grid,
    User,
    Settings2,
    Plus,
    Edit2,
    Trash2,
    Save,
    X
} from 'lucide-react'

// LocalStorage keys
const PRODI_STORAGE_KEY = 'cat_prodi_data'
const KELAS_STORAGE_KEY = 'cat_kelas_data'
const USERS_STORAGE_KEY = 'cat_users_data'
const EXAM_ROOMS_KEY = 'cat_exam_rooms'

// Helper for field compatibility
const getField = (obj, snakeCase, camelCase) => obj?.[snakeCase] || obj?.[camelCase]

// Default prodi colors
const DEFAULT_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899', '#10b981']

// Fisher-Yates shuffle algorithm
function shuffleArray(array) {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
}

function ExamRoomPage() {
    const { settings } = useSettings()
    const { user: currentUser } = useAuth()
    const [rooms, setRooms] = useState([])
    const [selectedRoom, setSelectedRoom] = useState(0)
    const [isAllocated, setIsAllocated] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const printRef = useRef(null)

    // Ruangan management
    const [ruangList, setRuangList] = useState([])
    const [editingRuang, setEditingRuang] = useState(null)
    const [editingRuangName, setEditingRuangName] = useState(null)
    const [newRuangName, setNewRuangName] = useState('')
    const [newRuangKapasitas, setNewRuangKapasitas] = useState(30)
    const [showAddRuang, setShowAddRuang] = useState(false)

    // Load from Supabase or localStorage
    const [prodiList, setProdiList] = useState([])
    const [kelasList, setKelasList] = useState([])
    const [mahasiswaData, setMahasiswaData] = useState([])

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true)
            try {
                let prodiData = []
                let kelasData = []
                let usersData = []
                let ruangData = []

                if (isSupabaseConfigured()) {
                    console.log('[ExamRoom] Loading from Supabase...')
                    const [prodi, kelas, users, ruang] = await Promise.all([
                        prodiService.getAll(),
                        kelasService.getAll(),
                        userService.getAll({ role: 'mahasiswa' }),
                        ruangService.getAll()
                    ])
                    prodiData = prodi.map((p, idx) => ({
                        ...p,
                        color: p.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
                    }))
                    kelasData = kelas
                    usersData = users
                    ruangData = ruang
                    console.log('[ExamRoom] Loaded from Supabase:', usersData.length, 'mahasiswa,', ruangData.length, 'ruangan')
                } else {
                    console.log('[ExamRoom] Loading from localStorage...')
                    const prodi = localStorage.getItem(PRODI_STORAGE_KEY)
                    const kelas = localStorage.getItem(KELAS_STORAGE_KEY)
                    const users = localStorage.getItem(USERS_STORAGE_KEY)

                    prodiData = prodi ? JSON.parse(prodi).map((p, idx) => ({
                        ...p,
                        color: p.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
                    })) : []
                    kelasData = kelas ? JSON.parse(kelas) : []
                    const allUsers = users ? JSON.parse(users) : []
                    usersData = allUsers.filter(u => u.role === 'mahasiswa')
                }

                setProdiList(prodiData)
                setKelasList(kelasData)
                setRuangList(ruangData)

                // Map mahasiswa with prodi info
                const mhs = usersData.map(u => {
                    const kelasId = getField(u, 'kelas_id', 'kelasId')
                    const userKelas = kelasData.find(k => String(k.id) === String(kelasId))
                    const derivedProdiId = getField(u, 'prodi_id', 'prodiId') || getField(userKelas, 'prodi_id', 'prodiId') || null
                    return {
                        id: u.id,
                        name: u.nama || u.name,
                        nim: u.nim || u.nim_nip || '',
                        prodiId: derivedProdiId,
                        kelasId: kelasId,
                        photo: u.photo
                    }
                })
                console.log('[ExamRoom] Mapped mahasiswa:', mhs.length)
                setMahasiswaData(mhs)

                // Load existing room allocation
                const savedRooms = localStorage.getItem(EXAM_ROOMS_KEY)
                if (savedRooms) {
                    try {
                        const roomData = JSON.parse(savedRooms)
                        if (roomData.rooms && roomData.rooms.length > 0) {
                            setRooms(roomData.rooms)
                            setIsAllocated(true)
                        }
                    } catch (e) {
                        console.error('Error loading saved rooms:', e)
                    }
                }
            } catch (err) {
                console.error('[ExamRoom] Error loading data:', err)
            } finally {
                setIsLoading(false)
            }
        }
        loadData()
    }, [currentUser])

    // Ruang CRUD handlers
    const handleAddRuang = async () => {
        if (!newRuangName.trim()) return
        try {
            if (isSupabaseConfigured()) {
                const created = await ruangService.create({ nama: newRuangName.trim(), kapasitas: newRuangKapasitas })
                setRuangList([...ruangList, created])
            } else {
                setRuangList([...ruangList, { id: Date.now(), nama: newRuangName.trim(), kapasitas: newRuangKapasitas }])
            }
            setNewRuangName('')
            setNewRuangKapasitas(30)
            setShowAddRuang(false)
        } catch (err) {
            console.error('Error adding ruang:', err)
            alert('Gagal menambah ruangan: ' + err.message)
        }
    }

    const handleUpdateRuangKapasitas = async (ruangId, kapasitas) => {
        const kap = Math.max(1, Math.min(1000, parseInt(kapasitas) || 30))
        try {
            if (isSupabaseConfigured()) {
                await ruangService.update(ruangId, { kapasitas: kap })
            }
            setRuangList(ruangList.map(r => r.id === ruangId ? { ...r, kapasitas: kap } : r))
            setEditingRuang(null)
        } catch (err) {
            console.error('Error updating ruang:', err)
        }
    }

    const handleUpdateRuangName = async (ruangId, nama) => {
        const trimmed = (nama || '').trim()
        if (!trimmed) { setEditingRuangName(null); return }
        try {
            if (isSupabaseConfigured()) {
                await ruangService.update(ruangId, { nama: trimmed })
            }
            setRuangList(ruangList.map(r => r.id === ruangId ? { ...r, nama: trimmed } : r))
            setEditingRuangName(null)
        } catch (err) {
            console.error('Error updating ruang name:', err)
        }
    }

    const handleDeleteRuang = async (ruangId) => {
        if (!confirm('Hapus ruangan ini?')) return
        try {
            if (isSupabaseConfigured()) {
                await ruangService.delete(ruangId)
            }
            setRuangList(ruangList.filter(r => r.id !== ruangId))
        } catch (err) {
            console.error('Error deleting ruang:', err)
            alert('Gagal menghapus ruangan: ' + err.message)
        }
    }

    // Total capacity from all rooms
    const totalKapasitas = ruangList.reduce((sum, r) => sum + (r.kapasitas || 30), 0)

    // Allocate students to rooms with interleaved prodi
    const allocateRooms = () => {
        if (mahasiswaData.length === 0 || ruangList.length === 0) {
            alert('Tidak ada ruangan atau mahasiswa untuk dialokasikan')
            return
        }

        // Group students by prodi (use String comparison for prodiId)
        const studentsByProdi = {}
        prodiList.forEach(p => {
            studentsByProdi[p.id] = shuffleArray(
                mahasiswaData.filter(m => String(m.prodiId) === String(p.id))
            )
        })

        // Get list of prodi IDs that have students
        const prodiIds = Object.keys(studentsByProdi).filter(
            id => studentsByProdi[id].length > 0
        )

        // Interleave students from different prodi
        const allStudents = []
        let hasMore = true
        let prodiIndex = 0

        while (hasMore) {
            hasMore = false
            const startIndex = prodiIndex

            do {
                const pid = prodiIds[prodiIndex % prodiIds.length]
                if (studentsByProdi[pid] && studentsByProdi[pid].length > 0) {
                    allStudents.push(studentsByProdi[pid].shift())
                    hasMore = true
                }
                prodiIndex++
            } while (prodiIds.length > 0 && prodiIndex % prodiIds.length !== startIndex % prodiIds.length)
        }

        // Split into rooms based on EACH room's individual capacity
        const roomsData = []
        let examNumber = 1
        let studentIndex = 0

        for (const ruang of ruangList) {
            if (studentIndex >= allStudents.length) break
            const cap = ruang.kapasitas || 30
            const roomStudents = allStudents.slice(studentIndex, studentIndex + cap).map(student => ({
                ...student,
                examNumber: `UJIAN-${String(examNumber++).padStart(3, '0')}`
            }))
            studentIndex += cap

            roomsData.push({
                id: ruang.id,
                name: ruang.nama,
                kapasitas: cap,
                students: roomStudents,
                rows: Math.ceil(roomStudents.length / 5),
                cols: 5
            })
        }

        // If there are remaining students and not enough rooms, add overflow
        if (studentIndex < allStudents.length) {
            const overflow = allStudents.slice(studentIndex).map(student => ({
                ...student,
                examNumber: `UJIAN-${String(examNumber++).padStart(3, '0')}`
            }))
            roomsData.push({
                id: 'overflow',
                name: 'Ruang Tambahan (Overflow)',
                kapasitas: overflow.length,
                students: overflow,
                rows: Math.ceil(overflow.length / 5),
                cols: 5
            })
        }

        setRooms(roomsData)
        setSelectedRoom(0)
        setIsAllocated(true)

        // Save to localStorage
        const roomAllocation = {
            rooms: roomsData,
            allocatedAt: new Date().toISOString(),
            allocatedBy: currentUser?.username || currentUser?.nama || 'Unknown'
        }
        localStorage.setItem(EXAM_ROOMS_KEY, JSON.stringify(roomAllocation))
        console.log('[ExamRoom] Allocated:', roomsData.length, 'rooms')
    }

    const handlePrint = () => {
        const printContent = printRef.current
        const originalContents = document.body.innerHTML
        document.body.innerHTML = printContent.innerHTML
        window.print()
        document.body.innerHTML = originalContents
        window.location.reload()
    }

    const getProdiColor = (prodiId) => {
        const prodi = prodiList.find(p => p.id === prodiId)
        return prodi?.color || '#6b7280'
    }

    const getProdiKode = (prodiId) => {
        const prodi = prodiList.find(p => p.id === prodiId)
        return prodi?.kode || '-'
    }

    const currentRoom = rooms[selectedRoom]

    // Generate seat grid for current room
    const generateSeatGrid = (room) => {
        if (!room) return []
        const grid = []
        for (let row = 0; row < room.rows; row++) {
            const rowSeats = []
            for (let col = 0; col < room.cols; col++) {
                const seatIndex = row * room.cols + col
                const student = room.students[seatIndex]
                rowSeats.push({
                    seatNumber: seatIndex + 1,
                    student
                })
            }
            grid.push(rowSeats)
        }
        return grid
    }

    return (
        <DashboardLayout>
            <div className="exam-room-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Ruang Ujian</h1>
                        <p className="page-subtitle">Alokasi peserta dan denah tempat duduk ujian</p>
                    </div>
                    <div className="page-actions">
                        {isAllocated && (
                            <button className="btn btn-outline" onClick={handlePrint}>
                                <Printer size={18} />
                                Print Denah
                            </button>
                        )}
                        <button className="btn btn-primary" onClick={allocateRooms} disabled={mahasiswaData.length === 0}>
                            <Shuffle size={18} />
                            {isAllocated ? 'Acak Ulang' : 'Acak & Alokasikan'}
                        </button>
                    </div>
                </div>

                {/* Room Management */}
                <div className="config-section card mb-4">
                    <div className="card-body">
                        <div className="config-row" style={{ marginBottom: '1rem' }}>
                            <div className="config-item">
                                <Users size={18} />
                                <span>Total Peserta: <strong>{mahasiswaData.length}</strong></span>
                            </div>
                            <div className="config-item">
                                <Layout size={18} />
                                <span>Total Kapasitas: <strong>{totalKapasitas}</strong></span>
                            </div>
                            <div className="config-item">
                                <Grid size={18} />
                                <span>Jumlah Ruangan: <strong>{ruangList.length}</strong></span>
                            </div>
                        </div>

                        {/* Room list with editable capacity */}
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Daftar Ruangan</h4>
                                <button className="btn btn-sm btn-outline" onClick={() => setShowAddRuang(!showAddRuang)}>
                                    <Plus size={14} /> Tambah Ruangan
                                </button>
                            </div>

                            {showAddRuang && (
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Nama ruangan..."
                                        value={newRuangName}
                                        onChange={e => setNewRuangName(e.target.value)}
                                        style={{ flex: 1 }}
                                    />
                                    <input
                                        type="number"
                                        className="form-input"
                                        placeholder="Kapasitas"
                                        value={newRuangKapasitas}
                                        onChange={e => setNewRuangKapasitas(parseInt(e.target.value) || 30)}
                                        min={1}
                                        max={1000}
                                        style={{ width: '100px' }}
                                    />
                                    <button className="btn btn-sm btn-primary" onClick={handleAddRuang}>
                                        <Save size={14} /> Simpan
                                    </button>
                                    <button className="btn btn-sm btn-ghost" onClick={() => setShowAddRuang(false)}>
                                        <X size={14} />
                                    </button>
                                </div>
                            )}

                            {ruangList.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Belum ada ruangan. Tambahkan ruangan terlebih dahulu.</p>
                            ) : (
                                <div className="table-container">
                                    <table className="table" style={{ fontSize: '0.875rem' }}>
                                        <thead>
                                            <tr>
                                                <th>No</th>
                                                <th>Nama Ruangan</th>
                                                <th>Kapasitas</th>
                                                <th style={{ width: '100px' }}>Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ruangList.map((ruang, idx) => (
                                                <tr key={ruang.id}>
                                                    <td>{idx + 1}</td>
                                                    <td>
                                                        {editingRuangName === ruang.id ? (
                                                            <input
                                                                type="text"
                                                                className="form-input"
                                                                defaultValue={ruang.nama}
                                                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') handleUpdateRuangName(ruang.id, e.target.value)
                                                                    if (e.key === 'Escape') setEditingRuangName(null)
                                                                }}
                                                                onBlur={e => handleUpdateRuangName(ruang.id, e.target.value)}
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            <span
                                                                style={{ cursor: 'pointer' }}
                                                                onClick={() => setEditingRuangName(ruang.id)}
                                                                title="Klik untuk edit nama ruangan"
                                                            >
                                                                {ruang.nama}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {editingRuang === ruang.id ? (
                                                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                                                <input
                                                                    type="number"
                                                                    className="form-input"
                                                                    defaultValue={ruang.kapasitas}
                                                                    min={1}
                                                                    max={1000}
                                                                    style={{ width: '80px', padding: '0.25rem 0.5rem' }}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') handleUpdateRuangKapasitas(ruang.id, e.target.value)
                                                                        if (e.key === 'Escape') setEditingRuang(null)
                                                                    }}
                                                                    onBlur={e => handleUpdateRuangKapasitas(ruang.id, e.target.value)}
                                                                    autoFocus
                                                                />
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>peserta</span>
                                                            </div>
                                                        ) : (
                                                            <span
                                                                style={{ cursor: 'pointer', color: 'var(--primary-600)', fontWeight: 600 }}
                                                                onClick={() => setEditingRuang(ruang.id)}
                                                                title="Klik untuk edit kapasitas"
                                                            >
                                                                {ruang.kapasitas || 30} peserta
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                            <button className="btn btn-icon btn-ghost btn-sm" onClick={() => setEditingRuang(ruang.id)} title="Edit kapasitas">
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button className="btn btn-icon btn-ghost btn-sm" onClick={() => handleDeleteRuang(ruang.id)} title="Hapus" style={{ color: 'var(--danger-500)' }}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Prodi Legend */}
                        <div className="prodi-legend">
                            {prodiList.map(p => (
                                <div key={p.id} className="legend-item">
                                    <span className="legend-color" style={{ background: p.color || '#6b7280' }}></span>
                                    <span className="legend-text">{p.kode}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {mahasiswaData.length === 0 ? (
                    <div className="empty-state card">
                        <div className="card-body">
                            <Users size={64} />
                            <h3>Tidak Ada Mahasiswa</h3>
                            <p>Belum ada data mahasiswa untuk dialokasikan ke ruang ujian.</p>
                        </div>
                    </div>
                ) : !isAllocated ? (
                    <div className="empty-state card">
                        <div className="card-body">
                            <Grid size={64} />
                            <h3>Belum Ada Alokasi</h3>
                            <p>Klik tombol "Acak & Alokasikan" untuk mengacak peserta ke ruangan ujian</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Room Tabs */}
                        <div className="room-tabs">
                            {rooms.map((room, index) => (
                                <button
                                    key={room.id}
                                    className={`room-tab ${selectedRoom === index ? 'active' : ''}`}
                                    onClick={() => setSelectedRoom(index)}
                                >
                                    <Layout size={16} />
                                    {room.name}
                                    <span className="badge">{room.students.length}</span>
                                </button>
                            ))}
                        </div>

                        {/* Seating Chart */}
                        {currentRoom && (
                            <div className="seating-section card">
                                <div className="card-header">
                                    <h3>{currentRoom.name}</h3>
                                    <span className="room-info">{currentRoom.students.length} Peserta</span>
                                </div>
                                <div className="card-body">
                                    <div className="seating-chart">
                                        <div className="board-indicator">
                                            <span>📋 PAPAN TULIS / LAYAR</span>
                                        </div>
                                        <div className="seats-grid" style={{ gridTemplateColumns: `repeat(${currentRoom.cols}, 1fr)` }}>
                                            {generateSeatGrid(currentRoom).flat().map((seat, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`seat ${seat.student ? 'occupied' : 'empty'}`}
                                                    style={{
                                                        borderColor: seat.student ? getProdiColor(seat.student.prodiId) : undefined
                                                    }}
                                                >
                                                    {seat.student ? (
                                                        <>
                                                            <div
                                                                className="seat-prodi"
                                                                style={{ background: getProdiColor(seat.student.prodiId) }}
                                                            >
                                                                {getProdiKode(seat.student.prodiId)}
                                                            </div>
                                                            <div className="seat-number">{seat.student.examNumber}</div>
                                                            <div className="seat-name" title={seat.student.name}>
                                                                {seat.student.name}
                                                            </div>
                                                            <div className="seat-nim">{seat.student.nim}</div>
                                                        </>
                                                    ) : (
                                                        <span className="seat-empty">-</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Student List */}
                        <div className="student-list card">
                            <div className="card-header">
                                <h3>Daftar Peserta - {currentRoom?.name}</h3>
                            </div>
                            <div className="card-body">
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>No. Kursi</th>
                                                <th>No. Peserta</th>
                                                <th>Nama</th>
                                                <th>NIM</th>
                                                <th>Prodi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentRoom?.students.map((student, idx) => (
                                                <tr key={student.id}>
                                                    <td>{idx + 1}</td>
                                                    <td>
                                                        <span className="badge badge-primary">{student.examNumber}</span>
                                                    </td>
                                                    <td>{student.name}</td>
                                                    <td>{student.nim}</td>
                                                    <td>
                                                        <span
                                                            className="prodi-badge"
                                                            style={{ background: `${getProdiColor(student.prodiId)}20`, color: getProdiColor(student.prodiId) }}
                                                        >
                                                            {getProdiKode(student.prodiId)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Print Template */}
            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    <style>{`
                        @page { size: A4 landscape; margin: 10mm; }
                        * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif !important; }
                        body { font-size: 9pt; }
                        .print-header { display: flex; align-items: center; gap: 15px; border-bottom: 3px solid #0891b2; padding-bottom: 10px; margin-bottom: 15px; }
                        .print-logo { width: 50px; height: 50px; object-fit: contain; }
                        .print-institution h2 { font-size: 14pt; color: #0891b2; margin: 0; }
                        .print-institution p { font-size: 9pt; color: #666; margin: 2px 0 0; }
                        .print-title { text-align: center; font-size: 16pt; font-weight: bold; margin: 10px 0; color: #1f2937; }
                        .print-room-name { text-align: center; font-size: 13pt; color: #0891b2; margin-bottom: 15px; }
                        .print-board { background: #e5e7eb; padding: 8px; text-align: center; font-weight: bold; margin-bottom: 15px; border-radius: 4px; }
                        .print-seats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 20px; }
                        .print-seat { border: 2px solid #ddd; border-radius: 6px; padding: 8px; text-align: center; min-height: 80px; }
                        .print-seat-prodi { display: inline-block; padding: 2px 8px; border-radius: 3px; color: white; font-size: 8pt; font-weight: bold; margin-bottom: 4px; }
                        .print-seat-number { font-size: 11pt; font-weight: bold; color: #0891b2; margin-bottom: 2px; }
                        .print-seat-name { font-size: 8pt; font-weight: 600; color: #1f2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                        .print-seat-nim { font-size: 7pt; color: #666; }
                        .print-legend { display: flex; gap: 20px; justify-content: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd; }
                        .print-legend-item { display: flex; align-items: center; gap: 5px; font-size: 8pt; }
                        .print-legend-color { width: 15px; height: 15px; border-radius: 3px; }
                        .page-break { page-break-after: always; }
                    `}</style>

                    {rooms.map((room, roomIndex) => (
                        <div key={room.id} className={roomIndex < rooms.length - 1 ? 'page-break' : ''}>
                            <div className="print-header">
                                {settings?.logoUrl ? (
                                    <img src={settings.logoUrl} alt="Logo" className="print-logo" />
                                ) : (
                                    <div style={{ width: 50, height: 50, background: 'linear-gradient(135deg, #0891b2, #0e7490)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>CAT</div>
                                )}
                                <div className="print-institution">
                                    <h2>{settings?.institution || 'Politeknik Transportasi SDP Palembang'}</h2>
                                    <p>{settings?.address || 'Jl. Residen Abdul Rozak, Palembang'}</p>
                                </div>
                            </div>

                            <div className="print-title">DENAH TEMPAT DUDUK UJIAN</div>
                            <div className="print-room-name">{room.name} - {room.students.length} Peserta</div>

                            <div className="print-board">📋 PAPAN TULIS / LAYAR</div>

                            <div className="print-seats">
                                {room.students.map((student) => (
                                    <div key={student.id} className="print-seat" style={{ borderColor: getProdiColor(student.prodiId) }}>
                                        <div className="print-seat-prodi" style={{ background: getProdiColor(student.prodiId) }}>
                                            {getProdiKode(student.prodiId)}
                                        </div>
                                        <div className="print-seat-number">{student.examNumber}</div>
                                        <div className="print-seat-name">{student.name}</div>
                                        <div className="print-seat-nim">{student.nim}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="print-legend">
                                {prodiList.map(p => (
                                    <div key={p.id} className="print-legend-item">
                                        <span className="print-legend-color" style={{ background: p.color || '#6b7280' }}></span>
                                        <span>{p.kode} - {p.nama}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
                .exam-room-page { padding: 0; }
                .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }
                .page-actions { display: flex; gap: 0.75rem; }
                .mb-4 { margin-bottom: 1.5rem; }
                .config-row { display: flex; flex-wrap: wrap; gap: 2rem; align-items: center; margin-bottom: 1rem; }
                .config-item { display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); }
                .config-item label { font-weight: 500; }
                .config-item strong { color: var(--primary-600); font-weight: 700; }
                .config-item .form-input { width: auto; min-width: 150px; }
                .prodi-legend { display: flex; flex-wrap: wrap; gap: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color); }
                .legend-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
                .legend-color { width: 16px; height: 16px; border-radius: 4px; }
                .legend-text { color: var(--text-secondary); }
                .empty-state { text-align: center; padding: 4rem 2rem; color: var(--text-muted); }
                .empty-state h3 { margin: 1rem 0 0.5rem; color: var(--text-primary); }
                .room-tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem; }
                .room-tab { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem; background: var(--bg-primary); border: 2px solid var(--border-color); border-radius: 0.75rem; cursor: pointer; font-weight: 500; color: var(--text-secondary); transition: all 0.2s; }
                .room-tab:hover { border-color: var(--primary-600); color: var(--primary-600); }
                .room-tab.active { background: var(--primary-600); border-color: var(--primary-600); color: white; }
                .room-tab .badge { padding: 0.25rem 0.5rem; font-size: 0.75rem; background: rgba(255,255,255,0.2); border-radius: 0.5rem; }
                .room-tab.active .badge { background: rgba(255,255,255,0.3); }
                .seating-section { margin-bottom: 1.5rem; }
                .card-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); }
                .card-header h3 { margin: 0; font-size: 1.125rem; }
                .room-info { font-size: 0.875rem; color: var(--primary-600); font-weight: 500; }
                .seating-chart { padding: 1.5rem; }
                .board-indicator { background: var(--bg-tertiary); padding: 0.75rem; text-align: center; font-weight: 600; margin-bottom: 1.5rem; border-radius: 0.5rem; color: var(--text-secondary); }
                .seats-grid { display: grid; gap: 0.75rem; }
                .seat { background: var(--bg-primary); border: 2px solid var(--border-color); border-radius: 0.75rem; padding: 0.75rem; text-align: center; min-height: 100px; display: flex; flex-direction: column; justify-content: center; transition: all 0.2s; }
                .seat.occupied:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                .seat-prodi { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 0.25rem; color: white; font-size: 0.625rem; font-weight: 700; margin-bottom: 0.25rem; letter-spacing: 0.5px; }
                .seat-number { font-size: 0.875rem; font-weight: 700; color: var(--primary-600); margin-bottom: 0.25rem; }
                .seat-name { font-size: 0.75rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .seat-nim { font-size: 0.625rem; color: var(--text-muted); }
                .seat-empty { color: var(--text-muted); font-size: 1.5rem; }
                .prodi-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 0.5rem; font-size: 0.75rem; font-weight: 600; }
                .student-list { margin-top: 1.5rem; }
                @media (max-width: 768px) { .page-header { flex-direction: column; } .page-actions { width: 100%; } .page-actions button { flex: 1; } .config-row { flex-direction: column; gap: 1rem; align-items: flex-start; } .seats-grid { grid-template-columns: repeat(3, 1fr) !important; } }
            `}</style>
        </DashboardLayout>
    )
}

export default ExamRoomPage
