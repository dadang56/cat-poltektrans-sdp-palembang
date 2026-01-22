import { useState, useRef, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { useConfirm } from '../../components/ConfirmDialog'
import {
    BookOpen,
    Plus,
    Search,
    Edit2,
    Trash2,
    Eye,
    X,
    Save,
    Image,
    CheckCircle,
    Circle,
    ArrowRight,
    AlertCircle,
    Download,
    Database
} from 'lucide-react'
import '../admin/Dashboard.css'

// Supabase services
import { soalService, matkulService, kelasService } from '../../services/supabaseService'
import { isSupabaseConfigured } from '../../lib/supabase'


// Bank Soal Modal for selecting existing questions
function BankSoalModal({ isOpen, onClose, onSelectQuestions }) {
    const [selectedQuestions, setSelectedQuestions] = useState([])
    const [examTypeFilter, setExamTypeFilter] = useState('all')

    // Bank soal kosong - akan diisi dari data nyata
    const bankSoalData = []

    const filteredQuestions = bankSoalData.filter(q =>
        examTypeFilter === 'all' || q.examType === examTypeFilter
    )

    const toggleQuestion = (id) => {
        setSelectedQuestions(prev =>
            prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
        )
    }

    const handleImport = () => {
        const questions = bankSoalData.filter(q => selectedQuestions.includes(q.id))
        onSelectQuestions(questions)
        setSelectedQuestions([])
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Ambil dari Bank Soal</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body">
                    <div className="bank-soal-filters">
                        <select
                            className="form-input"
                            value={examTypeFilter}
                            onChange={e => setExamTypeFilter(e.target.value)}
                        >
                            <option value="all">Semua Tipe</option>
                            <option value="uts">UTS</option>
                            <option value="uas">UAS</option>
                        </select>
                    </div>
                    <div className="bank-soal-list">
                        {filteredQuestions.length === 0 ? (
                            <div className="text-center" style={{ padding: '48px', opacity: 0.6 }}>
                                <Database size={48} style={{ marginBottom: '16px' }} />
                                <p>Bank soal kosong. Buat soal terlebih dahulu untuk mengisi bank soal.</p>
                            </div>
                        ) : filteredQuestions.map(q => (
                            <div
                                key={q.id}
                                className={`bank-soal-item ${selectedQuestions.includes(q.id) ? 'selected' : ''}`}
                                onClick={() => toggleQuestion(q.id)}
                            >
                                <div className="bank-soal-check">
                                    {selectedQuestions.includes(q.id) ? <CheckCircle size={18} /> : <Circle size={18} />}
                                </div>
                                <div className="bank-soal-content">
                                    <p>{q.text}</p>
                                    <div className="bank-soal-meta">
                                        <span className="badge badge-primary">{q.examType.toUpperCase()}</span>
                                        <span className="badge badge-outline">{q.type}</span>
                                        <span>{q.points} poin</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="modal-footer">
                    <span>{selectedQuestions.length} soal dipilih</span>
                    <div>
                        <button className="btn btn-ghost" onClick={onClose}>Batal</button>
                        <button
                            className="btn btn-primary"
                            onClick={handleImport}
                            disabled={selectedQuestions.length === 0}
                        >
                            <Download size={16} />
                            Import Soal
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function QuestionModal({ isOpen, onClose, question, onSave, matkul, kelasList, currentExamType, selectedPackage }) {
    const getDefaultFormData = () => ({
        text: '',
        type: 'pilihan_ganda',
        matkulId: matkul[0]?.id || 1,
        kelasIds: [], // Changed to array for multi-select
        points: 10,
        image: null,
        options: [
            { text: '', image: null },
            { text: '', image: null },
            { text: '', image: null },
            { text: '', image: null }
        ],
        correctAnswer: 0,
        pairs: [
            { left: '', right: '' },
            { left: '', right: '' }
        ],
        examType: currentExamType || 'uts'
    })

    const [formData, setFormData] = useState(question || getDefaultFormData())
    const questionImageRef = useRef(null)

    // Reset form when question changes or modal opens
    useEffect(() => {
        if (isOpen) {
            if (question) {
                // Ensure kelasIds is always an array (migrate from old kelasId format)
                const kelasIds = question.kelasIds || (question.kelasId ? [question.kelasId] : [])
                setFormData({ ...question, kelasIds })
            } else {
                setFormData(getDefaultFormData())
            }
        }
    }, [isOpen, question, matkul])

    // Handle kelas checkbox toggle
    const handleKelasToggle = (kelasId) => {
        const currentIds = formData.kelasIds || []
        if (currentIds.includes(kelasId)) {
            setFormData({ ...formData, kelasIds: currentIds.filter(id => id !== kelasId) })
        } else {
            setFormData({ ...formData, kelasIds: [...currentIds, kelasId] })
        }
    }

    // Select/Deselect all kelas
    const handleSelectAllKelas = () => {
        if ((formData.kelasIds || []).length === kelasList.length) {
            setFormData({ ...formData, kelasIds: [] })
        } else {
            setFormData({ ...formData, kelasIds: kelasList.map(k => k.id) })
        }
    }

    const handleImageUpload = (e, target, index = null) => {
        const file = e.target.files[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (event) => {
                if (target === 'question') {
                    setFormData({ ...formData, image: event.target.result })
                } else if (target === 'option' && index !== null) {
                    const newOptions = [...formData.options]
                    newOptions[index] = { ...newOptions[index], image: event.target.result }
                    setFormData({ ...formData, options: newOptions })
                }
            }
            reader.readAsDataURL(file)
        }
    }

    const handleOptionChange = (index, field, value) => {
        const newOptions = [...formData.options]
        newOptions[index] = { ...newOptions[index], [field]: value }
        setFormData({ ...formData, options: newOptions })
    }

    const handlePairChange = (index, field, value) => {
        const newPairs = [...formData.pairs]
        newPairs[index] = { ...newPairs[index], [field]: value }
        setFormData({ ...formData, pairs: newPairs })
    }

    const addPair = () => {
        setFormData({
            ...formData,
            pairs: [...formData.pairs, { left: '', right: '' }]
        })
    }

    const removePair = (index) => {
        const newPairs = formData.pairs.filter((_, i) => i !== index)
        setFormData({ ...formData, pairs: newPairs })
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        onSave(formData)
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{question ? 'Edit Soal' : 'Tambah Soal Baru'}</h3>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        {/* Mata Kuliah dan Bobot - Hide matkul when inside package */}
                        <div className="form-row form-row-2">
                            {!selectedPackage && (
                                <div className="form-group">
                                    <label className="form-label">Mata Kuliah</label>
                                    <select
                                        className="form-input"
                                        value={formData.matkulId}
                                        onChange={e => setFormData({ ...formData, matkulId: parseInt(e.target.value), kelasIds: [] })}
                                    >
                                        {matkul.map(mk => (
                                            <option key={mk.id} value={mk.id}>{mk.nama}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="form-group" style={selectedPackage ? { width: '100%' } : {}}>
                                <label className="form-label">Bobot Nilai</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={formData.points}
                                    onChange={e => setFormData({ ...formData, points: parseInt(e.target.value) })}
                                    min={1}
                                    max={100}
                                />
                            </div>
                        </div>


                        {/* Kelas Multi-Select Checkbox - Filtered by selected matkul's prodi */}
                        {(() => {
                            const selectedMatkul = matkul.find(m => String(m.id) === String(formData.matkulId))
                            const filteredKelas = selectedMatkul
                                ? kelasList.filter(k => String(k.prodiId) === String(selectedMatkul.prodiId))
                                : kelasList

                            return (
                                <div className="form-group">
                                    <div className="kelas-header">
                                        <label className="form-label">Distribusi ke Kelas</label>
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => {
                                                if ((formData.kelasIds || []).length === filteredKelas.length) {
                                                    setFormData({ ...formData, kelasIds: [] })
                                                } else {
                                                    setFormData({ ...formData, kelasIds: filteredKelas.map(k => k.id) })
                                                }
                                            }}
                                        >
                                            {(formData.kelasIds || []).length === filteredKelas.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
                                        </button>
                                    </div>
                                    {filteredKelas.length === 0 ? (
                                        <p className="form-hint" style={{ color: 'var(--text-muted)' }}>
                                            Tidak ada kelas untuk prodi mata kuliah ini
                                        </p>
                                    ) : (
                                        <div className="kelas-checkbox-grid">
                                            {filteredKelas.map(kelas => (
                                                <label
                                                    key={kelas.id}
                                                    className={`kelas-checkbox-item ${(formData.kelasIds || []).includes(kelas.id) ? 'selected' : ''}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={(formData.kelasIds || []).includes(kelas.id)}
                                                        onChange={() => handleKelasToggle(kelas.id)}
                                                    />
                                                    <span className="kelas-checkbox-label">
                                                        <strong>{kelas.nama}</strong>
                                                        <small>Angkatan {kelas.angkatan}</small>
                                                    </span>
                                                    {(formData.kelasIds || []).includes(kelas.id) && (
                                                        <CheckCircle size={16} className="kelas-check-icon" />
                                                    )}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                    {(formData.kelasIds || []).length > 0 && (
                                        <p className="form-hint kelas-selected-hint">
                                            ✓ Soal akan didistribusikan ke {(formData.kelasIds || []).length} kelas
                                        </p>
                                    )}
                                </div>
                            )
                        })()}

                        {/* Jenis Ujian - Hide when inside package */}
                        {!selectedPackage && (
                            <div className="form-group">
                                <label className="form-label">Jenis Ujian</label>
                                <div className="type-selector">
                                    {[
                                        { value: 'UTS', label: 'UTS' },
                                        { value: 'UAS', label: 'UAS' }
                                    ].map(type => (
                                        <button
                                            key={type.value}
                                            type="button"
                                            className={`type-btn ${formData.examType?.toUpperCase() === type.value ? 'active' : ''}`}
                                            onClick={() => setFormData({ ...formData, examType: type.value })}
                                        >
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tipe Soal */}
                        <div className="form-group">
                            <label className="form-label">Tipe Soal</label>
                            <div className="type-selector">
                                {[
                                    { value: 'pilihan_ganda', label: 'Pilihan Ganda' },
                                    { value: 'essay', label: 'Essay' },
                                    { value: 'benar_salah', label: 'Benar/Salah' },
                                    { value: 'mencocokan', label: 'Mencocokan' }
                                ].map(type => (
                                    <button
                                        key={type.value}
                                        type="button"
                                        className={`type-btn ${formData.type === type.value ? 'active' : ''}`}
                                        onClick={() => setFormData({ ...formData, type: type.value })}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Pertanyaan */}
                        <div className="form-group">
                            <label className="form-label">Pertanyaan</label>
                            <textarea
                                className="form-input form-textarea"
                                rows={3}
                                value={formData.text}
                                onChange={e => setFormData({ ...formData, text: e.target.value })}
                                placeholder="Tuliskan pertanyaan..."
                                required
                            />
                        </div>

                        {/* Upload Gambar Soal */}
                        <div className="form-group">
                            <label className="form-label">Gambar Soal (Opsional)</label>
                            <div className="image-upload-area">
                                {formData.image ? (
                                    <div className="image-preview">
                                        <img src={formData.image} alt="Preview" />
                                        <button
                                            type="button"
                                            className="remove-image"
                                            onClick={() => setFormData({ ...formData, image: null })}
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        onClick={() => questionImageRef.current?.click()}
                                    >
                                        <Image size={18} />
                                        Upload Gambar
                                    </button>
                                )}
                                <input
                                    type="file"
                                    ref={questionImageRef}
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={(e) => handleImageUpload(e, 'question')}
                                />
                            </div>
                        </div>

                        {/* Pilihan Ganda Options */}
                        {formData.type === 'pilihan_ganda' && (
                            <div className="form-group">
                                <label className="form-label">Pilihan Jawaban</label>
                                <div className="options-list">
                                    {formData.options.map((opt, index) => (
                                        <div key={index} className="option-row-extended">
                                            <button
                                                type="button"
                                                className={`option-radio ${formData.correctAnswer === index ? 'selected' : ''}`}
                                                onClick={() => setFormData({ ...formData, correctAnswer: index })}
                                            >
                                                {formData.correctAnswer === index ? <CheckCircle size={18} /> : <Circle size={18} />}
                                            </button>
                                            <div className="option-content">
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={opt.text}
                                                    onChange={e => handleOptionChange(index, 'text', e.target.value)}
                                                    placeholder={`Pilihan ${String.fromCharCode(65 + index)}`}
                                                />
                                                {opt.image ? (
                                                    <div className="option-image-preview">
                                                        <img src={opt.image} alt={`Option ${index}`} />
                                                        <button
                                                            type="button"
                                                            className="remove-image-sm"
                                                            onClick={() => handleOptionChange(index, 'image', null)}
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => {
                                                            const input = document.createElement('input')
                                                            input.type = 'file'
                                                            input.accept = 'image/*'
                                                            input.onchange = (e) => handleImageUpload(e, 'option', index)
                                                            input.click()
                                                        }}
                                                    >
                                                        <Image size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="form-hint">Klik lingkaran untuk menandai jawaban benar</p>
                            </div>
                        )}

                        {/* Benar Salah */}
                        {formData.type === 'benar_salah' && (
                            <div className="form-group">
                                <label className="form-label">Jawaban Benar</label>
                                <div className="radio-group">
                                    <label className="radio-label">
                                        <input
                                            type="radio"
                                            name="correctAnswer"
                                            checked={formData.correctAnswer === true}
                                            onChange={() => setFormData({ ...formData, correctAnswer: true })}
                                        />
                                        <span>Benar</span>
                                    </label>
                                    <label className="radio-label">
                                        <input
                                            type="radio"
                                            name="correctAnswer"
                                            checked={formData.correctAnswer === false}
                                            onChange={() => setFormData({ ...formData, correctAnswer: false })}
                                        />
                                        <span>Salah</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Mencocokan */}
                        {formData.type === 'mencocokan' && (
                            <div className="form-group">
                                <label className="form-label">Pasangan (Kiri - Kanan)</label>
                                <div className="matching-list">
                                    {formData.pairs.map((pair, index) => (
                                        <div key={index} className="matching-row">
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={pair.left}
                                                onChange={e => handlePairChange(index, 'left', e.target.value)}
                                                placeholder="Item kiri"
                                            />
                                            <ArrowRight size={18} className="matching-arrow" />
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={pair.right}
                                                onChange={e => handlePairChange(index, 'right', e.target.value)}
                                                placeholder="Item kanan"
                                            />
                                            {formData.pairs.length > 2 && (
                                                <button
                                                    type="button"
                                                    className="btn btn-icon btn-ghost btn-sm"
                                                    onClick={() => removePair(index)}
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    onClick={addPair}
                                    style={{ marginTop: '0.5rem' }}
                                >
                                    <Plus size={16} />
                                    Tambah Pasangan
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
                        <button type="submit" className="btn btn-primary">
                            <Save size={16} />
                            Simpan Soal
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function BuatSoalPage() {
    const { user } = useAuth()
    const { showConfirm } = useConfirm()
    const [questions, setQuestions] = useState([])
    const [matkulList, setMatkulList] = useState([])
    const [kelasList, setKelasList] = useState([])
    const [isInitialized, setIsInitialized] = useState(false)
    const [search, setSearch] = useState('')
    const [matkulFilter, setMatkulFilter] = useState('all')
    const [typeFilter, setTypeFilter] = useState('all')
    const [examTypeFilter, setExamTypeFilter] = useState('all') // UTS/UAS filter
    const [modalOpen, setModalOpen] = useState(false)
    const [editingQuestion, setEditingQuestion] = useState(null)
    const [previewQuestion, setPreviewQuestion] = useState(null)
    const [bankSoalModalOpen, setBankSoalModalOpen] = useState(false)

    // Package-based view states
    const [viewMode, setViewMode] = useState('packages') // 'packages' or 'questions'
    const [selectedPackage, setSelectedPackage] = useState(null) // { matkulId, examType }
    const [createPackageModalOpen, setCreatePackageModalOpen] = useState(false)

    // Load matkul, kelas, and soal from Supabase
    useEffect(() => {
        const loadData = async () => {
            try {
                // Get current user info
                const dosenId = user?.id
                const dosenMatkulIds = user?.matkulIds || []

                console.log('[BuatSoal] Loading data for dosen:', {
                    id: dosenId,
                    matkulIds: dosenMatkulIds
                })

                // Load mata kuliah from Supabase
                const allMatkul = await matkulService.getAll()
                if (dosenMatkulIds.length > 0) {
                    // Filter matkul based on dosen's assigned courses
                    const dosenMatkul = allMatkul.filter(mk =>
                        dosenMatkulIds.some(id => String(id) === String(mk.id))
                    )
                    setMatkulList(dosenMatkul)
                    console.log('[BuatSoal] Dosen matkul loaded:', dosenMatkul.length)
                } else {
                    // No specific matkul assigned - show empty list
                    setMatkulList([])
                    console.log('[BuatSoal] No matkulIds assigned')
                }

                // Load kelas from Supabase
                const allKelas = await kelasService.getAll()
                const dosenKelasIds = user?.kelasIds || []
                if (dosenKelasIds.length > 0) {
                    const dosenKelas = allKelas.filter(k =>
                        dosenKelasIds.some(id => String(id) === String(k.id))
                    )
                    setKelasList(dosenKelas)
                    console.log('[BuatSoal] Dosen kelas loaded:', dosenKelas.length)
                } else if (user?.prodiId) {
                    const prodiKelas = allKelas.filter(k => String(k.prodi_id) === String(user.prodiId))
                    setKelasList(prodiKelas)
                } else {
                    setKelasList([])
                }

                // Load soal from Supabase (filtered by dosen_id)
                if (dosenId) {
                    const allSoal = await soalService.getAll({ dosen_id: dosenId })
                    // Map Supabase fields to local format
                    const mappedSoal = allSoal.map(s => ({
                        id: s.id,
                        text: s.pertanyaan,
                        type: s.tipe_soal,
                        matkulId: s.matkul_id,
                        examType: s.tipe_ujian?.toUpperCase() || 'UTS',
                        points: s.bobot || 10,
                        options: s.pilihan || [],
                        correctAnswer: s.jawaban_benar,
                        image: s.gambar,
                        dosenId: s.dosen_id,
                        matkul: s.matkul // Include joined matkul data
                    }))
                    setQuestions(mappedSoal)
                    console.log('[BuatSoal] Soal loaded:', mappedSoal.length)
                } else {
                    setQuestions([])
                }

                setIsInitialized(true)
            } catch (error) {
                console.error('[BuatSoal] Error loading data:', error)
                setIsInitialized(true)
            }
        }

        if (user) {
            loadData()
        }
    }, [user])

    // Note: We no longer auto-save all questions because we need to preserve
    // other dosen's questions. Instead, we directly manipulate localStorage
    // in handleSaveQuestion and handleDeleteQuestion.

    // Type labels
    const typeLabels = {
        pilihan_ganda: 'Pilihan Ganda',
        essay: 'Essay',
        benar_salah: 'Benar/Salah',
        mencocokan: 'Mencocokan'
    }

    // Filter questions
    const filteredQuestions = questions.filter(q => {
        const matchesSearch = q.text.toLowerCase().includes(search.toLowerCase())
        const matchesMatkul = matkulFilter === 'all' || q.matkulId === parseInt(matkulFilter)
        const matchesType = typeFilter === 'all' || q.type === typeFilter
        // Case-insensitive examType matching
        const matchesExamType = examTypeFilter === 'all' ||
            q.examType?.toUpperCase() === examTypeFilter.toUpperCase()
        return matchesSearch && matchesMatkul && matchesType && matchesExamType
    })

    // Group questions by matkulId + examType for package view
    const questionPackages = questions.reduce((acc, q) => {
        const key = `${q.matkulId}-${q.examType?.toUpperCase() || 'UTS'}`
        if (!acc[key]) {
            acc[key] = {
                matkulId: q.matkulId,
                examType: q.examType?.toUpperCase() || 'UTS',
                questions: []
            }
        }
        acc[key].questions.push(q)
        return acc
    }, {})

    // Get questions for selected package
    const getPackageQuestions = () => {
        if (!selectedPackage) return []
        return questions.filter(q =>
            q.matkulId === selectedPackage.matkulId &&
            q.examType?.toUpperCase() === selectedPackage.examType?.toUpperCase()
        )
    }

    // Handle entering a package
    const handleEnterPackage = (pkg) => {
        setSelectedPackage({ matkulId: pkg.matkulId, examType: pkg.examType })
        setViewMode('questions')
    }

    // Handle going back to packages view
    const handleBackToPackages = () => {
        setSelectedPackage(null)
        setViewMode('packages')
    }

    const handleAddQuestion = () => {
        setEditingQuestion(null)
        setModalOpen(true)
    }

    const handleEditQuestion = (question) => {
        setEditingQuestion(question)
        setModalOpen(true)
    }

    const handleSaveQuestion = async (data) => {
        try {
            // If inside a package, auto-set matkulId and examType
            const questionData = selectedPackage ? {
                ...data,
                matkulId: selectedPackage.matkulId,
                examType: selectedPackage.examType
            } : data

            // Map to Supabase format
            const supabaseData = {
                pertanyaan: questionData.text,
                tipe_soal: questionData.type,
                matkul_id: questionData.matkulId,
                tipe_ujian: questionData.examType?.toUpperCase() || 'UTS',
                bobot: questionData.points || 10,
                pilihan: questionData.options || [],
                jawaban_benar: questionData.correctAnswer,
                gambar: questionData.image,
                dosen_id: user?.id
            }

            if (editingQuestion) {
                // Update existing question in Supabase
                const updated = await soalService.update(editingQuestion.id, supabaseData)
                // Update local state
                const updatedQuestions = questions.map(q =>
                    q.id === editingQuestion.id ? {
                        ...q,
                        text: questionData.text,
                        type: questionData.type,
                        matkulId: questionData.matkulId,
                        examType: questionData.examType?.toUpperCase() || 'UTS',
                        points: questionData.points,
                        options: questionData.options,
                        correctAnswer: questionData.correctAnswer,
                        image: questionData.image
                    } : q
                )
                setQuestions(updatedQuestions)
                console.log('[BuatSoal] Question updated:', updated)
            } else {
                // Create new question in Supabase
                const created = await soalService.create(supabaseData)
                // Map back to local format and add to state
                const newQuestion = {
                    id: created.id,
                    text: created.pertanyaan,
                    type: created.tipe_soal,
                    matkulId: created.matkul_id,
                    examType: created.tipe_ujian?.toUpperCase() || 'UTS',
                    points: created.bobot || 10,
                    options: created.pilihan || [],
                    correctAnswer: created.jawaban_benar,
                    image: created.gambar,
                    dosenId: created.dosen_id
                }
                setQuestions([...questions, newQuestion])
                console.log('[BuatSoal] Question created:', created)
            }
        } catch (error) {
            console.error('[BuatSoal] Error saving question:', error)
            alert('Gagal menyimpan soal: ' + error.message)
        }
    }

    const handleDeleteQuestion = (id) => {
        showConfirm({
            title: 'Konfirmasi Hapus',
            message: 'Apakah Anda yakin ingin menghapus soal ini?',
            onConfirm: async () => {
                try {
                    await soalService.delete(id)
                    setQuestions(questions.filter(q => q.id !== id))
                    console.log('[BuatSoal] Question deleted:', id)
                } catch (error) {
                    console.error('[BuatSoal] Error deleting question:', error)
                    alert('Gagal menghapus soal: ' + error.message)
                }
            }
        })
    }

    const handleImportFromBank = async (importedQuestions) => {
        try {
            // If inside a package, use package's matkulId and examType
            const targetMatkulId = selectedPackage?.matkulId || matkulList[0]?.id
            const targetExamType = selectedPackage?.examType || 'UTS'

            const newQuestions = []
            for (const q of importedQuestions) {
                const supabaseData = {
                    pertanyaan: q.text,
                    tipe_soal: q.type,
                    matkul_id: targetMatkulId,
                    tipe_ujian: targetExamType,
                    bobot: q.points || 10,
                    pilihan: q.options || [],
                    jawaban_benar: q.correctAnswer,
                    gambar: q.image,
                    dosen_id: user?.id
                }
                const created = await soalService.create(supabaseData)
                newQuestions.push({
                    id: created.id,
                    text: created.pertanyaan,
                    type: created.tipe_soal,
                    matkulId: created.matkul_id,
                    examType: created.tipe_ujian?.toUpperCase() || 'UTS',
                    points: created.bobot || 10,
                    options: created.pilihan || [],
                    correctAnswer: created.jawaban_benar,
                    image: created.gambar,
                    dosenId: created.dosen_id
                })
            }
            setQuestions([...questions, ...newQuestions])
            console.log('[BuatSoal] Imported', newQuestions.length, 'questions')
        } catch (error) {
            console.error('[BuatSoal] Error importing questions:', error)
            alert('Gagal mengimpor soal: ' + error.message)
        }
    }

    const getMatkulName = (id) => matkulList.find(m => String(m.id) === String(id))?.nama || '-'

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                {/* Header changes based on view mode */}
                <div className="page-header">
                    <div>
                        {viewMode === 'packages' ? (
                            <>
                                <h1 className="page-title">Buat Soal</h1>
                                <p className="page-subtitle">Kelola paket soal untuk ujian mata kuliah Anda</p>
                            </>
                        ) : (
                            <>
                                <button
                                    className="btn btn-ghost"
                                    onClick={handleBackToPackages}
                                    style={{ marginBottom: '0.5rem', padding: '0.25rem 0.5rem' }}
                                >
                                    ← Kembali ke Paket Soal
                                </button>
                                <h1 className="page-title">{getMatkulName(selectedPackage?.matkulId)} - {selectedPackage?.examType}</h1>
                                <p className="page-subtitle">Kelola soal dalam paket ini</p>
                            </>
                        )}
                    </div>
                    <div className="header-actions">
                        {viewMode === 'questions' && (
                            <>
                                <button className="btn btn-secondary" onClick={() => setBankSoalModalOpen(true)}>
                                    <Database size={18} />
                                    Ambil dari Bank Soal
                                </button>
                                <button className="btn btn-primary" onClick={handleAddQuestion}>
                                    <Plus size={18} />
                                    Tambah Soal
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Score Info Note */}
                <div className="score-info-card">
                    <div className="score-info-text">
                        <span>📝 Skala nilai: 0-100</span>
                        <span className="divider">|</span>
                        <span>✓ Batas nilai lulus ujian: 70</span>
                    </div>
                </div>

                {/* Content based on view mode */}
                {viewMode === 'packages' ? (
                    /* PACKAGES VIEW */
                    <div className="card">
                        <div className="card-body">
                            {Object.keys(questionPackages).length === 0 ? (
                                <div className="empty-state">
                                    <BookOpen size={48} />
                                    <h3>Belum ada paket soal</h3>
                                    <p>Mulai buat soal dengan mengklik tombol di bawah</p>
                                    <button className="btn btn-primary" onClick={() => {
                                        setSelectedPackage(null)
                                        setModalOpen(true)
                                    }} style={{ marginTop: '1rem' }}>
                                        <Plus size={18} />
                                        Buat Soal Pertama
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                                        <button className="btn btn-primary" onClick={() => {
                                            setSelectedPackage(null)
                                            setModalOpen(true)
                                        }}>
                                            <Plus size={18} />
                                            Buat Soal Baru
                                        </button>
                                    </div>
                                    <div className="packages-grid" style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                        gap: '1rem'
                                    }}>
                                        {Object.values(questionPackages).map((pkg, index) => (
                                            <div
                                                key={`${pkg.matkulId}-${pkg.examType}`}
                                                className="package-card"
                                                style={{
                                                    background: 'var(--bg-secondary)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: 'var(--radius-lg)',
                                                    padding: '1.5rem',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onClick={() => handleEnterPackage(pkg)}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.borderColor = 'var(--primary)'
                                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.borderColor = 'var(--border-color)'
                                                    e.currentTarget.style.boxShadow = 'none'
                                                }}
                                            >
                                                <h3 style={{
                                                    margin: '0 0 0.5rem 0',
                                                    fontSize: '1.1rem',
                                                    fontWeight: '600',
                                                    color: 'var(--text-primary)'
                                                }}>
                                                    {getMatkulName(pkg.matkulId)}
                                                </h3>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                                    <span className={`badge badge-${pkg.examType === 'UAS' ? 'error' : 'warning'}`}>
                                                        {pkg.examType}
                                                    </span>
                                                </div>
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    borderTop: '1px solid var(--border-color)',
                                                    paddingTop: '1rem',
                                                    marginTop: '0.5rem'
                                                }}>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                                        {pkg.questions.length} soal
                                                    </span>
                                                    <span style={{
                                                        color: 'var(--primary)',
                                                        fontSize: '0.875rem',
                                                        fontWeight: '500'
                                                    }}>
                                                        Kelola Soal →
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    /* QUESTIONS VIEW (inside a package) */
                    <div className="card">
                        <div className="card-body">
                            {/* Filters */}
                            <div className="filters-row" style={{ marginBottom: '1rem' }}>
                                <div className="search-box">
                                    <Search size={18} className="search-icon" />
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Cari soal..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                    />
                                </div>
                                <select
                                    className="form-input"
                                    value={typeFilter}
                                    onChange={e => setTypeFilter(e.target.value)}
                                    style={{ width: 'auto', minWidth: '150px' }}
                                >
                                    <option value="all">Semua Tipe Soal</option>
                                    <option value="pilihan_ganda">Pilihan Ganda</option>
                                    <option value="essay">Essay</option>
                                    <option value="benar_salah">Benar/Salah</option>
                                    <option value="mencocokan">Mencocokan</option>
                                </select>
                            </div>

                            {/* Questions List for selected package */}
                            <div className="questions-list">
                                {(() => {
                                    const packageQuestions = getPackageQuestions().filter(q => {
                                        const matchesSearch = q.text.toLowerCase().includes(search.toLowerCase())
                                        const matchesType = typeFilter === 'all' || q.type === typeFilter
                                        return matchesSearch && matchesType
                                    })

                                    return packageQuestions.length === 0 ? (
                                        <div className="empty-state">
                                            <BookOpen size={48} />
                                            <h3>Belum ada soal dalam paket ini</h3>
                                            <p>Klik tombol "Tambah Soal" untuk menambahkan soal</p>
                                        </div>
                                    ) : (
                                        packageQuestions.map((question, index) => (
                                            <div key={question.id} className="question-card">
                                                <div className="question-header">
                                                    <div className="question-meta">
                                                        <span className="question-number">#{index + 1}</span>
                                                        <span className={`badge badge-${question.type === 'pilihan_ganda' ? 'primary' :
                                                            question.type === 'essay' ? 'accent' :
                                                                question.type === 'benar_salah' ? 'success' : 'info'
                                                            }`}>
                                                            {typeLabels[question.type]}
                                                        </span>
                                                    </div>
                                                    <span className="question-points">{question.points} poin</span>
                                                </div>
                                                <p className="question-text">{question.text}</p>
                                                {question.image && (
                                                    <div className="question-image-thumb">
                                                        <img src={question.image} alt="Question" />
                                                    </div>
                                                )}
                                                <div className="question-actions">
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => setPreviewQuestion(question)}
                                                    >
                                                        <Eye size={16} />
                                                        Preview
                                                    </button>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => handleEditQuestion(question)}
                                                    >
                                                        <Edit2 size={16} />
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="btn btn-ghost btn-sm text-error"
                                                        onClick={() => handleDeleteQuestion(question.id)}
                                                    >
                                                        <Trash2 size={16} />
                                                        Hapus
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )
                                })()}
                            </div>

                            {/* Add Question Button at bottom */}
                            <div
                                onClick={handleAddQuestion}
                                style={{
                                    marginTop: '1rem',
                                    padding: '1.5rem',
                                    border: '2px dashed var(--border-color)',
                                    borderRadius: 'var(--radius-lg)',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    color: 'var(--text-muted)'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = 'var(--primary)'
                                    e.currentTarget.style.color = 'var(--primary)'
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = 'var(--border-color)'
                                    e.currentTarget.style.color = 'var(--text-muted)'
                                }}
                            >
                                <Plus size={24} style={{ marginBottom: '0.5rem' }} />
                                <div>Tambah Soal Baru</div>
                            </div>
                        </div>
                    </div>
                )}

                <QuestionModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    question={editingQuestion}
                    onSave={handleSaveQuestion}
                    matkul={matkulList}
                    kelasList={kelasList}
                    currentExamType={selectedPackage?.examType || (examTypeFilter !== 'all' ? examTypeFilter : 'uts')}
                    selectedPackage={selectedPackage}
                />

                <BankSoalModal
                    isOpen={bankSoalModalOpen}
                    onClose={() => setBankSoalModalOpen(false)}
                    onSelectQuestions={handleImportFromBank}
                    matkul={matkulList}
                />

                {/* Preview Modal */}
                {previewQuestion && (
                    <div className="modal-overlay" onClick={() => setPreviewQuestion(null)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Preview Soal</h3>
                                <button className="btn btn-icon btn-ghost" onClick={() => setPreviewQuestion(null)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body">
                                <div className="preview-meta">
                                    <span className={`badge badge-${previewQuestion.type === 'pilihan_ganda' ? 'primary' :
                                        previewQuestion.type === 'essay' ? 'accent' :
                                            previewQuestion.type === 'benar_salah' ? 'success' : 'info'
                                        }`}>
                                        {typeLabels[previewQuestion.type]}
                                    </span>
                                    <span>{previewQuestion.points} poin</span>
                                </div>
                                <p className="preview-question">{previewQuestion.text}</p>
                                {previewQuestion.image && (
                                    <img src={previewQuestion.image} alt="Question" className="preview-image" />
                                )}

                                {previewQuestion.type === 'pilihan_ganda' && previewQuestion.options && (
                                    <div className="preview-options">
                                        {previewQuestion.options.map((opt, i) => (
                                            <div
                                                key={i}
                                                className={`preview-option ${i === previewQuestion.correctAnswer ? 'correct' : ''}`}
                                            >
                                                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                                                <div className="option-content-preview">
                                                    <span>{opt.text}</span>
                                                    {opt.image && <img src={opt.image} alt={`Option ${i}`} />}
                                                </div>
                                                {i === previewQuestion.correctAnswer && <CheckCircle size={16} />}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {previewQuestion.type === 'benar_salah' && (
                                    <div className="preview-options">
                                        <div className={`preview-option ${previewQuestion.correctAnswer === true ? 'correct' : ''}`}>
                                            <span>Benar</span>
                                            {previewQuestion.correctAnswer === true && <CheckCircle size={16} />}
                                        </div>
                                        <div className={`preview-option ${previewQuestion.correctAnswer === false ? 'correct' : ''}`}>
                                            <span>Salah</span>
                                            {previewQuestion.correctAnswer === false && <CheckCircle size={16} />}
                                        </div>
                                    </div>
                                )}

                                {previewQuestion.type === 'mencocokan' && previewQuestion.pairs && (
                                    <div className="preview-matching">
                                        {previewQuestion.pairs.map((pair, i) => (
                                            <div key={i} className="preview-pair">
                                                <span className="pair-left">{pair.left}</span>
                                                <ArrowRight size={16} />
                                                <span className="pair-right">{pair.right}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {previewQuestion.type === 'essay' && (
                                    <div className="preview-essay-hint">
                                        <span>Jawaban berupa essay (akan dikoreksi manual)</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    flex-wrap: wrap;
                    gap: var(--space-4);
                }
                .total-points-card {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: var(--space-4) var(--space-5);
                    border-radius: var(--radius-lg);
                    margin-bottom: var(--space-5);
                }
                .total-points-card.valid {
                    background: var(--success-50);
                    border: 1px solid var(--success-200);
                }
                .total-points-card.invalid {
                    background: var(--warning-50);
                    border: 1px solid var(--warning-200);
                }
                .points-info {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                }
                .points-label {
                    font-weight: var(--font-medium);
                    color: var(--text-secondary);
                }
                .points-value {
                    font-size: var(--font-size-xl);
                    font-weight: var(--font-bold);
                    color: var(--text-primary);
                }
                .points-warning {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    color: var(--warning-600);
                    font-size: var(--font-size-sm);
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
                    min-width: 200px;
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
                .questions-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4);
                }
                .question-card {
                    padding: var(--space-5);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--border-color);
                    transition: all var(--transition-fast);
                }
                .question-card:hover {
                    border-color: var(--primary-300);
                    box-shadow: var(--shadow-md);
                }
                .question-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--space-3);
                    flex-wrap: wrap;
                    gap: var(--space-2);
                }
                .question-meta {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    flex-wrap: wrap;
                }
                .question-number {
                    font-size: var(--font-size-sm);
                    font-weight: var(--font-bold);
                    color: var(--text-muted);
                }
                .question-points {
                    font-size: var(--font-size-sm);
                    font-weight: var(--font-semibold);
                    color: var(--accent-600);
                    background: var(--accent-50);
                    padding: var(--space-1) var(--space-3);
                    border-radius: var(--radius-full);
                }
                .question-text {
                    font-size: var(--font-size-base);
                    color: var(--text-primary);
                    margin-bottom: var(--space-4);
                    line-height: 1.6;
                }
                .question-image-thumb {
                    margin-bottom: var(--space-4);
                }
                .question-image-thumb img {
                    max-height: 100px;
                    border-radius: var(--radius-md);
                }
                .question-actions {
                    display: flex;
                    gap: var(--space-2);
                    flex-wrap: wrap;
                }
                .text-error {
                    color: var(--error-500) !important;
                }
                .badge-outline {
                    background: transparent;
                    border: 1px solid var(--border-color);
                    color: var(--text-secondary);
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
                .modal-lg {
                    max-width: 700px;
                }
                .form-row-2 {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: var(--space-4);
                }
                .form-row-3 {
                    display: grid;
                    grid-template-columns: 1fr 1fr 100px;
                    gap: var(--space-4);
                }
                /* Kelas Checkbox Grid Styles */
                .kelas-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--space-2);
                }
                .kelas-checkbox-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                    gap: var(--space-2);
                }
                .kelas-checkbox-item {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    padding: var(--space-3);
                    border: 2px solid var(--border-color);
                    border-radius: var(--radius-lg);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    background: var(--bg-tertiary);
                }
                .kelas-checkbox-item:hover {
                    border-color: var(--primary-300);
                    background: var(--primary-50);
                }
                .kelas-checkbox-item.selected {
                    border-color: var(--primary-500);
                    background: var(--primary-50);
                }
                .kelas-checkbox-item input[type="checkbox"] {
                    display: none;
                }
                .kelas-checkbox-label {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                }
                .kelas-checkbox-label strong {
                    font-size: var(--font-size-sm);
                    color: var(--text-primary);
                }
                .kelas-checkbox-label small {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
                .kelas-check-icon {
                    color: var(--primary-600);
                    flex-shrink: 0;
                }
                .kelas-selected-hint {
                    margin-top: var(--space-2);
                    color: var(--success-600);
                    font-weight: 500;
                }
                .form-textarea {
                    resize: vertical;
                    min-height: 80px;
                }
                .type-selector {
                    display: flex;
                    gap: var(--space-2);
                    flex-wrap: wrap;
                }
                .type-btn {
                    padding: var(--space-2) var(--space-4);
                    border: 2px solid var(--border-color);
                    border-radius: var(--radius-lg);
                    background: var(--bg-tertiary);
                    cursor: pointer;
                    font-size: var(--font-size-sm);
                    transition: all var(--transition-fast);
                }
                .type-btn:hover {
                    border-color: var(--primary-300);
                }
                .type-btn.active {
                    border-color: var(--primary-500);
                    background: var(--primary-50);
                    color: var(--primary-700);
                }
                .image-upload-area {
                    padding: var(--space-4);
                    border: 2px dashed var(--border-color);
                    border-radius: var(--radius-lg);
                    text-align: center;
                }
                .image-preview {
                    position: relative;
                    display: inline-block;
                }
                .image-preview img {
                    max-height: 150px;
                    border-radius: var(--radius-md);
                }
                .remove-image {
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: var(--error-500);
                    color: white;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .options-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3);
                }
                .option-row-extended {
                    display: flex;
                    align-items: flex-start;
                    gap: var(--space-3);
                }
                .option-content {
                    flex: 1;
                    display: flex;
                    gap: var(--space-2);
                    align-items: center;
                }
                .option-content .form-input {
                    flex: 1;
                }
                .option-radio {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border: none;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-full);
                    color: var(--text-muted);
                    cursor: pointer;
                    transition: all var(--transition-fast);
                    flex-shrink: 0;
                    margin-top: 4px;
                }
                .option-radio:hover {
                    background: var(--primary-50);
                    color: var(--primary-600);
                }
                .option-radio.selected {
                    background: var(--success-500);
                    color: white;
                }
                .option-image-preview {
                    position: relative;
                    flex-shrink: 0;
                }
                .option-image-preview img {
                    height: 40px;
                    width: 40px;
                    object-fit: cover;
                    border-radius: var(--radius-md);
                }
                .remove-image-sm {
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: var(--error-500);
                    color: white;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .radio-group {
                    display: flex;
                    gap: var(--space-4);
                }
                .radio-label {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    cursor: pointer;
                }
                .radio-label input {
                    width: 18px;
                    height: 18px;
                    accent-color: var(--primary-600);
                }
                .matching-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3);
                }
                .matching-row {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                }
                .matching-row .form-input {
                    flex: 1;
                }
                .matching-arrow {
                    color: var(--text-muted);
                    flex-shrink: 0;
                }
                .form-hint {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                    margin-top: var(--space-2);
                }
                .preview-meta {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                    margin-bottom: var(--space-4);
                }
                .preview-question {
                    font-size: var(--font-size-lg);
                    font-weight: var(--font-medium);
                    color: var(--text-primary);
                    margin-bottom: var(--space-4);
                }
                .preview-image {
                    max-width: 100%;
                    max-height: 200px;
                    border-radius: var(--radius-md);
                    margin-bottom: var(--space-4);
                }
                .preview-options {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2);
                }
                .preview-option {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                    padding: var(--space-3);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-md);
                    border: 2px solid transparent;
                }
                .preview-option.correct {
                    background: var(--success-50);
                    border-color: var(--success-300);
                }
                .preview-option.correct svg {
                    color: var(--success-500);
                }
                .option-letter {
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--primary-100);
                    color: var(--primary-700);
                    border-radius: var(--radius-full);
                    font-size: var(--font-size-sm);
                    font-weight: var(--font-bold);
                }
                .option-content-preview {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2);
                }
                .option-content-preview img {
                    max-height: 60px;
                    border-radius: var(--radius-sm);
                }
                .preview-matching {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2);
                }
                .preview-pair {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                    padding: var(--space-3);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-md);
                }
                .pair-left {
                    flex: 1;
                    font-weight: var(--font-medium);
                }
                .pair-right {
                    flex: 1;
                    color: var(--text-secondary);
                }
                .preview-essay-hint {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    padding: var(--space-4);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-md);
                    color: var(--text-muted);
                }
                /* Score Info Card */
                .score-info-card {
                    background: linear-gradient(135deg, var(--primary-50) 0%, var(--accent-50) 100%);
                    border: 1px solid var(--primary-200);
                    border-radius: var(--radius-lg);
                    padding: var(--space-3) var(--space-4);
                    margin-bottom: var(--space-4);
                }
                .score-info-text {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-4);
                    font-size: var(--font-size-sm);
                    color: var(--primary-700);
                    font-weight: 500;
                }
                .score-info-text .divider {
                    color: var(--primary-300);
                }
                @media (max-width: 768px) {
                    .form-row-2 {
                        grid-template-columns: 1fr;
                    }
                    .form-row-3 {
                        grid-template-columns: 1fr;
                    }
                    .filters-row {
                        flex-direction: column;
                    }
                }
            `}</style>
        </DashboardLayout>
    )
}

export default BuatSoalPage
