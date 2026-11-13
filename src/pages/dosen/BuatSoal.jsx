import { useState, useRef, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useSettings } from '../../contexts/SettingsContext'
import { getActiveAcademicYear, filterMatkulByTerm } from '../../utils/academicYear'
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
    Database,
    Loader2,
    Upload,
    FileSpreadsheet
} from 'lucide-react'
import * as XLSX from 'xlsx'
import '../admin/Dashboard.css'

// Supabase services
import { soalService, matkulService, kelasService } from '../../services/supabaseService'
import { isSupabaseConfigured } from '../../lib/supabase'
import { toast, errorMessage } from '../../components/Toast'

// Bank Soal Modal for selecting existing questions
function BankSoalModal({ isOpen, onClose, onSelectQuestions, dosenId, tahunAkademik }) {
    const [selectedQuestions, setSelectedQuestions] = useState([])
    const [examTypeFilter, setExamTypeFilter] = useState('all')
    const [bankSoalData, setBankSoalData] = useState([])
    const [loading, setLoading] = useState(false)

    // Load bank soal from Supabase when modal opens
    useEffect(() => {
        if (!isOpen) return
        const loadBankSoal = async () => {
            setLoading(true)
            try {
                if (isSupabaseConfigured()) {
                    const filters = {
                        ...(dosenId ? { dosen_id: dosenId } : {}),
                        ...(tahunAkademik ? { tahun_akademik: tahunAkademik } : {})
                    }
                    const soalData = await soalService.getAll(filters)
                    const mapped = (soalData || []).map(s => ({
                        id: s.id,
                        text: s.pertanyaan || s.text || 'Soal tanpa teks',
                        type: s.tipe_soal || 'pilihan_ganda',
                        examType: (s.tipe_ujian || 'UTS').toUpperCase(),
                        points: s.bobot || s.poin || 1,
                        matkul: s.matkul?.nama || '-',
                        options: (s.pilihan && s.pilihan.length > 0) ? s.pilihan : (s.opsi || s.options || []),
                        correctAnswer: s.jawaban_benar ?? s.correct_answer,
                        image: s.gambar || null,
                        kelasIds: s.kelas_ids || [],
                        clusterId: s.cluster_id || null,
                        clusterLabel: s.cluster_label || '',
                        // Keep original data for import
                        _original: s
                    }))
                    setBankSoalData(mapped)
                }
            } catch (err) {
                console.error('[BankSoal] Error loading:', err)
            }
            setLoading(false)
        }
        loadBankSoal()
        setSelectedQuestions([])
    }, [isOpen, dosenId, tahunAkademik])

    const filteredQuestions = bankSoalData.filter(q =>
        examTypeFilter === 'all' || q.examType === examTypeFilter.toUpperCase()
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
                <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    <div className="bank-soal-filters">
                        <select
                            className="form-input"
                            value={examTypeFilter}
                            onChange={e => setExamTypeFilter(e.target.value)}
                        >
                            <option value="all">Semua Tipe</option>
                            <option value="UTS">UTS</option>
                            <option value="UAS">UAS</option>
                        </select>
                    </div>
                    <div className="bank-soal-list">
                        {loading ? (
                            <div className="text-center" style={{ padding: '48px', opacity: 0.6 }}>
                                <p>Memuat bank soal...</p>
                            </div>
                        ) : filteredQuestions.length === 0 ? (
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
                                        <span className="badge badge-primary">{q.examType}</span>
                                        <span className="badge badge-outline">{q.type}</span>
                                        <span>{q.points} poin</span>
                                        <span style={{ color: 'var(--text-muted)' }}>• {q.matkul}</span>
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

function QuestionModal({ isOpen, onClose, question, onSave, matkul, kelasList, currentExamType, selectedPackage, existingQuestions }) {
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
            { text: '', image: null },
            { text: '', image: null }
        ],
        correctAnswer: 0,
        pairs: [
            { left: '', right: '' },
            { left: '', right: '' }
        ],
        examType: currentExamType || 'uts',
        clusterId: null,
        clusterLabel: '',
        mathKeyboard: false,
        answerGuide: ''
    })

    const [formData, setFormData] = useState(question || getDefaultFormData())
    const [saving, setSaving] = useState(false)
    const questionImageRef = useRef(null)

    // Reset form when question changes or modal opens
    useEffect(() => {
        if (isOpen) {
            if (question) {
                // Ensure kelasIds is always an array (migrate from old kelasId format)
                const kelasIds = question.kelasIds || (question.kelasId ? [question.kelasId] : [])

                // Normalize options to {text, image} format
                // Options from DB may be plain strings, {id, text}, or {text, image}
                const rawOptions = question.options || []
                const normalizedOptions = rawOptions.length > 0
                    ? rawOptions.map(opt => {
                        if (typeof opt === 'string') return { text: opt, image: null }
                        return { text: opt.text || opt.label || '', image: opt.image || null }
                    })
                    : [
                        { text: '', image: null },
                        { text: '', image: null },
                        { text: '', image: null },
                        { text: '', image: null },
                        { text: '', image: null }
                    ]

                // Ensure at least 5 options for pilihan_ganda
                while (normalizedOptions.length < 5 && (question.type === 'pilihan_ganda' || question.type === 'pilihan_ganda_kompleks')) {
                    normalizedOptions.push({ text: '', image: null })
                }

                setFormData({ ...question, kelasIds, options: normalizedOptions })
            } else {
                setFormData(getDefaultFormData())
            }
        }
    }, [isOpen, question, matkul])

    // Auto-lock points when clusterLabel matches an existing cluster
    const clusterPointsLock = (() => {
        if (!formData.clusterLabel || !formData.clusterLabel.trim() || !existingQuestions) return null
        const label = formData.clusterLabel.trim()
        // Find any existing question with the same cluster label (excluding current question being edited)
        const match = existingQuestions.find(q => {
            if (question && q.id === question.id) return false // skip self
            return (q.clusterLabel || '').trim() === label
        })
        return match ? match.points : null
    })()

    // When cluster points lock changes, auto-set the points
    useEffect(() => {
        if (clusterPointsLock !== null && formData.points !== clusterPointsLock) {
            setFormData(prev => ({ ...prev, points: clusterPointsLock }))
        }
    }, [clusterPointsLock])

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

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (saving) return // block double-click duplicates
        setSaving(true)
        try {
            // Keep the form open when saving fails so the typed question isn't lost
            const ok = await onSave(formData)
            if (ok !== false) onClose()
        } finally {
            setSaving(false)
        }
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
                                        onChange={e => setFormData({ ...formData, matkulId: e.target.value, kelasIds: [] })}
                                    >
                                        {matkul.map(mk => (
                                            <option key={mk.id} value={mk.id}>{mk.nama}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="form-group" style={selectedPackage ? { width: '100%' } : {}}>
                                <label className="form-label">
                                    Bobot Nilai di Butir Soal Ini
                                    {clusterPointsLock !== null && (
                                        <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: 'var(--warning-600)', fontWeight: 'normal' }}>
                                            🔒 Terkunci oleh cluster ({clusterPointsLock} poin)
                                        </span>
                                    )}
                                </label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={formData.points}
                                    onChange={e => setFormData({ ...formData, points: parseInt(e.target.value) })}
                                    min={1}
                                    max={100}
                                    disabled={clusterPointsLock !== null}
                                    style={clusterPointsLock !== null ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
                                />
                            </div>
                        </div>

                        {/* Kelas Multi-Select Checkbox - Only show when creating new package (not inside existing) */}
                        {!selectedPackage && (() => {
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

                        {/* Cluster Soal (Varian) */}
                        <div className="form-group">
                            <label className="form-label">Cluster Soal (Opsional)</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.clusterLabel || ''}
                                onChange={e => setFormData({ ...formData, clusterLabel: e.target.value })}
                                placeholder="Misal: Soal 1 - Hitung Volume Kapal"
                            />
                            <p className="form-hint">
                                Soal dengan cluster yang sama akan diacak — setiap mahasiswa mendapat 1 varian per cluster.
                                Kosongkan jika soal ini tidak memiliki varian.
                            </p>
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

                        {/* Essay options */}
                        {formData.type === 'essay' && (
                            <>
                                <div className="form-group">
                                    <label className="essay-option-toggle">
                                        <input
                                            type="checkbox"
                                            checked={!!formData.mathKeyboard}
                                            onChange={e => setFormData({ ...formData, mathKeyboard: e.target.checked })}
                                        />
                                        <span>
                                            <strong>Aktifkan keyboard rumus matematika</strong>
                                            <small>Mahasiswa mendapat tombol simbol (√, x², π, ∫, ≤, α, pecahan, dll.) di atas kolom jawaban soal ini.</small>
                                        </span>
                                    </label>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Pedoman / Kunci Jawaban <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(opsional)</span></label>
                                    <textarea
                                        className="form-input"
                                        rows={4}
                                        value={formData.answerGuide || ''}
                                        onChange={e => setFormData({ ...formData, answerGuide: e.target.value })}
                                        placeholder="Poin-poin jawaban yang diharapkan. Ditampilkan saat koreksi dan dipakai fitur Tanya AI."
                                    />
                                    <p className="form-hint">Tidak ditampilkan di layar ujian mahasiswa.</p>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            <Save size={16} />
                            {saving ? 'Menyimpan...' : 'Simpan Soal'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function BuatSoalPage() {
    const { user } = useAuth()
    const { settings } = useSettings()
    const tahunAkademik = getActiveAcademicYear(settings, user)
    const { showConfirm, ask } = useConfirm()
    const [questions, setQuestions] = useState([])
    const [matkulList, setMatkulList] = useState([])
    const [kelasList, setKelasList] = useState([])
    const [isInitialized, setIsInitialized] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
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

    // Edit kelas modal state
    const [editKelasModal, setEditKelasModal] = useState(false)
    const [editKelasPackage, setEditKelasPackage] = useState(null)
    const [editKelasIds, setEditKelasIds] = useState([])
    const [editKelasLoading, setEditKelasLoading] = useState(false)

    // Edit mata kuliah: move a whole package to another course / exam type
    const [editMatkulPkg, setEditMatkulPkg] = useState(null)
    const [editMatkulTarget, setEditMatkulTarget] = useState({ matkulId: '', examType: 'UTS' })
    const [editMatkulSaving, setEditMatkulSaving] = useState(false)

    // Excel upload progress / result panel
    const [importProgress, setImportProgress] = useState(null)

    // New (empty) package: pick course + exam type, then add/import questions
    const [newPkgForm, setNewPkgForm] = useState({ matkulId: '', examType: 'UTS', kelasIds: [] })

    // Load matkul, kelas, and soal from Supabase (parallelized for speed)
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true)
            try {
                const dosenId = user?.id
                const dosenMatkulIds = user?.matkulIds || []
                const dosenKelasIds = user?.kelasIds || []

                // Load ALL data in parallel for maximum speed
                const soalFilter = {
                    ...(dosenId ? { dosen_id: dosenId } : {}),
                    ...(tahunAkademik ? { tahun_akademik: tahunAkademik } : {})
                }
                const [allMatkul, allKelas, allSoal] = await Promise.all([
                    matkulService.getAll(),
                    kelasService.getAll(),
                    soalService.getAll(soalFilter)
                ])

                // Process matkul
                if (dosenMatkulIds.length > 0) {
                    const dosenMatkul = allMatkul.filter(mk =>
                        dosenMatkulIds.some(id => String(id) === String(mk.id))
                    )
                    setMatkulList(dosenMatkul.length > 0 ? dosenMatkul : allMatkul)
                } else {
                    setMatkulList(allMatkul)
                }

                // Process kelas
                if (dosenKelasIds.length > 0) {
                    setKelasList(allKelas.filter(k =>
                        dosenKelasIds.some(id => String(id) === String(k.id))
                    ))
                } else if (user?.prodiId) {
                    setKelasList(allKelas.filter(k => String(k.prodi_id) === String(user.prodiId)))
                } else {
                    setKelasList([])
                }

                // Map soal from DB format to UI format
                const reverseTipeSoal = (dbType) => {
                    const mapping = {
                        'uraian': 'essay',
                        'menjodohkan': 'mencocokan',
                        'pilihan_ganda': 'pilihan_ganda',
                        'pilihan_ganda_kompleks': 'pilihan_ganda_kompleks',
                        'benar_salah': 'benar_salah'
                    }
                    return mapping[dbType] || dbType
                }
                setQuestions(allSoal.map(s => ({
                    id: s.id,
                    text: s.pertanyaan,
                    type: reverseTipeSoal(s.tipe_soal),
                    matkulId: s.matkul_id,
                    examType: s.tipe_ujian?.toUpperCase() || 'UTS',
                    points: s.bobot || 10,
                    options: (s.pilihan || []).map(opt =>
                        typeof opt === 'string' ? { text: opt, image: null } : { text: opt.text || '', image: opt.image || null }
                    ),
                    correctAnswer: s.jawaban_benar,
                    dosenId: s.dosen_id,
                    kelasIds: s.kelas_ids || [],
                    image: s.gambar || null,
                    matkul: s.matkul,
                    clusterId: s.cluster_id || null,
                    clusterLabel: s.cluster_label || '',
                    mathKeyboard: s.math_keyboard === true,
                    answerGuide: s.pedoman_jawaban || ''
                })))

                setIsInitialized(true)
            } catch (error) {
                console.error('[BuatSoal] Error loading data:', error)
                setIsInitialized(true)
            } finally {
                setIsLoading(false)
            }
        }

        if (user) {
            loadData()
        }
    }, [user, tahunAkademik])

    // Note: We no longer auto-save all questions because we need to preserve
    // in handleSaveQuestion and handleDeleteQuestion.

    // Type labels
    const typeLabels = {
        pilihan_ganda: 'Pilihan Ganda',
        essay: 'Essay',
        uraian: 'Essay',
        benar_salah: 'Benar/Salah',
        mencocokan: 'Mencocokan',
        menjodohkan: 'Mencocokan',
        pilihan_ganda_kompleks: 'Pilihan Ganda Kompleks'
    }

    // Filter questions
    const filteredQuestions = questions.filter(q => {
        const matchesSearch = q.text.toLowerCase().includes(search.toLowerCase())
        const matchesMatkul = matkulFilter === 'all' || String(q.matkulId) === String(matkulFilter)
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

    // Calculate effective points: for clustered soal, only count 1 per cluster
    // because each student only sees 1 variant per cluster during the exam
    // Groups by clusterId OR clusterLabel (for unsaved questions that don't have clusterId yet)
    const calcEffectivePoints = (questionsList) => {
        let total = 0
        const seenClusterIds = new Set()
        const seenClusterLabels = new Set()
        for (const q of questionsList) {
            const cId = q.clusterId
            const cLabel = (q.clusterLabel || '').trim()
            if (cId) {
                // Group by clusterId
                if (!seenClusterIds.has(cId)) {
                    seenClusterIds.add(cId)
                    total += (q.points || 0)
                }
            } else if (cLabel) {
                // No clusterId yet, group by clusterLabel
                if (!seenClusterLabels.has(cLabel)) {
                    seenClusterLabels.add(cLabel)
                    total += (q.points || 0)
                }
            } else {
                total += (q.points || 0)
            }
        }
        return total
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
        // Validate total points won't exceed 100 when inside a package
        if (selectedPackage) {
            const pkgQuestions = getPackageQuestions()
            // For validation, simulate replacing the edited question with the new data
            const simulatedQuestions = editingQuestion
                ? pkgQuestions.map(q => q.id === editingQuestion.id ? { ...q, points: data.points || 0, clusterId: data.clusterId || q.clusterId, clusterLabel: data.clusterLabel } : q)
                : [...pkgQuestions, { points: data.points || 0, clusterId: data.clusterId || null, clusterLabel: data.clusterLabel }]
            const newTotal = calcEffectivePoints(simulatedQuestions)
            if (newTotal > 100) {
                const currentEffective = calcEffectivePoints(pkgQuestions)
                toast.warning(`Total poin efektif akan menjadi ${newTotal}/100. Maksimal total poin adalah 100. Sisa poin yang tersedia: ${100 - currentEffective + (editingQuestion ? (editingQuestion.points || 0) : 0)}`)
                return false
            }
        }
        try {
            // If inside a package, auto-set matkulId and examType
            const questionData = selectedPackage ? {
                ...data,
                matkulId: selectedPackage.matkulId,
                examType: selectedPackage.examType,
                kelasIds: (data.kelasIds && data.kelasIds.length > 0) ? data.kelasIds : getPackageKelasIds(selectedPackage)
            } : data

            // Map tipe_soal to Supabase schema values
            // Allowed: 'pilihan_ganda', 'pilihan_ganda_kompleks', 'benar_salah', 'menjodohkan', 'uraian'
            const mapTipeSoal = (type) => {
                const mapping = {
                    'pilihan_ganda': 'pilihan_ganda',
                    'multiple_choice': 'pilihan_ganda',
                    'pilihan_ganda_kompleks': 'pilihan_ganda_kompleks',
                    'essay': 'uraian',
                    'uraian': 'uraian',
                    'benar_salah': 'benar_salah',
                    'true_false': 'benar_salah',
                    'mencocokan': 'menjodohkan',
                    'menjodohkan': 'menjodohkan',
                    'matching': 'menjodohkan'
                }
                return mapping[type] || 'pilihan_ganda'
            }

            // Resolve cluster_id: if clusterLabel is set, find or create a cluster_id
            let resolvedClusterId = questionData.clusterId || null
            if (questionData.clusterLabel && questionData.clusterLabel.trim()) {
                const label = questionData.clusterLabel.trim()
                // Find existing question with the same cluster label
                const existing = questions.find(q =>
                    q.clusterLabel && q.clusterLabel.trim() === label && q.clusterId
                )
                if (existing) {
                    resolvedClusterId = existing.clusterId
                } else if (!resolvedClusterId) {
                    // Generate new UUID for new cluster
                    resolvedClusterId = crypto.randomUUID()
                }
            } else {
                resolvedClusterId = null // No cluster
            }

            // Map to Supabase format
            const supabaseData = {
                pertanyaan: questionData.text,
                tipe_soal: mapTipeSoal(questionData.type),
                matkul_id: questionData.matkulId,
                tipe_ujian: questionData.examType?.toUpperCase() || 'UTS',
                bobot: questionData.points || 10,
                pilihan: questionData.options || [],
                jawaban_benar: questionData.correctAnswer,
                dosen_id: user?.id,
                tahun_akademik: tahunAkademik
            }

            // Essay options (columns added by MIGRATION_ESSAY_MATH_AI.sql)
            const isEssay = questionData.type === 'essay'
            if (isEssay || (editingQuestion && !editingQuestion._isNewVariant)) {
                supabaseData.math_keyboard = isEssay && !!questionData.mathKeyboard
                supabaseData.pedoman_jawaban = isEssay && questionData.answerGuide?.trim() ? questionData.answerGuide.trim() : null
            }

            // These columns may not exist if migrations haven't been run
            // For UPDATES: always include to allow clearing values
            // For CREATES: only include if they have values to avoid insert errors on missing columns
            const isUpdate = editingQuestion && !editingQuestion._isNewVariant

            if (isUpdate) {
                // Always set these for updates so clearing works
                supabaseData.kelas_ids = (questionData.kelasIds && questionData.kelasIds.length > 0) ? questionData.kelasIds : []
                supabaseData.gambar = questionData.image || null
                supabaseData.cluster_id = resolvedClusterId || null
                supabaseData.cluster_label = questionData.clusterLabel || null
            } else {
                // Only include for creates if they have values
                if (questionData.kelasIds && questionData.kelasIds.length > 0) supabaseData.kelas_ids = questionData.kelasIds
                if (questionData.image) supabaseData.gambar = questionData.image
                if (resolvedClusterId) supabaseData.cluster_id = resolvedClusterId
                if (questionData.clusterLabel) supabaseData.cluster_label = questionData.clusterLabel
            }

            // Warn before adding a question whose text already exists in the package
            if (!(editingQuestion && !editingQuestion._isNewVariant) && selectedPackage) {
                const key = normalizeSoalText(questionData.text)
                if (key && getPackageQuestions().some(q => normalizeSoalText(q.text) === key) &&
                    !(await ask({ title: 'Soal Sudah Ada', message: 'Soal dengan teks yang sama sudah ada di paket ini. Tetap simpan sebagai soal baru?', confirmText: 'Tetap Simpan' }))) {
                    return false
                }
            }

            if (editingQuestion && !editingQuestion._isNewVariant) {
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
                        image: questionData.image,
                        clusterId: resolvedClusterId,
                        clusterLabel: questionData.clusterLabel,
                        kelasIds: supabaseData.kelas_ids || [],
                        mathKeyboard: !!supabaseData.math_keyboard,
                        answerGuide: supabaseData.pedoman_jawaban || ''
                    } : q
                )
                setQuestions(updatedQuestions)
                console.log('[BuatSoal] Question updated:', updated)
                toast.success('Soal berhasil diperbarui')
            } else {
                // Create new question in Supabase
                const created = await soalService.create(supabaseData)
                // Map back to local format and add to state
                const newQuestion = {
                    id: created.id,
                    text: created.pertanyaan,
                    type: questionData.type, // Use form value ('essay') not DB value ('uraian')
                    matkulId: created.matkul_id,
                    examType: created.tipe_ujian?.toUpperCase() || 'UTS',
                    points: created.bobot || 10,
                    options: (created.pilihan || []).map(opt =>
                        typeof opt === 'string' ? { text: opt, image: null } : { text: opt.text || '', image: opt.image || null }
                    ),
                    correctAnswer: created.jawaban_benar,
                    dosenId: created.dosen_id,
                    kelasIds: created.kelas_ids || [],
                    image: created.gambar || questionData.image || null,
                    clusterId: resolvedClusterId,
                    clusterLabel: questionData.clusterLabel || '',
                    mathKeyboard: !!created.math_keyboard,
                    answerGuide: created.pedoman_jawaban || ''
                }
                setQuestions(prev => [...prev, newQuestion])
                console.log('[BuatSoal] Question created:', created)
                toast.success('Soal berhasil ditambahkan')
            }
            return true
        } catch (error) {
            console.error('[BuatSoal] Error saving question:', error)
            toast.error('Gagal menyimpan soal: ' + errorMessage(error))
            return false
        }
    }

    const handleDeleteQuestion = (id) => {
        showConfirm({
            title: 'Konfirmasi Hapus',
            message: 'Apakah Anda yakin ingin menghapus soal ini?',
            onConfirm: async () => {
                try {
                    await soalService.delete(id)
                    setQuestions(prev => prev.filter(q => q.id !== id))
                    console.log('[BuatSoal] Question deleted:', id)
                    toast.success('Soal berhasil dihapus')
                } catch (error) {
                    console.error('[BuatSoal] Error deleting question:', error)
                    toast.error('Gagal menghapus soal: ' + errorMessage(error))
                }
            }
        })
    }

    // Delete entire package (all questions in a matkul+examType group)
    const handleDeletePackage = (pkg) => {
        const matkulName = getMatkulName(pkg.matkulId)
        showConfirm({
            title: 'Hapus Paket Soal',
            message: `Hapus semua ${pkg.questions.length} soal dalam paket "${matkulName} - ${pkg.examType}"? Tindakan ini tidak dapat dibatalkan.`,
            onConfirm: async () => {
                try {
                    // Delete all questions in the package in parallel
                    await Promise.all(pkg.questions.map(q => soalService.delete(q.id)))
                    // Remove from local state
                    const deletedIds = new Set(pkg.questions.map(q => q.id))
                    setQuestions(prev => prev.filter(q => !deletedIds.has(q.id)))
                    console.log('[BuatSoal] Package deleted:', matkulName, pkg.examType, pkg.questions.length, 'questions')
                    toast.success(`Paket soal "${matkulName} - ${pkg.examType}" berhasil dihapus`)
                } catch (error) {
                    console.error('[BuatSoal] Error deleting package:', error)
                    toast.error('Gagal menghapus paket soal: ' + errorMessage(error))
                }
            }
        })
    }

    // Edit kelas for entire package
    const handleOpenEditKelas = (pkg, e) => {
        if (e) e.stopPropagation()
        // Get current kelas_ids from first question or collect all
        const allKelasIds = [...new Set(pkg.questions.flatMap(q => q.kelasIds || []))]
        setEditKelasPackage(pkg)
        setEditKelasIds(allKelasIds)
        setEditKelasModal(true)
    }

    const handleSaveEditKelas = async () => {
        if (!editKelasPackage) return
        setEditKelasLoading(true)
        try {
            // Update all questions in the package
            const updatePromises = editKelasPackage.questions.map(q =>
                soalService.update(q.id, { kelas_ids: editKelasIds })
            )
            await Promise.all(updatePromises)
            
            // Update local state
            const pkgQuestionIds = new Set(editKelasPackage.questions.map(q => q.id))
            setQuestions(prev => prev.map(q =>
                pkgQuestionIds.has(q.id) ? { ...q, kelasIds: [...editKelasIds] } : q
            ))
            
            console.log('[BuatSoal] Kelas updated for package:', editKelasPackage.matkulId, editKelasPackage.examType, 'new kelas:', editKelasIds)
            setEditKelasModal(false)
            setEditKelasPackage(null)
            toast.success('Kelas paket soal berhasil diperbarui')
        } catch (error) {
            console.error('[BuatSoal] Error updating kelas:', error)
            toast.error('Gagal mengubah kelas: ' + errorMessage(error))
        } finally {
            setEditKelasLoading(false)
        }
    }

    // Courses of the active term for package pickers
    const termMatkulList = filterMatkulByTerm(matkulList, tahunAkademik)

    // Classes of a package: chosen when it was created, else the union of its
    // questions' classes. New/imported questions inherit them.
    const getPackageKelasIds = (pkg) => {
        if (!pkg) return []
        if (pkg.kelasIds && pkg.kelasIds.length > 0) return pkg.kelasIds
        return [...new Set(questions
            .filter(q => String(q.matkulId) === String(pkg.matkulId) && q.examType?.toUpperCase() === pkg.examType?.toUpperCase())
            .flatMap(q => q.kelasIds || []))]
    }

    const openNewPackage = () => {
        setNewPkgForm({ matkulId: termMatkulList[0]?.id || '', examType: 'UTS', kelasIds: [] })
        setCreatePackageModalOpen(true)
    }

    // Open a package straight away (no first question needed), so the dosen
    // can use Template / Upload Excel / Bank Soal immediately
    const handleCreatePackage = () => {
        const { matkulId, examType, kelasIds } = newPkgForm
        if (!matkulId) {
            toast.warning('Pilih mata kuliah terlebih dahulu.')
            return
        }
        const exists = questions.some(q => String(q.matkulId) === String(matkulId) && q.examType?.toUpperCase() === examType)
        setCreatePackageModalOpen(false)
        setSelectedPackage({ matkulId, examType, kelasIds })
        setViewMode('questions')
        if (exists) {
            toast.info(`Paket ${getMatkulName(matkulId)} - ${examType} sudah ada, paket tersebut dibuka.`)
        } else {
            toast.success(`Paket ${getMatkulName(matkulId)} - ${examType} siap. Tambahkan soal, Upload Excel, atau ambil dari Bank Soal.`)
        }
    }

    const openEditMatkul = (pkg, e) => {
        if (e) e.stopPropagation()
        setEditMatkulPkg(pkg)
        setEditMatkulTarget({ matkulId: pkg.matkulId, examType: pkg.examType })
    }

    // Move every question of a package to another course / exam type
    const moveEditMatkulPackage = async () => {
        const pkg = editMatkulPkg
        const target = { ...editMatkulTarget }
        setEditMatkulSaving(true)
        try {
            const results = await Promise.allSettled(pkg.questions.map(q =>
                soalService.update(q.id, { matkul_id: target.matkulId, tipe_ujian: target.examType })
            ))
            const movedIds = new Set(pkg.questions.filter((_, i) => results[i].status === 'fulfilled').map(q => q.id))
            const failed = results.length - movedIds.size
            setQuestions(prev => prev.map(q => movedIds.has(q.id) ? { ...q, matkulId: target.matkulId, examType: target.examType } : q))
            if (selectedPackage && String(selectedPackage.matkulId) === String(pkg.matkulId) && selectedPackage.examType === pkg.examType && failed === 0) {
                setSelectedPackage({ matkulId: target.matkulId, examType: target.examType })
            }
            if (failed === 0) {
                toast.success(`${movedIds.size} soal dipindahkan ke ${getMatkulName(target.matkulId)} - ${target.examType}`)
                setEditMatkulPkg(null)
            } else {
                toast.error(`${movedIds.size} soal berhasil dipindahkan, ${failed} gagal. Coba simpan lagi untuk sisanya.`, 12000)
            }
        } catch (error) {
            toast.error('Gagal memindahkan paket: ' + errorMessage(error))
        } finally {
            setEditMatkulSaving(false)
        }
    }

    const handleSaveEditMatkul = () => {
        const pkg = editMatkulPkg
        const target = editMatkulTarget
        if (!pkg || !target.matkulId) return
        if (String(target.matkulId) === String(pkg.matkulId) && target.examType === pkg.examType) {
            setEditMatkulPkg(null)
            return
        }
        const existing = questions.filter(q =>
            String(q.matkulId) === String(target.matkulId) && q.examType?.toUpperCase() === target.examType)
        if (existing.length > 0) {
            const total = calcEffectivePoints([...existing, ...pkg.questions])
            showConfirm({
                title: 'Gabungkan Paket Soal',
                message: `Paket ${getMatkulName(target.matkulId)} - ${target.examType} sudah berisi ${existing.length} soal. ` +
                    `${pkg.questions.length} soal akan digabung ke paket tersebut (total ${total} poin` +
                    `${total > 100 ? ', melebihi 100 — kurangi bobot setelahnya' : ''}). Lanjutkan?`,
                confirmText: 'Gabungkan',
                confirmVariant: 'success',
                onConfirm: moveEditMatkulPackage
            })
            return
        }
        moveEditMatkulPackage()
    }

    const handleImportFromBank = async (importedQuestions) => {
        try {
            // If inside a package, use package's matkulId and examType
            const targetMatkulId = selectedPackage?.matkulId || matkulList[0]?.id
            const targetExamType = selectedPackage?.examType || 'UTS'

            // Map tipe_soal to Supabase schema values
            // Allowed: 'pilihan_ganda', 'pilihan_ganda_kompleks', 'benar_salah', 'menjodohkan', 'uraian'
            const mapTipeSoal = (type) => {
                const mapping = {
                    'pilihan_ganda': 'pilihan_ganda',
                    'multiple_choice': 'pilihan_ganda',
                    'pilihan_ganda_kompleks': 'pilihan_ganda_kompleks',
                    'essay': 'uraian',
                    'uraian': 'uraian',
                    'benar_salah': 'benar_salah',
                    'true_false': 'benar_salah',
                    'mencocokan': 'menjodohkan',
                    'menjodohkan': 'menjodohkan',
                    'matching': 'menjodohkan'
                }
                return mapping[type] || 'pilihan_ganda'
            }

            const newQuestions = []
            const existingTexts = new Set(getPackageQuestions().map(pq => normalizeSoalText(pq.text)))
            let skippedDup = 0
            for (const q of importedQuestions) {
                // Use _original data for reliable field access
                const orig = q._original || {}
                const key = normalizeSoalText(q.text)
                if (key && existingTexts.has(key)) { skippedDup++; continue }
                existingTexts.add(key)

                // Get pilihan: prefer mapped options if non-empty, else fall back to original DB data
                const pilihan = (q.options && q.options.length > 0) ? q.options : (orig.pilihan || [])

                console.log('[BuatSoal] Importing question:', q.text?.substring(0, 50), 'pilihan count:', pilihan.length, 'from q.options:', q.options?.length, 'from orig.pilihan:', orig.pilihan?.length)

                const supabaseData = {
                    pertanyaan: q.text,
                    tipe_soal: mapTipeSoal(q.type),
                    matkul_id: targetMatkulId,
                    tipe_ujian: targetExamType,
                    bobot: q.points || 10,
                    pilihan: pilihan,
                    jawaban_benar: q.correctAnswer ?? orig.jawaban_benar,
                    dosen_id: user?.id,
                    tahun_akademik: tahunAkademik
                }
                if (orig.math_keyboard) supabaseData.math_keyboard = true
                if (orig.pedoman_jawaban) supabaseData.pedoman_jawaban = orig.pedoman_jawaban

                // Optional columns (may not exist if migration not run)
                const pkgKelas = getPackageKelasIds(selectedPackage)
                const kelasIds = pkgKelas.length > 0 ? pkgKelas
                    : ((q.kelasIds && q.kelasIds.length > 0) ? q.kelasIds : (orig.kelas_ids || []))
                if (kelasIds.length > 0) supabaseData.kelas_ids = kelasIds
                const gambar = q.image || orig.gambar || null
                if (gambar) supabaseData.gambar = gambar
                const clusterId = q.clusterId || orig.cluster_id || null
                if (clusterId) supabaseData.cluster_id = clusterId
                const clusterLabel = q.clusterLabel || orig.cluster_label || null
                if (clusterLabel) supabaseData.cluster_label = clusterLabel
                const created = await soalService.create(supabaseData)
                newQuestions.push({
                    id: created.id,
                    text: created.pertanyaan,
                    type: created.tipe_soal,
                    matkulId: created.matkul_id,
                    examType: created.tipe_ujian?.toUpperCase() || 'UTS',
                    points: created.bobot || 10,
                    options: (created.pilihan || []).map(opt =>
                        typeof opt === 'string' ? { text: opt, image: null } : { text: opt.text || '', image: opt.image || null }
                    ),
                    correctAnswer: created.jawaban_benar,
                    dosenId: created.dosen_id,
                    kelasIds: created.kelas_ids || []
                })
            }
            setQuestions(prev => [...prev, ...newQuestions])
            console.log('[BuatSoal] Imported', newQuestions.length, 'questions')
            toast.success(`${newQuestions.length} soal berhasil diimpor dari bank soal` +
                (skippedDup ? ` (${skippedDup} dilewati karena sudah ada di paket)` : ''))
        } catch (error) {
            console.error('[BuatSoal] Error importing questions:', error)
            toast.error('Gagal mengimpor soal: ' + errorMessage(error))
        }
    }

    // Download Excel template for bulk question import
    const handleDownloadTemplate = () => {
        const templateData = [
            {
                'Pertanyaan': 'Contoh: Apa kepanjangan dari IMO?',
                'Tipe Soal': 'pilihan_ganda',
                'Bobot': 10,
                'Pilihan A': 'International Maritime Organization',
                'Pilihan B': 'International Marine Office',
                'Pilihan C': 'Indonesian Maritime Organization',
                'Pilihan D': 'International Maritime Office',
                'Pilihan E': '',
                'Jawaban Benar (A/B/C/D/E)': 'A'
            },
            {
                'Pertanyaan': 'Contoh: Jelaskan fungsi utama sistem kemudi kapal',
                'Tipe Soal': 'essay',
                'Bobot': 20,
                'Pilihan A': '',
                'Pilihan B': '',
                'Pilihan C': '',
                'Pilihan D': '',
                'Pilihan E': '',
                'Jawaban Benar (A/B/C/D/E)': ''
            },
            {
                'Pertanyaan': 'Contoh: Kapal tanker termasuk jenis kapal penumpang',
                'Tipe Soal': 'benar_salah',
                'Bobot': 5,
                'Pilihan A': '',
                'Pilihan B': '',
                'Pilihan C': '',
                'Pilihan D': '',
                'Pilihan E': '',
                'Jawaban Benar (A/B/C/D/E)': 'Salah'
            }
        ]

        const ws = XLSX.utils.json_to_sheet(templateData)

        // Set column widths
        ws['!cols'] = [
            { wch: 50 },  // Pertanyaan
            { wch: 18 },  // Tipe Soal
            { wch: 8 },   // Bobot
            { wch: 35 },  // A
            { wch: 35 },  // B
            { wch: 35 },  // C
            { wch: 35 },  // D
            { wch: 35 },  // E
            { wch: 25 }   // Jawaban
        ]

        // Add instruction sheet
        const instruksi = [
            ['PETUNJUK PENGISIAN TEMPLATE SOAL'],
            [''],
            ['1. Kolom "Pertanyaan" wajib diisi'],
            ['2. Tipe Soal: pilihan_ganda, essay, benar_salah'],
            ['3. Bobot: nilai poin untuk soal ini (1-100)'],
            ['4. Pilihan A-E: isi untuk tipe pilihan_ganda, kosongkan untuk essay/benar_salah'],
            ['5. Jawaban Benar: A/B/C/D/E untuk pilihan ganda, Benar/Salah untuk benar_salah, kosong untuk essay'],
            ['6. Hapus baris contoh sebelum mengupload'],
            [''],
            ['CATATAN:'],
            ['- Mata kuliah dan jenis ujian (UTS/UAS) mengikuti paket soal yang sedang aktif'],
            [`- File ini dibuat untuk Tahun Akademik ${tahunAkademik || 'belum dipilih'}`],
            ['- Pastikan format file .xlsx'],
        ]
        const wsInstruksi = XLSX.utils.aoa_to_sheet(instruksi)
        wsInstruksi['!cols'] = [{ wch: 80 }]

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Soal')
        XLSX.utils.book_append_sheet(wb, wsInstruksi, 'Petunjuk')

        const matkulName = selectedPackage ? getMatkulName(selectedPackage.matkulId) : 'Soal'
        const examType = selectedPackage?.examType || 'UTS'
        const tahunFile = (tahunAkademik || 'tanpa-tahun').replace(/[^a-zA-Z0-9-]/g, '-')
        XLSX.writeFile(wb, `Template_${matkulName}_${examType}_${tahunFile}.xlsx`)
    }

    // Import questions from Excel file
    // Same question = same text, ignoring case, spacing and HTML tags
    const normalizeSoalText = (t) => String(t || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()

    // Excel upload in steps: read & check the file, show a summary (ready /
    // duplicates / invalid), then upload in batches with a visible progress.
    const handleExcelImport = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        // Reset input so same file can be re-uploaded
        e.target.value = ''
        if (importProgress?.running) return

        const sourceYearMatch = file.name.match(/(20\d{2})-(20\d{2})-(Ganjil|Genap)/i)
        if (sourceYearMatch) {
            const sourceTahunAkademik = `${sourceYearMatch[1]}/${sourceYearMatch[2]} ${sourceYearMatch[3][0].toUpperCase()}${sourceYearMatch[3].slice(1).toLowerCase()}`
            if (tahunAkademik && sourceTahunAkademik !== tahunAkademik && !await ask({ title: 'Periode Berbeda', message:
                `File ini dibuat untuk ${sourceTahunAkademik}, sedangkan periode aktif adalah ${tahunAkademik}. Soal akan disimpan ke periode aktif. Lanjutkan?`
            })) return
        }

        let rows
        try {
            const data = await file.arrayBuffer()
            const workbook = XLSX.read(data, { type: 'array' })
            const sheet = workbook.Sheets[workbook.SheetNames[0]]
            rows = XLSX.utils.sheet_to_json(sheet)
        } catch (error) {
            console.error('[BuatSoal] Excel read error:', error)
            toast.error('Gagal membaca file Excel: ' + errorMessage(error))
            return
        }

        if (!rows || rows.length === 0) {
            toast.error('File Excel kosong. Pastikan ada data di sheet pertama.')
            return
        }
        if (!selectedPackage) {
            toast.error('Buka paket soal (mata kuliah & jenis ujian) dulu sebelum upload Excel.')
            return
        }

        const targetMatkulId = selectedPackage.matkulId
        const targetExamType = selectedPackage.examType || 'UTS'
        const packageKelasIds = getPackageKelasIds(selectedPackage)

        const mapTipeSoal = (type) => {
            const t = (type || '').toLowerCase().trim()
            const mapping = {
                'pilihan_ganda': 'pilihan_ganda',
                'pilihan ganda': 'pilihan_ganda',
                'pg': 'pilihan_ganda',
                'multiple_choice': 'pilihan_ganda',
                'essay': 'uraian',
                'uraian': 'uraian',
                'benar_salah': 'benar_salah',
                'benar salah': 'benar_salah',
                'true_false': 'benar_salah',
            }
            return mapping[t] || 'pilihan_ganda'
        }
        const answerMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4 }

        // ---- Step 1: read and check every row ----
        const ready = []          // { rowNumber, data }
        const invalidRows = []    // answer key empty / not A-E / points at an empty option
        const dupInFile = []      // { rowNumber, sameAs }
        const dupInPackage = []   // rowNumber
        const firstRowByText = new Map()
        const existingTexts = new Set(getPackageQuestions().map(q => normalizeSoalText(q.text)))
        let rowNumber = 1 // header is row 1
        let totalRows = 0

        for (const row of rows) {
            rowNumber++
            const pertanyaan = row['Pertanyaan'] || row['pertanyaan']
            if (!pertanyaan || pertanyaan.toString().trim() === '') continue
            totalRows++

            const tipeSoal = mapTipeSoal(row['Tipe Soal'] || row['tipe_soal'] || 'pilihan_ganda')
            const bobot = parseInt(row['Bobot'] || row['bobot'] || 10)
            let pilihan = []
            let jawabanBenar = null

            if (tipeSoal === 'pilihan_ganda') {
                const letters = ['A', 'B', 'C', 'D', 'E']
                const rawOptions = letters.map(l => {
                    const v = row[`Pilihan ${l}`] ?? row[`pilihan_${l.toLowerCase()}`] ?? ''
                    return v.toString().trim()
                })
                // The answer must be a single letter that points at a filled
                // option. Never guess: a wrong key silently fails every student.
                const jawabanRaw = (row['Jawaban Benar (A/B/C/D/E)'] ?? row['jawaban_benar'] ?? '').toString().trim().toUpperCase().replace(/[^A-E]/g, '')
                const answerIdx = jawabanRaw.length === 1 ? answerMap[jawabanRaw] : undefined
                if (answerIdx === undefined || !rawOptions[answerIdx]) {
                    invalidRows.push(rowNumber)
                    continue
                }
                // Drop empty options, then point the key at the same option
                // in the compacted list (empty C would otherwise shift D to C)
                const kept = rawOptions.map((text, i) => ({ text, i })).filter(o => o.text !== '')
                pilihan = kept.map(o => ({ text: o.text, image: null }))
                jawabanBenar = kept.findIndex(o => o.i === answerIdx)
            } else if (tipeSoal === 'benar_salah') {
                const jawaban = (row['Jawaban Benar (A/B/C/D/E)'] || row['jawaban_benar'] || '').toString().trim().toLowerCase()
                jawabanBenar = jawaban === 'benar' || jawaban === 'true' || jawaban === 'b'
            }

            const key = normalizeSoalText(pertanyaan)
            if (existingTexts.has(key)) {
                dupInPackage.push(rowNumber)
                continue
            }
            if (firstRowByText.has(key)) {
                dupInFile.push({ rowNumber, sameAs: firstRowByText.get(key) })
                continue
            }
            firstRowByText.set(key, rowNumber)

            ready.push({
                rowNumber,
                data: {
                    pertanyaan: pertanyaan.toString().trim(),
                    tipe_soal: tipeSoal,
                    matkul_id: targetMatkulId,
                    tipe_ujian: targetExamType,
                    bobot: bobot,
                    pilihan: pilihan,
                    jawaban_benar: jawabanBenar,
                    dosen_id: user?.id,
                    tahun_akademik: tahunAkademik,
                    ...(packageKelasIds.length > 0 ? { kelas_ids: packageKelasIds } : {})
                }
            })
        }

        // ---- Step 2: summary before anything is saved ----
        const list = (arr) => arr.slice(0, 12).join(', ') + (arr.length > 12 ? `, ... (+${arr.length - 12})` : '')
        const lines = [
            `File "${file.name}": ${totalRows} soal terbaca.`,
            '',
            `✓ Siap diupload: ${ready.length} soal`
        ]
        if (dupInPackage.length) lines.push(`⚠ Sudah ada di paket ini (dilewati): ${dupInPackage.length} — baris ${list(dupInPackage)}`)
        if (dupInFile.length) lines.push(`⚠ Duplikat di dalam file (dilewati): ${dupInFile.length} — ${list(dupInFile.map(d => `baris ${d.rowNumber} = baris ${d.sameAs}`))}`)
        if (invalidRows.length) lines.push(`✗ Kunci jawaban kosong/tidak valid (dilewati): ${invalidRows.length} — baris ${list(invalidRows)}`)

        if (ready.length === 0) {
            showConfirm({
                title: 'Tidak Ada Soal Baru',
                message: lines.join('\n') + '\n\nTidak ada soal yang diupload.',
                confirmText: 'Mengerti',
                confirmVariant: 'success',
                hideCancel: true,
                onConfirm: () => {}
            })
            return
        }

        showConfirm({
            title: 'Periksa Sebelum Upload',
            message: lines.join('\n') + `\n\nSoal akan masuk ke paket ${getMatkulName(targetMatkulId)} - ${targetExamType}.`,
            confirmText: `Upload ${ready.length} Soal`,
            confirmVariant: 'success',
            onConfirm: () => runExcelUpload(ready, {
                fileName: file.name,
                skippedDuplicates: dupInPackage.length + dupInFile.length,
                skippedInvalid: invalidRows.length
            })
        })
    }

    // ---- Step 3: upload in batches with progress ----
    const runExcelUpload = async (ready, info) => {
        const BATCH = 20
        const reverseTipeSoal = (dbType) => ({ 'uraian': 'essay', 'menjodohkan': 'mencocokan' }[dbType] || dbType)
        const toLocal = (r) => ({
            id: r.id,
            text: r.pertanyaan,
            type: reverseTipeSoal(r.tipe_soal),
            matkulId: r.matkul_id,
            examType: r.tipe_ujian?.toUpperCase() || 'UTS',
            points: r.bobot || 10,
            options: r.pilihan || [],
            correctAnswer: r.jawaban_benar,
            dosenId: r.dosen_id,
            kelasIds: r.kelas_ids || []
        })

        const failedRows = []
        let done = 0
        setImportProgress({ running: true, total: ready.length, done: 0, failed: 0, fileName: info.fileName })

        for (let i = 0; i < ready.length; i += BATCH) {
            const chunk = ready.slice(i, i + BATCH)
            let inserted = []
            try {
                inserted = await soalService.createMany(chunk.map(c => c.data))
            } catch (batchError) {
                // One bad row fails the whole batch: retry row by row to save the rest
                console.warn('[BuatSoal] Batch insert failed, retrying per row:', batchError?.message)
                for (const c of chunk) {
                    try {
                        inserted.push(await soalService.create(c.data))
                    } catch (rowError) {
                        console.error('[BuatSoal] Row insert failed:', c.rowNumber, rowError)
                        failedRows.push(c.rowNumber)
                    }
                }
            }
            if (inserted.length) setQuestions(prev => [...prev, ...inserted.map(toLocal)])
            done += chunk.length
            setImportProgress(p => ({ ...p, done, failed: failedRows.length }))
        }

        const created = ready.length - failedRows.length
        setImportProgress({
            running: false,
            total: ready.length,
            done: ready.length,
            failed: failedRows.length,
            created,
            failedRows,
            skippedDuplicates: info.skippedDuplicates,
            skippedInvalid: info.skippedInvalid,
            fileName: info.fileName
        })
        if (failedRows.length === 0) {
            toast.success(`${created} soal berhasil diupload dari Excel`)
        } else {
            toast.error(`${created} soal masuk, ${failedRows.length} gagal (baris ${failedRows.slice(0, 10).join(', ')}). Upload ulang file yang sama: soal yang sudah masuk otomatis dilewati.`, 15000)
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
                                <p className="page-subtitle">Kelola paket soal untuk ujian mata kuliah Anda · Tahun Akademik {tahunAkademik || 'belum dipilih'}</p>
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
                                {(() => {
                                    const pkgQ = getPackageQuestions()
                                    const totalPts = calcEffectivePoints(pkgQ)
                                    const color = totalPts === 100 ? 'var(--success-600)' : totalPts > 100 ? 'var(--error-600)' : 'var(--text-muted)'
                                    return (
                                        <p className="page-subtitle keep-mobile">
                                            Kelola soal dalam paket ini • 
                                            <span style={{ fontWeight: '600', color, marginLeft: '4px' }}>
                                                Total Poin: {totalPts}/100 {totalPts === 100 ? '✓' : totalPts > 100 ? '⚠ Kelebihan!' : `(Sisa: ${100 - totalPts})`}
                                            </span>
                                        </p>
                                    )
                                })()}
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
                                <button className="btn btn-outline" onClick={handleDownloadTemplate}>
                                    <Download size={18} />
                                    Template Excel
                                </button>
                                <label className="btn btn-outline" style={{ cursor: importProgress?.running ? 'wait' : 'pointer', opacity: importProgress?.running ? 0.6 : 1 }}>
                                    {importProgress?.running ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
                                    {importProgress?.running ? `Mengupload ${importProgress.done}/${importProgress.total}` : 'Upload Excel'}
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls"
                                        style={{ display: 'none' }}
                                        onChange={handleExcelImport}
                                        disabled={!!importProgress?.running}
                                    />
                                </label>
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
                        {selectedPackage && (() => {
                            const pkgQ = getPackageQuestions()
                            const totalPts = calcEffectivePoints(pkgQ)
                            return (
                                <>
                                    <span className="divider">|</span>
                                    <span style={{ fontWeight: '600', color: totalPts === 100 ? 'var(--success-600)' : totalPts > 100 ? 'var(--error-600)' : 'var(--warning-600)' }}>
                                        Akumulasi Poin: {totalPts}/100 {totalPts === 100 ? '✅' : totalPts > 100 ? '❌ Kelebihan!' : `⚠️ Kurang ${100 - totalPts}`}
                                    </span>
                                </>
                            )
                        })()}
                    </div>
                </div>

                {/* Content based on view mode */}
                {isLoading ? (
                    <div className="card">
                        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', gap: '1rem' }}>
                            <Loader2 size={40} className="spin" style={{ color: 'var(--primary)' }} />
                            <p style={{ color: 'var(--text-muted)' }}>Memuat data soal...</p>
                        </div>
                    </div>
                ) : viewMode === 'packages' ? (
                    /* PACKAGES VIEW */
                    <div className="card">
                        <div className="card-body">
                            {Object.keys(questionPackages).length === 0 ? (
                                <div className="empty-state">
                                    <BookOpen size={48} />
                                    <h3>Belum ada paket soal</h3>
                                    <p>Mulai buat soal dengan mengklik tombol di bawah</p>
                                    <button className="btn btn-primary" onClick={openNewPackage} style={{ marginTop: '1rem' }}>
                                        <Plus size={18} />
                                        Buat Paket Soal
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                                        <button className="btn btn-primary" onClick={openNewPackage}>
                                            <Plus size={18} />
                                            Buat Paket Soal Baru
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
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                    <span className={`badge badge-${pkg.examType === 'UAS' ? 'error' : 'warning'}`}>
                                                        {pkg.examType}
                                                    </span>
                                                </div>
                                                {/* Show selected kelas for this package */}
                                                {(() => {
                                                    // Collect all unique kelasIds from questions in this package
                                                    const allKelasIds = [...new Set(
                                                        pkg.questions.flatMap(q => q.kelasIds || [])
                                                    )]
                                                    // Get kelas names from kelasList
                                                    const selectedKelas = kelasList.filter(k =>
                                                        allKelasIds.includes(k.id)
                                                    )
                                                    if (selectedKelas.length > 0) {
                                                        return (
                                                            <div style={{
                                                                fontSize: '0.8rem',
                                                                color: 'var(--text-muted)',
                                                                marginBottom: '0.75rem'
                                                            }}>
                                                                <span style={{ fontWeight: '500' }}>Kelas: </span>
                                                                {selectedKelas.map(k => k.nama).join(', ')}
                                                            </div>
                                                        )
                                                    }
                                                    return null
                                                })()}
                                                {/* Points Progress */}
                                                {(() => {
                                                    const totalPoints = calcEffectivePoints(pkg.questions)
                                                    const percentage = Math.min((totalPoints / 100) * 100, 100)
                                                    const barColor = totalPoints === 100 ? 'var(--success-500)' : totalPoints > 100 ? 'var(--error-500)' : 'var(--warning-500)'
                                                    return (
                                                        <div style={{ marginTop: '0.75rem' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: barColor }}>
                                                                    {totalPoints}/100 poin
                                                                </span>
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                    {totalPoints === 100 ? '✓ Lengkap' : totalPoints > 100 ? `⚠ Kelebihan ${totalPoints - 100}` : `Sisa: ${100 - totalPoints}`}
                                                                </span>
                                                            </div>
                                                            <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', width: `${percentage}%`, background: barColor, borderRadius: '3px', transition: 'width 0.3s ease' }} />
                                                            </div>
                                                        </div>
                                                    )
                                                })()}
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    borderTop: '1px solid var(--border-color)',
                                                    paddingTop: '0.75rem',
                                                    marginTop: '0.75rem'
                                                }}>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                                        {pkg.questions.length} soal
                                                    </span>
                                                    <span style={{ color: 'var(--primary)', fontSize: '0.875rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                                        Kelola Soal →
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem' }}>
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={(e) => openEditMatkul(pkg, e)}
                                                            title="Pindahkan paket ke mata kuliah / jenis ujian lain"
                                                            style={{ padding: '0.25rem 0.5rem' }}
                                                        >
                                                            <BookOpen size={14} />
                                                            Edit Matkul
                                                        </button>
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={(e) => handleOpenEditKelas(pkg, e)}
                                                            title="Edit Kelas"
                                                            style={{ padding: '0.25rem 0.5rem' }}
                                                        >
                                                            <Edit2 size={14} />
                                                            Edit Kelas
                                                        </button>
                                                        <button
                                                            className="btn btn-ghost btn-sm text-error"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleDeletePackage(pkg)
                                                            }}
                                                            title="Hapus Paket"
                                                            style={{ padding: '0.25rem 0.5rem' }}
                                                        >
                                                            <Trash2 size={14} />
                                                            Hapus
                                                        </button>
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

                                    if (packageQuestions.length === 0) {
                                        return (
                                            <div className="empty-state">
                                                <BookOpen size={48} />
                                                <h3>Belum ada soal dalam paket ini</h3>
                                                <p>Gunakan tombol di atas: <strong>Template Excel</strong> lalu <strong>Upload Excel</strong>, <strong>Ambil dari Bank Soal</strong>, atau <strong>Tambah Soal</strong> satu per satu.</p>
                                            </div>
                                        )
                                    }

                                    // Group questions: clustered vs standalone
                                    const clusters = {}
                                    const standalone = []
                                    packageQuestions.forEach(q => {
                                        if (q.clusterId) {
                                            if (!clusters[q.clusterId]) {
                                                clusters[q.clusterId] = {
                                                    id: q.clusterId,
                                                    label: q.clusterLabel || 'Cluster',
                                                    variants: []
                                                }
                                            }
                                            clusters[q.clusterId].variants.push(q)
                                        } else {
                                            standalone.push(q)
                                        }
                                    })

                                    // Questions whose text repeats an earlier one in this package
                                    const duplicateIds = new Set()
                                    {
                                        const seen = new Set()
                                        getPackageQuestions().forEach(q => {
                                            const key = normalizeSoalText(q.text)
                                            if (!key) return
                                            if (seen.has(key)) duplicateIds.add(q.id)
                                            else seen.add(key)
                                        })
                                    }

                                    // Render function for a single question card
                                    const renderQuestion = (question, index, variantLabel = null) => (
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
                                                    {duplicateIds.has(question.id) && (
                                                        <span className="badge badge-error" title="Teks soal ini sama dengan soal lain di paket ini">Duplikat</span>
                                                    )}
                                                    {variantLabel && (
                                                        <span className="badge badge-warning">{variantLabel}</span>
                                                    )}
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
                                    )

                                    let globalIndex = 0

                                    return (
                                        <>
                                            {duplicateIds.size > 0 && (
                                                <div className="alert alert-warning">
                                                    <span>⚠ {duplicateIds.size} soal di paket ini sama persis dengan soal lain (ditandai <strong>Duplikat</strong>). Hapus salah satunya agar soal tidak muncul dua kali.</span>
                                                </div>
                                            )}
                                            {/* Render clustered questions */}
                                            {Object.values(clusters).map(cluster => {
                                                const clusterStartIndex = globalIndex
                                                globalIndex += 1 // Cluster counts as 1 question slot
                                                return (
                                                    <div key={cluster.id} className="cluster-group">
                                                        <div className="cluster-header">
                                                            <div className="cluster-info">
                                                                <span className="cluster-label">🔀 {cluster.label}</span>
                                                                <span className="badge badge-outline">{cluster.variants.length} varian</span>
                                                            </div>
                                                            <button
                                                                className="btn btn-outline btn-sm"
                                                                onClick={() => {
                                                                    const ref = cluster.variants[0]
                                                                    setEditingQuestion(null)
                                                                    // Pre-fill with cluster info
                                                                    setModalOpen(true)
                                                                    // We'll use a timeout to set the editing question after modal opens
                                                                    setTimeout(() => {
                                                                        const modal = document.querySelector('.modal form')
                                                                        if (modal) {
                                                                            // The modal will open with defaults, the cluster label will be inherited
                                                                        }
                                                                    }, 100)
                                                                    // Set a special editing state to pre-fill cluster
                                                                    setEditingQuestion({
                                                                        text: '',
                                                                        type: ref.type,
                                                                        matkulId: ref.matkulId,
                                                                        kelasIds: ref.kelasIds || [],
                                                                        points: ref.points,
                                                                        image: null,
                                                                        options: [
                                                                            { text: '', image: null },
                                                                            { text: '', image: null },
                                                                            { text: '', image: null },
                                                                            { text: '', image: null },
                                                                            { text: '', image: null }
                                                                        ],
                                                                        correctAnswer: 0,
                                                                        pairs: [{ left: '', right: '' }, { left: '', right: '' }],
                                                                        examType: ref.examType,
                                                                        clusterId: cluster.id,
                                                                        clusterLabel: cluster.label,
                                                                        _isNewVariant: true // Flag to not treat as edit
                                                                    })
                                                                }}
                                                            >
                                                                <Plus size={14} />
                                                                Tambah Varian
                                                            </button>
                                                        </div>
                                                        <div className="cluster-variants">
                                                            {cluster.variants.map((q, vi) =>
                                                                renderQuestion(q, clusterStartIndex, `Varian ${String.fromCharCode(65 + vi)}`)
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}

                                            {/* Render standalone questions */}
                                            {standalone.map(q => {
                                                const idx = globalIndex
                                                globalIndex += 1
                                                return renderQuestion(q, idx)
                                            })}
                                        </>
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
                    matkul={filterMatkulByTerm(matkulList, tahunAkademik, [editingQuestion?.matkulId])}
                    kelasList={kelasList}
                    currentExamType={selectedPackage?.examType || (examTypeFilter !== 'all' ? examTypeFilter : 'uts')}
                    selectedPackage={selectedPackage}
                    existingQuestions={selectedPackage ? getPackageQuestions() : questions}
                />

                <BankSoalModal
                    isOpen={bankSoalModalOpen}
                    onClose={() => setBankSoalModalOpen(false)}
                    onSelectQuestions={handleImportFromBank}
                    dosenId={user?.id}
                    tahunAkademik={tahunAkademik}
                />

                {/* Excel upload progress / result (can't be closed while uploading) */}
                {importProgress && (() => {
                    const p = importProgress
                    const pct = p.total ? Math.round((p.done / p.total) * 100) : 0
                    return (
                        <div className="modal-overlay" onClick={() => { if (!p.running) setImportProgress(null) }}>
                            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }} role="dialog" aria-live="polite">
                                <div className="modal-header">
                                    <h3>{p.running ? 'Mengupload Soal…' : (p.failed ? 'Upload Selesai (Ada yang Gagal)' : 'Upload Selesai')}</h3>
                                </div>
                                <div className="modal-body">
                                    <p className="form-hint" style={{ marginTop: 0 }}>{p.fileName}</p>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                                        <span>{p.running ? 'Menyimpan soal ke paket' : 'Selesai'}</span>
                                        <strong>{p.done} / {p.total} soal ({pct}%)</strong>
                                    </div>
                                    <div style={{ height: '10px', background: 'var(--bg-tertiary)', borderRadius: '6px', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${pct}%`,
                                            background: p.failed ? 'var(--warning-500)' : 'var(--success-500)',
                                            transition: 'width 0.25s ease'
                                        }} />
                                    </div>
                                    {p.running ? (
                                        <p className="form-hint" style={{ marginTop: '0.75rem' }}>
                                            <Loader2 size={14} className="spin" style={{ verticalAlign: 'middle', marginRight: 6 }} />
                                            Jangan tutup atau pindah halaman sampai selesai.
                                        </p>
                                    ) : (
                                        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.4rem', fontSize: '0.92rem' }}>
                                            <div>✅ <strong>{p.created}</strong> soal berhasil masuk ke paket</div>
                                            {p.skippedDuplicates > 0 && <div>⚠️ {p.skippedDuplicates} soal duplikat dilewati</div>}
                                            {p.skippedInvalid > 0 && <div>⚠️ {p.skippedInvalid} soal dilewati (kunci jawaban tidak valid)</div>}
                                            {p.failed > 0 && (
                                                <div style={{ color: 'var(--error-600)' }}>
                                                    ❌ {p.failed} soal gagal disimpan (baris {p.failedRows.slice(0, 12).join(', ')}{p.failedRows.length > 12 ? ', …' : ''}).
                                                    Upload ulang file yang sama — soal yang sudah masuk otomatis dilewati.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {!p.running && (
                                    <div className="modal-footer">
                                        <button className="btn btn-primary" onClick={() => setImportProgress(null)}>Tutup</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })()}

                {/* Buat Paket Soal (empty package; questions come next) */}
                {createPackageModalOpen && (() => {
                    const chosen = matkulList.find(m => String(m.id) === String(newPkgForm.matkulId))
                    const chosenProdi = chosen?.prodi_id || chosen?.prodiId
                    const pkgKelasOptions = chosenProdi
                        ? kelasList.filter(k => String(k.prodi_id || k.prodiId) === String(chosenProdi))
                        : kelasList
                    return (
                        <div className="modal-overlay" onClick={() => setCreatePackageModalOpen(false)}>
                            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                                <div className="modal-header">
                                    <h3>Buat Paket Soal</h3>
                                    <button className="btn btn-icon btn-ghost" onClick={() => setCreatePackageModalOpen(false)}>
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="modal-body">
                                    <p className="form-hint" style={{ marginTop: 0, marginBottom: '1rem' }}>
                                        Pilih mata kuliah dan jenis ujian. Setelah itu Anda bisa langsung memakai Template Excel, Upload Excel, Bank Soal, atau menambah soal satu per satu.
                                    </p>
                                    <div className="form-group">
                                        <label className="form-label">Mata Kuliah</label>
                                        <select
                                            className="form-input"
                                            value={newPkgForm.matkulId}
                                            onChange={e => setNewPkgForm({ ...newPkgForm, matkulId: e.target.value, kelasIds: [] })}
                                        >
                                            {termMatkulList.length === 0 && <option value="">Tidak ada mata kuliah semester ini</option>}
                                            {termMatkulList.map(mk => (
                                                <option key={mk.id} value={mk.id}>{mk.kode ? `${mk.kode} - ` : ''}{mk.nama}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Jenis Ujian</label>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {['UTS', 'UAS'].map(t => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    className={`btn ${newPkgForm.examType === t ? 'btn-primary' : 'btn-outline'}`}
                                                    style={{ flex: 1 }}
                                                    onClick={() => setNewPkgForm({ ...newPkgForm, examType: t })}
                                                >
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {pkgKelasOptions.length > 0 && (
                                        <div className="form-group">
                                            <label className="form-label">Kelas (opsional)</label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                {pkgKelasOptions.map(k => {
                                                    const on = newPkgForm.kelasIds.includes(k.id)
                                                    return (
                                                        <button
                                                            key={k.id}
                                                            type="button"
                                                            className={`btn btn-sm ${on ? 'btn-primary' : 'btn-outline'}`}
                                                            onClick={() => setNewPkgForm({
                                                                ...newPkgForm,
                                                                kelasIds: on ? newPkgForm.kelasIds.filter(id => id !== k.id) : [...newPkgForm.kelasIds, k.id]
                                                            })}
                                                        >
                                                            {on && <CheckCircle size={14} />}
                                                            {k.nama}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                            <span className="form-hint">Soal yang ditambahkan ke paket ini otomatis memakai kelas yang dipilih.</span>
                                        </div>
                                    )}
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-ghost" onClick={() => setCreatePackageModalOpen(false)}>Batal</button>
                                    <button className="btn btn-primary" onClick={handleCreatePackage} disabled={!newPkgForm.matkulId}>
                                        <ArrowRight size={16} />
                                        Lanjut ke Paket Soal
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                })()}

                {/* Edit Mata Kuliah: move a whole package */}
                {editMatkulPkg && (
                    <div className="modal-overlay" onClick={() => !editMatkulSaving && setEditMatkulPkg(null)}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                            <div className="modal-header">
                                <h3>Edit Mata Kuliah Paket</h3>
                                <button className="btn btn-icon btn-ghost" onClick={() => setEditMatkulPkg(null)} disabled={editMatkulSaving}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body">
                                <p className="form-hint" style={{ marginTop: 0, marginBottom: '1rem' }}>
                                    Semua <strong>{editMatkulPkg.questions.length} soal</strong> di paket <strong>{getMatkulName(editMatkulPkg.matkulId)} - {editMatkulPkg.examType}</strong> akan dipindahkan ke mata kuliah / jenis ujian di bawah. Isi soal, bobot, dan kunci jawaban tidak berubah.
                                </p>
                                <div className="form-group">
                                    <label className="form-label">Pindahkan ke Mata Kuliah</label>
                                    <select
                                        className="form-input"
                                        value={editMatkulTarget.matkulId}
                                        onChange={e => setEditMatkulTarget({ ...editMatkulTarget, matkulId: e.target.value })}
                                    >
                                        {filterMatkulByTerm(matkulList, tahunAkademik, [editMatkulPkg.matkulId]).map(mk => (
                                            <option key={mk.id} value={mk.id}>
                                                {mk.kode ? `${mk.kode} - ` : ''}{mk.nama}{String(mk.id) === String(editMatkulPkg.matkulId) ? ' (saat ini)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Jenis Ujian</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {['UTS', 'UAS'].map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                className={`btn ${editMatkulTarget.examType === t ? 'btn-primary' : 'btn-outline'}`}
                                                style={{ flex: 1 }}
                                                onClick={() => setEditMatkulTarget({ ...editMatkulTarget, examType: t })}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-ghost" onClick={() => setEditMatkulPkg(null)} disabled={editMatkulSaving}>Batal</button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSaveEditMatkul}
                                    disabled={editMatkulSaving || (String(editMatkulTarget.matkulId) === String(editMatkulPkg.matkulId) && editMatkulTarget.examType === editMatkulPkg.examType)}
                                >
                                    {editMatkulSaving ? <><Loader2 size={16} className="spin" /> Memindahkan...</> : <><Save size={16} /> Simpan</>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Kelas Modal */}
                {editKelasModal && editKelasPackage && (
                    <div className="modal-overlay" onClick={() => { setEditKelasModal(false); setEditKelasPackage(null) }}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                            <div className="modal-header">
                                <h3>Edit Kelas - {getMatkulName(editKelasPackage.matkulId)} ({editKelasPackage.examType})</h3>
                                <button className="btn btn-icon btn-ghost" onClick={() => { setEditKelasModal(false); setEditKelasPackage(null) }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body">
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                                    Pilih kelas yang akan di-assign untuk {editKelasPackage.questions.length} soal dalam paket ini.
                                    Perubahan akan diterapkan ke semua soal sekaligus.
                                </p>
                                <div className="form-group">
                                    <label className="form-label">Distribusi ke Kelas</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        {kelasList.map(k => {
                                            const isSelected = editKelasIds.includes(k.id)
                                            return (
                                                <button
                                                    key={k.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setEditKelasIds(editKelasIds.filter(id => id !== k.id))
                                                        } else {
                                                            setEditKelasIds([...editKelasIds, k.id])
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '8px 16px',
                                                        borderRadius: '8px',
                                                        border: isSelected ? '2px solid var(--primary)' : '2px solid var(--border-color)',
                                                        background: isSelected ? 'var(--primary-50)' : 'var(--bg-secondary)',
                                                        color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                                                        fontWeight: isSelected ? '600' : '400',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        fontSize: '0.85rem'
                                                    }}
                                                >
                                                    {isSelected && <CheckCircle size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
                                                    {k.nama}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => setEditKelasIds(kelasList.map(k => k.id))}
                                        >
                                            Pilih Semua
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => setEditKelasIds([])}
                                        >
                                            Hapus Semua
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-ghost" onClick={() => { setEditKelasModal(false); setEditKelasPackage(null) }}>Batal</button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSaveEditKelas}
                                    disabled={editKelasLoading}
                                >
                                    {editKelasLoading ? (
                                        <><Loader2 size={16} className="spin" /> Menyimpan...</>
                                    ) : (
                                        <><Save size={16} /> Simpan Perubahan</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

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
                .cluster-group {
                    border: 2px solid var(--warning-200);
                    border-radius: var(--radius-xl);
                    overflow: hidden;
                    background: var(--warning-50);
                }
                .cluster-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--space-3) var(--space-4);
                    background: var(--warning-100);
                    border-bottom: 1px solid var(--warning-200);
                }
                .cluster-info {
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                }
                .cluster-label {
                    font-weight: var(--font-semibold);
                    font-size: var(--font-size-sm);
                    color: var(--warning-800);
                }
                .cluster-variants {
                    padding: var(--space-3);
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3);
                }
                .cluster-variants .question-card {
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
                .bank-soal-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3);
                }
                .bank-soal-item {
                    display: flex;
                    gap: var(--space-3);
                    padding: var(--space-3);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-lg);
                    border: 2px solid var(--border-color);
                    cursor: pointer;
                    transition: all var(--transition-fast);
                }
                .bank-soal-item:hover {
                    border-color: var(--primary-300);
                }
                .bank-soal-item.selected {
                    border-color: var(--primary-500);
                    background: var(--primary-50);
                }
                .bank-soal-check {
                    flex-shrink: 0;
                    color: var(--text-muted);
                }
                .bank-soal-item.selected .bank-soal-check {
                    color: var(--primary-600);
                }
                .bank-soal-content {
                    flex: 1;
                    min-width: 0;
                }
                .bank-soal-content p {
                    font-size: var(--font-size-sm);
                    margin-bottom: var(--space-2);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                }
                .bank-soal-meta {
                    display: flex;
                    gap: var(--space-2);
                    flex-wrap: wrap;
                    align-items: center;
                    font-size: var(--font-size-xs);
                }
                .bank-soal-filters {
                    margin-bottom: var(--space-4);
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
                .essay-option-toggle {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.65rem;
                    padding: 0.75rem 0.9rem;
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    background: var(--bg-tertiary);
                    cursor: pointer;
                }
                .essay-option-toggle input {
                    width: 18px;
                    height: 18px;
                    margin-top: 2px;
                    flex-shrink: 0;
                    accent-color: var(--primary-600);
                }
                .essay-option-toggle span {
                    display: flex;
                    flex-direction: column;
                    gap: 0.2rem;
                    font-size: 0.9rem;
                }
                .essay-option-toggle small {
                    color: var(--text-muted);
                    font-size: 0.78rem;
                    line-height: 1.4;
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
                    
                }
            `}</style>
        </DashboardLayout>
    )
}

export default BuatSoalPage
