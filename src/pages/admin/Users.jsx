import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { downloadTemplate, importFromFile, isValidSpreadsheetFile } from '../../utils/excelUtils'
import { useAuth } from '../../App'
import { useConfirm } from '../../components/ConfirmDialog'
import { userService, prodiService, kelasService, matkulService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    Users,
    Search,
    Plus,
    Edit2,
    Trash2,
    UserCheck,
    UserX,
    Filter,
    ChevronLeft,
    ChevronRight,
    X,
    Save,
    Camera,
    Check,
    Eye,
    EyeOff,
    Download,
    Upload,
    FileSpreadsheet,
    ChevronDown,
    RefreshCw,
    AlertCircle
} from 'lucide-react'
import '../admin/Dashboard.css'

// LocalStorage keys for fallback
const STORAGE_KEY = 'cat_users_data'
const PRODI_STORAGE_KEY = 'cat_prodi_data'
const KELAS_STORAGE_KEY = 'cat_kelas_data'
const MATKUL_STORAGE_KEY = 'cat_matkul_data'

// Multi-Select Component
function MultiSelect({ options, selected, onChange, placeholder, getLabel }) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    const toggleOption = (id) => {
        if (selected.includes(id)) {
            onChange(selected.filter(s => s !== id))
        } else {
            onChange([...selected, id])
        }
    }

    // Filter options based on search term
    const filteredOptions = options.filter(opt => {
        const label = getLabel(opt).toLowerCase()
        return label.includes(searchTerm.toLowerCase())
    })

    return (
        <div className="multi-select">
            <div className="multi-select-trigger" onClick={() => setIsOpen(!isOpen)}>
                {selected.length === 0 ? (
                    <span className="placeholder">{placeholder}</span>
                ) : (
                    <div className="selected-tags">
                        {selected.slice(0, 2).map(id => {
                            const opt = options.find(o => o.id === id)
                            return opt ? (
                                <span key={id} className="selected-tag">
                                    {getLabel(opt)}
                                </span>
                            ) : null
                        })}
                        {selected.length > 2 && (
                            <span className="selected-tag more">+{selected.length - 2}</span>
                        )}
                    </div>
                )}
            </div>
            {isOpen && (
                <div className="multi-select-dropdown multi-select-dropdown-up">
                    <div className="multi-select-search">
                        <input
                            type="text"
                            placeholder="Cari..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            autoFocus
                        />
                    </div>
                    <div className="multi-select-options">
                        {filteredOptions.length === 0 ? (
                            <div className="multi-select-empty">Tidak ada hasil</div>
                        ) : (
                            filteredOptions.map(opt => (
                                <label key={opt.id} className="multi-select-option">
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(opt.id)}
                                        onChange={() => toggleOption(opt.id)}
                                    />
                                    <span className="checkmark"><Check size={12} /></span>
                                    {getLabel(opt)}
                                </label>
                            ))
                        )}
                    </div>
                </div>
            )}
            {isOpen && <div className="multi-select-backdrop" onClick={() => { setIsOpen(false); setSearchTerm(''); }} />}
        </div>
    )
}

function UserModal({ isOpen, onClose, user, onSave, currentUser, prodiList = [], kelasList = [], matkulList = [] }) {
    const [formData, setFormData] = useState(user || {
        name: '',
        username: '',
        email: '',
        role: 'mahasiswa',
        nim: '',
        status: 'active',
        // Mahasiswa fields
        prodiId: prodiList[0]?.id || '',
        kelasId: '',
        photo: null,
        // Dosen fields
        prodiIds: [],
        kelasIds: [],
        matkulIds: []
    })
    const [photoPreview, setPhotoPreview] = useState(null)
    const [showPassword, setShowPassword] = useState(false)

    // Reset form when user changes
    useEffect(() => {
        if (user) {
            // When editing, make sure NIM is only set for mahasiswa
            setFormData({
                ...user,
                nim: user.role === 'mahasiswa' ? (user.nim || '') : '',
                nip: user.role === 'dosen' ? (user.nip || '') : ''
            })
            setPhotoPreview(user.photo)
        } else {
            // For Admin Prodi, auto-assign their prodi to new mahasiswa
            const defaultProdiId = currentUser?.role === 'admin_prodi'
                ? currentUser.prodiId
                : prodiList[0]?.id || ''
            setFormData({
                name: '',
                username: '',
                email: '',
                role: 'mahasiswa',
                nim: '',
                status: 'active',
                prodiId: defaultProdiId,
                kelasId: '',
                photo: null,
                prodiIds: [],
                kelasIds: [],
                matkulIds: []
            })
            setPhotoPreview(null)
        }
    }, [user, isOpen, currentUser])

    // Get filtered kelas based on selected prodi (for mahasiswa)
    const filteredKelas = kelasList.filter(k => (k.prodiId || k.prodi_id) === formData.prodiId)

    // Get filtered kelas and matkul based on selected prodiIds (for dosen)
    const filteredKelasForDosen = kelasList.filter(k => formData.prodiIds?.includes(k.prodiId || k.prodi_id))
    const filteredMatkulForDosen = matkulList.filter(m => formData.prodiIds?.includes(m.prodiId || m.prodi_id))

    const handlePhotoChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setPhotoPreview(reader.result)
                setFormData({ ...formData, photo: reader.result })
            }
            reader.readAsDataURL(file)
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave(formData)
        // Modal will be closed by parent on successful save
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{user ? 'Edit User' : 'Tambah User Baru'}</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Photo Upload for Mahasiswa */}
                        {formData.role === 'mahasiswa' && (
                            <div className="photo-upload-section">
                                <div className="photo-preview">
                                    {photoPreview ? (
                                        <img src={photoPreview} alt="Preview" />
                                    ) : (
                                        <div className="photo-placeholder">
                                            <Camera size={32} />
                                        </div>
                                    )}
                                </div>
                                <label className="photo-upload-btn">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePhotoChange}
                                        hidden
                                    />
                                    <Camera size={16} />
                                    Upload Foto
                                </label>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Nama Lengkap</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Username</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">
                                    NIM/NIP
                                    {formData.role === 'mahasiswa' && <span className="required-label"> *</span>}
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.nim}
                                    onChange={e => setFormData({ ...formData, nim: e.target.value })}
                                    placeholder={formData.role === 'mahasiswa' ? 'Wajib diisi' : 'Kosongkan jika tidak ada'}
                                    required={formData.role === 'mahasiswa'}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">
                                Email
                                <span className="optional-label"> (Opsional)</span>
                            </label>
                            <input
                                type="email"
                                className="form-input"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                placeholder="Kosongkan jika tidak ada"
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Role</label>
                                <select
                                    className="form-input"
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="mahasiswa">Mahasiswa</option>
                                    <option value="dosen">Dosen</option>
                                    <option value="pengawas">Pengawas</option>
                                    {currentUser?.role !== 'admin_prodi' && (
                                        <>
                                            <option value="admin_prodi">Admin Prodi</option>
                                            <option value="superadmin">Super Admin</option>
                                        </>
                                    )}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select
                                    className="form-input"
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <option value="active">Aktif</option>
                                    <option value="inactive">Nonaktif</option>
                                </select>
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="form-group">
                            <label className="form-label">
                                Password
                                {!user && <span className="required-label"> *</span>}
                                {user && <span className="optional-label"> (Kosongkan jika tidak ingin mengubah)</span>}
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-input"
                                    value={formData.password || ''}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    placeholder={user ? 'Kosongkan jika tidak ingin mengubah' : 'Masukkan password'}
                                    required={!user}
                                    minLength={6}
                                    style={{ paddingRight: '42px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '10px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        color: 'var(--color-text-muted)'
                                    }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <p className="form-hint" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                                Minimal 6 karakter
                            </p>
                        </div>

                        {/* Mahasiswa specific fields */}
                        {formData.role === 'mahasiswa' && (
                            <div className="role-specific-section">
                                <h4 className="section-title">Data Akademik Mahasiswa</h4>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">
                                            Program Studi
                                            {currentUser?.role === 'admin_prodi' && (
                                                <span className="auto-assigned-badge"> (Otomatis)</span>
                                            )}
                                        </label>
                                        {currentUser?.role === 'admin_prodi' ? (
                                            <>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={prodiList.find(p => p.id === currentUser?.prodiId)?.nama || 'Prodi Anda'}
                                                    disabled
                                                />
                                                <input type="hidden" value={currentUser?.prodiId || formData.prodiId} />
                                            </>
                                        ) : (
                                            <select
                                                className="form-input"
                                                value={formData.prodiId}
                                                onChange={e => setFormData({
                                                    ...formData,
                                                    prodiId: e.target.value,
                                                    kelasId: '' // Reset kelas when prodi changes
                                                })}
                                                required
                                            >
                                                {prodiList.map(p => (
                                                    <option key={p.id} value={p.id}>{p.kode} - {p.nama}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Kelas</label>
                                        <select
                                            className="form-input"
                                            value={formData.kelasId}
                                            onChange={e => setFormData({ ...formData, kelasId: e.target.value })}
                                            required
                                        >
                                            <option value="">Pilih Kelas</option>
                                            {filteredKelas.map(k => (
                                                <option key={k.id} value={k.id}>{k.nama} ({k.angkatan})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Dosen specific fields */}
                        {formData.role === 'dosen' && (
                            <div className="role-specific-section">
                                <h4 className="section-title">Data Pengampu Dosen</h4>
                                <div className="form-group">
                                    <label className="form-label">Program Studi yang Diampu</label>
                                    <MultiSelect
                                        options={prodiList}
                                        selected={formData.prodiIds || []}
                                        onChange={(ids) => setFormData({
                                            ...formData,
                                            prodiIds: ids,
                                            kelasIds: formData.kelasIds?.filter(kid => {
                                                const kelas = kelasList.find(k => k.id === kid)
                                                return kelas && ids.includes(kelas.prodiId)
                                            }) || [],
                                            matkulIds: formData.matkulIds?.filter(mid => {
                                                const matkul = matkulList.find(m => m.id === mid)
                                                return matkul && ids.includes(matkul.prodiId)
                                            }) || []
                                        })}
                                        placeholder="Pilih Prodi..."
                                        getLabel={(p) => `${p.kode} - ${p.nama}`}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Kelas yang Diampu</label>
                                    <MultiSelect
                                        options={filteredKelasForDosen}
                                        selected={formData.kelasIds || []}
                                        onChange={(ids) => setFormData({ ...formData, kelasIds: ids })}
                                        placeholder="Pilih Kelas..."
                                        getLabel={(k) => {
                                            const prodi = prodiList.find(p => p.id === (k.prodiId || k.prodi_id))
                                            return `${prodi?.kode || ''} - ${k.nama} (${k.tahun_angkatan || k.angkatan || ''})`
                                        }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Mata Kuliah yang Diampu</label>
                                    <MultiSelect
                                        options={filteredMatkulForDosen}
                                        selected={formData.matkulIds || []}
                                        onChange={(ids) => setFormData({ ...formData, matkulIds: ids })}
                                        placeholder="Pilih Mata Kuliah..."
                                        getLabel={(m) => `[Smt ${m.semester || 1}] ${m.kode} - ${m.nama}`}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Admin Prodi specific fields */}
                        {formData.role === 'admin_prodi' && (
                            <div className="role-specific-section">
                                <h4 className="section-title">Program Studi yang Dikelola</h4>
                                <div className="form-group">
                                    <label className="form-label">Pilih Program Studi</label>
                                    <select
                                        className="form-input"
                                        value={formData.prodiId || ''}
                                        onChange={e => setFormData({ ...formData, prodiId: e.target.value })}
                                        required
                                    >
                                        <option value="">Pilih Prodi</option>
                                        {prodiList.map(p => (
                                            <option key={p.id} value={p.id}>{p.kode} - {p.nama}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
                        <button type="submit" className="btn btn-primary">
                            <Save size={16} />
                            Simpan
                        </button>
                    </div>
                </form>
            </div >
        </div >
    )
}

function UsersPage() {
    const { user: currentUser } = useAuth()
    const { showConfirm } = useConfirm()

    // State
    const [users, setUsers] = useState([])
    const [prodiList, setProdiList] = useState([])
    const [kelasList, setKelasList] = useState([])
    const [matkulList, setMatkulList] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState(null)
    const [useSupabase, setUseSupabase] = useState(false)

    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')
    const [prodiFilter, setProdiFilter] = useState('all')
    const [kelasFilter, setKelasFilter] = useState('all')
    const [currentPage, setCurrentPage] = useState(1)
    const [modalOpen, setModalOpen] = useState(false)
    const [editingUser, setEditingUser] = useState(null)
    const itemsPerPage = 10

    // Load data on mount
    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setIsLoading(true)
        setError(null)

        try {
            if (isSupabaseConfigured()) {
                const [usersData, prodiData, kelasData, matkulData] = await Promise.all([
                    userService.getAll(),
                    prodiService.getAll(),
                    kelasService.getAll(),
                    matkulService.getAll()
                ])
                // Map Supabase data to local format
                const mappedUsers = usersData.map(u => ({
                    id: u.id,
                    name: u.nama,
                    // Username is stored in 'username' field, fallback to nim_nip for legacy data
                    username: u.username || u.nim_nip || '',
                    // NIM for mahasiswa, NIP for dosen
                    nim: u.role === 'mahasiswa' ? u.nim_nip : '',
                    nip: u.role === 'dosen' ? u.nip : '',
                    email: u.email || '',
                    role: u.role,
                    status: u.status || 'active',
                    prodiId: u.prodi_id,
                    kelasId: u.kelas_id,
                    prodi: u.prodi,
                    kelas: u.kelas,
                    // Dosen fields - parse JSON arrays if stored as strings
                    prodiIds: u.prodi_ids ? (typeof u.prodi_ids === 'string' ? JSON.parse(u.prodi_ids) : u.prodi_ids) : [],
                    kelasIds: u.kelas_ids ? (typeof u.kelas_ids === 'string' ? JSON.parse(u.kelas_ids) : u.kelas_ids) : [],
                    matkulIds: u.matkul_ids ? (typeof u.matkul_ids === 'string' ? JSON.parse(u.matkul_ids) : u.matkul_ids) : [],
                    photo: u.photo
                }))
                setUsers(mappedUsers)
                setProdiList(prodiData)
                setKelasList(kelasData)
                setMatkulList(matkulData)
                setUseSupabase(true)
            } else {
                // Fallback to localStorage
                const saved = localStorage.getItem(STORAGE_KEY)
                const prodi = localStorage.getItem(PRODI_STORAGE_KEY)
                const kelas = localStorage.getItem(KELAS_STORAGE_KEY)
                const matkul = localStorage.getItem(MATKUL_STORAGE_KEY)
                setUsers(saved ? JSON.parse(saved) : [])
                setProdiList(prodi ? JSON.parse(prodi) : [])
                setKelasList(kelas ? JSON.parse(kelas) : [])
                setMatkulList(matkul ? JSON.parse(matkul) : [])
                setUseSupabase(false)
            }
        } catch (err) {
            console.error('Error loading users:', err)
            setError('Gagal memuat data dari database. Menggunakan data lokal.')
            // Fallback to localStorage
            const saved = localStorage.getItem(STORAGE_KEY)
            const prodi = localStorage.getItem(PRODI_STORAGE_KEY)
            const kelas = localStorage.getItem(KELAS_STORAGE_KEY)
            const matkul = localStorage.getItem(MATKUL_STORAGE_KEY)
            setUsers(saved ? JSON.parse(saved) : [])
            setProdiList(prodi ? JSON.parse(prodi) : [])
            setKelasList(kelas ? JSON.parse(kelas) : [])
            setMatkulList(matkul ? JSON.parse(matkul) : [])
            setUseSupabase(false)
        } finally {
            setIsLoading(false)
        }
    }

    // Backup to localStorage
    useEffect(() => {
        if (users.length > 0 && !useSupabase) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(users))
        }
    }, [users, useSupabase])

    // Filter users
    const filteredUsers = users.filter(user => {
        const matchesSearch = (user.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (user.email || '').toLowerCase().includes(search.toLowerCase()) ||
            (user.nim || '').includes(search)
        const matchesRole = roleFilter === 'all' || user.role === roleFilter

        // Prodi filter - compare as strings (UUID)
        const matchesProdi = prodiFilter === 'all' || user.prodiId === prodiFilter

        // Kelas filter (only for mahasiswa) - compare as strings (UUID)
        const matchesKelas = kelasFilter === 'all' || user.kelasId === kelasFilter

        // Admin Prodi cannot see/edit superadmin or other admin_prodi users
        if (currentUser?.role === 'admin_prodi') {
            if (user.role === 'superadmin' || user.role === 'admin_prodi') {
                return false
            }
        }

        return matchesSearch && matchesRole && matchesProdi && matchesKelas
    })

    // Pagination
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
    const paginatedUsers = filteredUsers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    const handleAddUser = () => {
        setEditingUser(null)
        setModalOpen(true)
    }

    const handleEditUser = (user) => {
        setEditingUser(user)
        setModalOpen(true)
    }

    const handleSaveUser = async (userData) => {
        setIsSaving(true)
        setError(null)

        try {
            if (useSupabase) {
                // Use username as the primary identifier (nim_nip)
                // If nim is provided, use that, otherwise fall back to username
                const nimNip = userData.nim || userData.username || ''

                if (!nimNip) {
                    throw new Error('Username harus diisi')
                }

                // Map form data to Supabase format
                const supabaseData = {
                    nim_nip: nimNip.toUpperCase(),
                    username: userData.username || nimNip,
                    nama: userData.name,
                    email: userData.email || null,
                    role: userData.role,
                    status: userData.status || 'active',
                    prodi_id: userData.prodiId || null,
                    kelas_id: userData.kelasId || null,
                    // Dosen specific fields
                    nip: userData.role === 'dosen' ? (userData.nip || null) : null,
                    prodi_ids: userData.role === 'dosen' ? JSON.stringify(userData.prodiIds || []) : null,
                    kelas_ids: userData.role === 'dosen' ? JSON.stringify(userData.kelasIds || []) : null,
                    matkul_ids: userData.role === 'dosen' ? JSON.stringify(userData.matkulIds || []) : null
                }


                if (editingUser) {
                    // Update existing user - include password only if provided
                    const updateData = { ...supabaseData }
                    if (userData.password && userData.password.trim()) {
                        updateData.password = userData.password
                    }
                    const updated = await userService.update(editingUser.id, updateData)
                    setUsers(users.map(u => u.id === editingUser.id ? {
                        ...userData,
                        id: editingUser.id,
                        nim: supabaseData.nim_nip,
                        username: supabaseData.nim_nip
                    } : u))
                } else {
                    // Create new user - include password in data object
                    const createData = {
                        ...supabaseData,
                        password: userData.password || '123456'
                    }
                    const created = await userService.create(createData)
                    const newUser = {
                        id: created.id,
                        name: created.nama,
                        username: created.nim_nip,
                        nim: created.nim_nip,
                        email: created.email,
                        role: created.role,
                        status: created.status,
                        prodiId: created.prodi_id,
                        kelasId: created.kelas_id
                    }
                    setUsers([...users, newUser])
                }
            } else {
                // Fallback to localStorage
                if (editingUser) {
                    setUsers(users.map(u => u.id === editingUser.id ? { ...userData, id: editingUser.id } : u))
                } else {
                    setUsers([...users, { ...userData, id: Date.now() }])
                }
            }
            setModalOpen(false)
        } catch (err) {
            console.error('Error saving user:', err)
            // Show user-friendly error messages
            let errorMessage = err.message
            if (err.message?.includes('duplicate') || err.message?.includes('unique') || err.code === '23505') {
                errorMessage = 'Username atau NIM/NIP sudah digunakan. Gunakan username yang berbeda.'
            } else if (err.message?.includes('violates')) {
                errorMessage = 'Data tidak valid. Pastikan semua field terisi dengan benar.'
            }
            setError(`Gagal menyimpan user: ${errorMessage}`)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteUser = async (id) => {
        showConfirm({
            title: 'Konfirmasi Hapus',
            message: 'Apakah Anda yakin ingin menghapus user ini?',
            onConfirm: async () => {
                try {
                    if (useSupabase) {
                        await userService.delete(id)
                    }
                    setUsers(users.filter(u => u.id !== id))
                } catch (err) {
                    console.error('Error deleting user:', err)
                    setError(`Gagal menghapus user: ${err.message}`)
                }
            }
        })
    }

    const handleToggleStatus = async (id) => {
        const user = users.find(u => u.id === id)
        if (!user) return

        const newStatus = user.status === 'active' ? 'inactive' : 'active'

        try {
            if (useSupabase) {
                await userService.update(id, { status: newStatus })
            }
            setUsers(users.map(u =>
                u.id === id ? { ...u, status: newStatus } : u
            ))
        } catch (err) {
            console.error('Error updating status:', err)
            setError(`Gagal mengubah status: ${err.message}`)
        }
    }

    const getProdiKelasInfo = (user) => {
        if (user.role === 'mahasiswa') {
            const prodi = prodiList.find(p => p.id === user.prodiId)
            const kelas = kelasList.find(k => k.id === user.kelasId)
            if (prodi && kelas) {
                return `${prodi.kode} - ${kelas.nama}`
            }
        } else if (user.role === 'dosen' && user.prodiIds?.length > 0) {
            return user.prodiIds.map(pid => prodiList.find(p => p.id === pid)?.kode).filter(Boolean).join(', ')
        }
        return '-'
    }

    const stats = {
        total: users.length,
        mahasiswa: users.filter(u => u.role === 'mahasiswa').length,
        dosen: users.filter(u => u.role === 'dosen').length,
        active: users.filter(u => u.status === 'active').length
    }

    // Template dropdown state
    const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false)
    const fileInputRef = useRef(null)

    // Template: Mahasiswa (XLSX format)
    const downloadMahasiswaTemplate = () => {
        const headers = ['nama', 'username', 'password', 'nim', 'email', 'prodi_id', 'kelas_id']
        const sampleRows = [
            ['Budi Santoso', 'budi123', '123456', '2024010001', 'budi@email.com', 1, 1],
            ['Siti Aminah', 'siti456', '123456', '2024010002', 'siti@email.com', 1, 1],
        ]
        const infoRows = [
            [`# Prodi: ${prodiList.map(p => `${p.id}=${p.kode}`).join(' | ')}`, '', '', '', '', '', ''],
            [`# Kelas: ${kelasList.map(k => `${k.id}=${k.nama}`).join(' | ')}`, '', '', '', '', '', '']
        ]
        downloadTemplate(headers, sampleRows, 'template_mahasiswa', infoRows)
        setTemplateDropdownOpen(false)
    }

    // Template: Dosen (XLSX format)
    const downloadDosenTemplate = () => {
        const headers = ['nama', 'username', 'password', 'nip', 'email', 'prodi_ids', 'kelas_ids', 'matkul_ids']
        const sampleRows = [
            ['Dr. Ahmad Fauzi', 'ahmad123', '123456', '197501012000011001', 'ahmad@email.com', '1|2', '1|2|3', '1|2'],
            ['Ir. Siti Rahayu', 'siti_dosen', '123456', '198001012010011001', 'siti.dosen@email.com', '1', '1', '1'],
        ]
        const infoRows = [
            [`# Multi nilai gunakan | (contoh: 1|2|3)`, '', '', '', '', '', '', ''],
            [`# Prodi: ${prodiList.map(p => `${p.id}=${p.kode}`).join(' | ')}`, '', '', '', '', '', '', '']
        ]
        downloadTemplate(headers, sampleRows, 'template_dosen', infoRows)
        setTemplateDropdownOpen(false)
    }

    // Template: Pengawas (XLSX format)
    const downloadPengawasTemplate = () => {
        const headers = ['nama', 'username', 'password', 'nip', 'email']
        const sampleRows = [
            ['Pengawas Satu', 'pengawas1', '123456', '198501012015011001', 'pengawas1@email.com'],
            ['Pengawas Dua', 'pengawas2', '123456', '198601012016011001', 'pengawas2@email.com'],
        ]
        downloadTemplate(headers, sampleRows, 'template_pengawas')
        setTemplateDropdownOpen(false)
    }

    // Import Excel/CSV handler (supports both XLSX and CSV)
    const handleImportFile = (e) => {
        const file = e.target.files[0]
        if (!file) return

        if (!isValidSpreadsheetFile(file.name)) {
            alert('Format file tidak didukung. Gunakan file .xlsx, .xls, atau .csv')
            e.target.value = ''
            return
        }

        importFromFile(file, async ({ headers, rows, error }) => {
            if (error) {
                alert(error)
                e.target.value = ''
                return
            }

            if (rows.length === 0) {
                alert('File kosong atau format salah')
                e.target.value = ''
                return
            }

            const newUsers = []

            rows.forEach(userData => {
                // Determine role based on headers
                let role = 'mahasiswa'
                if (headers.includes('prodi_ids') || headers.includes('matkul_ids')) {
                    role = 'dosen'
                } else if (!headers.includes('prodi_id') && !headers.includes('kelas_id')) {
                    role = 'pengawas'
                }

                // Build user object
                const user = {
                    id: Date.now() + Math.random(),
                    name: String(userData.nama || ''),
                    username: String(userData.username || ''),
                    password: String(userData.password || '123456'),
                    email: String(userData.email || ''),
                    nim: String(userData.nim || userData.nip || ''),
                    role: role,
                    status: 'active'
                }

                if (role === 'mahasiswa') {
                    // Lookup prodi by kode or nama (case-insensitive)
                    const prodiInput = String(userData.prodi_id || userData.prodi || '').trim().toUpperCase()
                    const foundProdi = prodiList.find(p =>
                        p.kode?.toUpperCase() === prodiInput ||
                        p.nama?.toUpperCase().includes(prodiInput) ||
                        p.id === prodiInput
                    )
                    user.prodiId = foundProdi?.id || prodiList[0]?.id

                    // Lookup kelas by nama (case-insensitive)
                    const kelasInput = String(userData.kelas_id || userData.kelas || '').trim().toUpperCase()
                    const foundKelas = kelasList.find(k =>
                        k.nama?.toUpperCase() === kelasInput ||
                        k.id === kelasInput
                    )
                    user.kelasId = foundKelas?.id || kelasList.find(k => k.prodi_id === user.prodiId)?.id || kelasList[0]?.id
                } else if (role === 'dosen') {
                    const prodiIdsStr = String(userData.prodi_ids || '')
                    const kelasIdsStr = String(userData.kelas_ids || '')
                    const matkulIdsStr = String(userData.matkul_ids || '')
                    // Lookup prodi IDs by kode
                    user.prodiIds = prodiIdsStr.split('|').map(code => {
                        const prodi = prodiList.find(p => p.kode?.toUpperCase() === code.trim().toUpperCase())
                        return prodi?.id
                    }).filter(Boolean)
                    user.kelasIds = kelasIdsStr.split('|').map(id => id.trim()).filter(Boolean)
                    user.matkulIds = matkulIdsStr.split('|').map(id => id.trim()).filter(Boolean)
                }

                // Validate required fields
                if (user.name && user.username) {
                    newUsers.push(user)
                }
            })

            if (newUsers.length > 0) {
                // Save to Supabase if configured
                if (useSupabase) {
                    let savedCount = 0
                    let errors = []

                    for (const user of newUsers) {
                        try {
                            // Convert to Supabase format
                            const supabaseUser = {
                                nama: user.name,
                                nim_nip: user.nim || user.username,
                                email: user.email || null,
                                password: user.password || '123456',
                                role: user.role,
                                status: user.status,
                                prodi_id: user.prodiId || null,
                                kelas_id: user.kelasId || null
                            }

                            await userService.create(supabaseUser)
                            savedCount++
                        } catch (err) {
                            console.error('Error saving user:', user.name, err)
                            errors.push(`${user.name}: ${err.message}`)
                        }
                    }

                    // Reload data from database
                    await loadData()

                    if (errors.length > 0) {
                        alert(`Berhasil import ${savedCount} dari ${newUsers.length} user.\n\nGagal:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...dan ${errors.length - 5} lainnya` : ''}`)
                    } else {
                        alert(`Berhasil import ${savedCount} user ke database!`)
                    }
                } else {
                    // Local storage fallback
                    setUsers([...users, ...newUsers])
                    alert(`Berhasil import ${newUsers.length} user! (Local storage)`)
                }
            } else {
                alert('Tidak ada data valid ditemukan')
            }

            e.target.value = '' // Reset file input
        })
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Manajemen User</h1>
                        <p className="page-subtitle">Kelola data pengguna sistem CAT</p>
                    </div>
                    <div className="flex gap-3">
                        {/* Template Dropdown */}
                        <div style={{ position: 'relative' }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setTemplateDropdownOpen(!templateDropdownOpen)}
                            >
                                <FileSpreadsheet size={18} />
                                Template Import
                                <ChevronDown size={16} />
                            </button>
                            {templateDropdownOpen && (
                                <div className="dropdown-menu" style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '4px',
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-lg)',
                                    boxShadow: 'var(--shadow-lg)',
                                    minWidth: '200px',
                                    zIndex: 100,
                                    overflow: 'hidden'
                                }}>
                                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        Download Template
                                    </div>
                                    <button className="dropdown-item" onClick={downloadMahasiswaTemplate} style={{
                                        display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', textAlign: 'left'
                                    }}>
                                        <Download size={16} />
                                        Template Mahasiswa
                                    </button>
                                    <button className="dropdown-item" onClick={downloadDosenTemplate} style={{
                                        display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', textAlign: 'left'
                                    }}>
                                        <Download size={16} />
                                        Template Dosen
                                    </button>
                                    <button className="dropdown-item" onClick={downloadPengawasTemplate} style={{
                                        display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', textAlign: 'left'
                                    }}>
                                        <Download size={16} />
                                        Template Pengawas
                                    </button>
                                    <div style={{ borderTop: '1px solid var(--border-color)' }}>
                                        <button className="dropdown-item" onClick={() => { fileInputRef.current?.click(); setTemplateDropdownOpen(false); }} style={{
                                            display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', textAlign: 'left', color: 'var(--primary-600)'
                                        }}>
                                            <Upload size={16} />
                                            Import dari Excel/CSV
                                        </button>
                                    </div>
                                </div>
                            )}
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept=".xlsx,.xls,.csv"
                                onChange={handleImportFile}
                                style={{ display: 'none' }}
                            />
                        </div>

                        <button className="btn btn-primary" onClick={handleAddUser}>
                            <Plus size={18} />
                            Tambah User
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="mini-stats">
                    <div className="mini-stat">
                        <span className="mini-stat-value">{stats.total}</span>
                        <span className="mini-stat-label">Total User</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">{stats.mahasiswa}</span>
                        <span className="mini-stat-label">Mahasiswa</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">{stats.dosen}</span>
                        <span className="mini-stat-label">Dosen</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">{stats.active}</span>
                        <span className="mini-stat-label">Aktif</span>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="error-banner" style={{
                        padding: '12px 16px',
                        marginBottom: '16px',
                        background: 'var(--error-50)',
                        border: '1px solid var(--error-200)',
                        borderRadius: '8px',
                        color: 'var(--error-700)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <AlertCircle size={20} />
                        <span style={{ flex: 1 }}>{error}</span>
                        <button
                            onClick={() => setError(null)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-500)' }}
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}

                {/* Filters */}
                <div className="card">
                    <div className="card-body">
                        <div className="filters-row">
                            <div className="search-box">
                                <Search size={18} className="search-icon" />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Cari nama, email, atau NIM..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            <div className="filter-group">
                                <Filter size={16} />
                                <select
                                    className="form-input"
                                    value={roleFilter}
                                    onChange={e => setRoleFilter(e.target.value)}
                                >
                                    <option value="all">Semua Role</option>
                                    <option value="mahasiswa">Mahasiswa</option>
                                    <option value="dosen">Dosen</option>
                                    <option value="pengawas">Pengawas</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div className="filter-group">
                                <select
                                    className="form-input"
                                    value={prodiFilter}
                                    onChange={e => setProdiFilter(e.target.value)}
                                >
                                    <option value="all">Semua Prodi</option>
                                    {prodiList.map(p => (
                                        <option key={p.id} value={p.id}>{p.kode || p.nama}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="filter-group">
                                <select
                                    className="form-input"
                                    value={kelasFilter}
                                    onChange={e => setKelasFilter(e.target.value)}
                                >
                                    <option value="all">Semua Kelas</option>
                                    {kelasList
                                        .filter(k => prodiFilter === 'all' || k.prodiId === prodiFilter)
                                        .map(k => (
                                            <option key={k.id} value={k.id}>{k.nama}</option>
                                        ))}
                                </select>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Nama</th>
                                        <th>Username</th>
                                        <th>NIM/NIP</th>
                                        <th>Prodi/Kelas</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedUsers.map(user => (
                                        <tr key={user.id}>
                                            <td>
                                                <div className="user-cell">
                                                    {user.photo ? (
                                                        <img src={user.photo} alt="" className="avatar avatar-sm avatar-img" />
                                                    ) : (
                                                        <div className="avatar avatar-sm">{user.name.charAt(0)}</div>
                                                    )}
                                                    <span className="font-medium">{user.name}</span>
                                                </div>
                                            </td>
                                            <td className="text-muted">{user.username || '-'}</td>
                                            <td>{user.role === 'mahasiswa' ? user.nim : (user.role === 'dosen' ? user.nip : '-')}</td>
                                            <td>
                                                <span className="prodi-kelas-info">{getProdiKelasInfo(user)}</span>
                                            </td>
                                            <td>
                                                <span className={`badge badge-${user.role === 'admin' ? 'error' :
                                                    user.role === 'dosen' ? 'primary' :
                                                        user.role === 'pengawas' ? 'warning' : 'info'
                                                    }`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    className={`status-toggle ${user.status}`}
                                                    onClick={() => handleToggleStatus(user.id)}
                                                >
                                                    {user.status === 'active' ? <UserCheck size={14} /> : <UserX size={14} />}
                                                    {user.status === 'active' ? 'Aktif' : 'Nonaktif'}
                                                </button>
                                            </td>
                                            <td>
                                                <div className="flex gap-2">
                                                    <button
                                                        className="btn btn-icon btn-ghost btn-sm"
                                                        onClick={() => handleEditUser(user)}
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        className="btn btn-icon btn-ghost btn-sm text-error"
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteUser(user.id); }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="pagination">
                            <span className="pagination-info">
                                Menampilkan {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredUsers.length)} dari {filteredUsers.length}
                            </span>
                            <div className="pagination-buttons">
                                <button
                                    className="btn btn-icon btn-ghost btn-sm"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => p - 1)}
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        className={`btn btn-sm ${currentPage === page ? 'btn-primary' : 'btn-ghost'}`}
                                        onClick={() => setCurrentPage(page)}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button
                                    className="btn btn-icon btn-ghost btn-sm"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => p + 1)}
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <UserModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    user={editingUser}
                    onSave={handleSaveUser}
                    currentUser={currentUser}
                    prodiList={prodiList}
                    kelasList={kelasList}
                    matkulList={matkulList}
                />
            </div>

            <style>{`
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: var(--space-4);
        }
        
        .mini-stats {
          display: flex;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
          flex-wrap: wrap;
        }
        
        .mini-stat {
          background: var(--bg-secondary);
          padding: var(--space-4) var(--space-6);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
          text-align: center;
          min-width: 120px;
        }
        
        .mini-stat-value {
          display: block;
          font-size: var(--font-size-2xl);
          font-weight: var(--font-bold);
          color: var(--primary-600);
        }
        
        .mini-stat-label {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
        }
        
        .filters-row {
          display: flex;
          gap: var(--space-4);
          margin-bottom: var(--space-5);
          flex-wrap: wrap;
        }
        
        .search-box {
          position: relative;
          flex: 1;
          min-width: 250px;
        }
        
        .search-icon {
          position: absolute;
          left: var(--space-4);
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }
        
        .search-box .form-input {
          padding-left: calc(var(--space-4) + 24px);
        }
        
        .filter-group {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--text-muted);
        }
        
        .filter-group .form-input {
          width: auto;
          min-width: 150px;
        }
        
        .user-cell {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        
        .avatar-img {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
        }
        
        .prodi-kelas-info {
          font-size: var(--font-size-xs);
          color: var(--text-secondary);
          background: var(--bg-tertiary);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-md);
        }
        
        .status-toggle {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-1) var(--space-3);
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-medium);
          border: none;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        
        .status-toggle.active {
          background: var(--success-50);
          color: var(--success-600);
        }
        
        .status-toggle.inactive {
          background: var(--gray-100);
          color: var(--gray-500);
        }
        
        .status-toggle:hover {
          transform: scale(1.05);
        }
        
        .text-error {
          color: var(--error-500);
        }
        
        .pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: var(--space-4);
          padding-top: var(--space-4);
          border-top: 1px solid var(--border-color);
          flex-wrap: wrap;
          gap: var(--space-3);
        }
        
        .pagination-info {
          font-size: var(--font-size-sm);
          color: var(--text-muted);
        }
        
        .pagination-buttons {
          display: flex;
          gap: var(--space-1);
        }
        
        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: var(--z-modal);
          padding: var(--space-4);
        }
        
        .modal {
          background: var(--bg-secondary);
          border-radius: var(--radius-xl);
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          animation: scaleIn var(--transition-normal) ease-out;
        }
        
        .modal-lg {
          max-width: 600px;
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-5);
          border-bottom: 1px solid var(--border-color);
        }
        
        .modal-header h3 {
          font-size: var(--font-size-lg);
          font-weight: var(--font-semibold);
        }
        
        .modal-body {
          padding: var(--space-5);
        }
        
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-3);
          padding: var(--space-4) var(--space-5);
          border-top: 1px solid var(--border-color);
          background: var(--bg-tertiary);
        }
        
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
        }
        
        /* Photo Upload */
        .photo-upload-section {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          margin-bottom: var(--space-5);
          padding-bottom: var(--space-5);
          border-bottom: 1px solid var(--border-color);
        }
        
        .photo-preview {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          overflow: hidden;
          background: var(--bg-tertiary);
          border: 3px solid var(--border-color);
        }
        
        .photo-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .photo-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
        }
        
        .photo-upload-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          background: var(--primary-50);
          color: var(--primary-600);
          border-radius: var(--radius-lg);
          font-size: var(--font-size-sm);
          font-weight: var(--font-medium);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        
        .photo-upload-btn:hover {
          background: var(--primary-100);
        }
        
        /* Role Specific Section */
        .role-specific-section {
          margin-top: var(--space-5);
          padding-top: var(--space-5);
          border-top: 1px solid var(--border-color);
        }
        
        .section-title {
          font-size: var(--font-size-sm);
          font-weight: var(--font-semibold);
          color: var(--primary-600);
          margin-bottom: var(--space-4);
        }
        
        /* Multi-Select */
        .multi-select {
          position: relative;
        }
        
        .multi-select-trigger {
          padding: var(--space-3);
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          cursor: pointer;
          min-height: 44px;
          display: flex;
          align-items: center;
        }
        
        .multi-select-trigger .placeholder {
          color: var(--text-muted);
        }
        
        .selected-tags {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-1);
        }
        
        .selected-tag {
          display: inline-block;
          padding: var(--space-1) var(--space-2);
          background: var(--primary-50);
          color: var(--primary-700);
          border-radius: var(--radius-md);
          font-size: var(--font-size-xs);
        }
        
        .selected-tag.more {
          background: var(--gray-100);
          color: var(--gray-600);
        }
        
        .multi-select-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          z-index: 100;
          margin-top: var(--space-1);
        }
        
        .multi-select-dropdown-up {
          top: auto;
          bottom: 100%;
          margin-top: 0;
          margin-bottom: var(--space-1);
        }
        
        .multi-select-search {
          padding: var(--space-2);
          border-bottom: 1px solid var(--border-color);
          position: sticky;
          top: 0;
          background: var(--bg-secondary);
        }
        
        .multi-select-search input {
          width: 100%;
          padding: var(--space-2) var(--space-3);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          background: var(--bg-primary);
        }
        
        .multi-select-search input:focus {
          outline: none;
          border-color: var(--primary-500);
        }
        
        .multi-select-options {
          max-height: 200px;
          overflow-y: auto;
        }
        
        .multi-select-empty {
          padding: var(--space-4);
          text-align: center;
          color: var(--text-tertiary);
          font-size: var(--font-size-sm);
        }
        
        .multi-select-option {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3);
          cursor: pointer;
          font-size: var(--font-size-sm);
          transition: background var(--transition-fast);
        }
        
        .multi-select-option:hover {
          background: var(--bg-tertiary);
        }
        
        .multi-select-option input {
          display: none;
        }
        
        .multi-select-option .checkmark {
          width: 18px;
          height: 18px;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }
        
        .multi-select-option input:checked + .checkmark {
          background: var(--primary-500);
          border-color: var(--primary-500);
        }
        
        .multi-select-backdrop {
          position: fixed;
          inset: 0;
          z-index: 99;
        }
        
        @media (max-width: 640px) {
          .form-row {
            grid-template-columns: 1fr;
          }
        }
        
        [data-theme="dark"] .status-toggle.active {
          background: rgba(16, 185, 129, 0.15);
        }
        
        [data-theme="dark"] .status-toggle.inactive {
          background: rgba(148, 163, 184, 0.15);
        }
        
        [data-theme="dark"] .photo-upload-btn {
          background: rgba(59, 103, 159, 0.15);
        }
        
        [data-theme="dark"] .selected-tag {
          background: rgba(59, 103, 159, 0.2);
        }
        
        [data-theme="dark"] .selected-tag.more {
          background: rgba(148, 163, 184, 0.15);
        }
        
        .auto-assigned-badge {
          font-size: var(--font-size-xs);
          color: var(--success-600);
          font-weight: var(--font-normal);
        }
        
        .optional-label {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
          font-weight: var(--font-normal);
        }
        
        .required-label {
          color: var(--error-500);
        }
      `}</style>
        </DashboardLayout>
    )
}

export default UsersPage
