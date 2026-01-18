import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useConfirm } from '../../components/ConfirmDialog'
import {
    BookOpen,
    Plus,
    Search,
    Filter,
    Edit2,
    Trash2,
    Copy,
    Eye,
    ChevronLeft,
    ChevronRight,
    X,
    Save,
    Tag,
    CheckCircle,
    Circle,
    HelpCircle,
    FileText
} from 'lucide-react'
import '../admin/Dashboard.css'

// LocalStorage keys
const SOAL_KEY = 'cat_soal_data'
const PRODI_KEY = 'cat_prodi_data'
const MATKUL_KEY = 'cat_matkul_data'

function QuestionModal({ isOpen, onClose, question, onSave, categories }) {
    const [formData, setFormData] = useState(question || {
        text: '',
        type: 'pilihan_ganda',
        category: categories[0] || '',
        difficulty: 'sedang',
        points: 10,
        options: ['', '', '', ''],
        correctAnswer: 0
    })

    const handleOptionChange = (index, value) => {
        const newOptions = [...formData.options]
        newOptions[index] = value
        setFormData({ ...formData, options: newOptions })
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
                    <div className="modal-body">
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

                        <div className="form-row form-row-3">
                            <div className="form-group">
                                <label className="form-label">Tipe Soal</label>
                                <select
                                    className="form-input"
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                >
                                    <option value="pilihan_ganda">Pilihan Ganda</option>
                                    <option value="essay">Essay</option>
                                    <option value="benar_salah">Benar/Salah</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Kategori</label>
                                <select
                                    className="form-input"
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                >
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tingkat Kesulitan</label>
                                <select
                                    className="form-input"
                                    value={formData.difficulty}
                                    onChange={e => setFormData({ ...formData, difficulty: e.target.value })}
                                >
                                    <option value="mudah">Mudah</option>
                                    <option value="sedang">Sedang</option>
                                    <option value="sulit">Sulit</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Bobot Nilai</label>
                            <input
                                type="number"
                                className="form-input"
                                value={formData.points}
                                onChange={e => setFormData({ ...formData, points: parseInt(e.target.value) })}
                                min={1}
                                max={100}
                                style={{ width: '120px' }}
                            />
                        </div>

                        {formData.type === 'pilihan_ganda' && (
                            <div className="form-group">
                                <label className="form-label">Pilihan Jawaban</label>
                                <div className="options-list">
                                    {formData.options.map((opt, index) => (
                                        <div key={index} className="option-row">
                                            <button
                                                type="button"
                                                className={`option-radio ${formData.correctAnswer === index ? 'selected' : ''}`}
                                                onClick={() => setFormData({ ...formData, correctAnswer: index })}
                                            >
                                                {formData.correctAnswer === index ? <CheckCircle size={18} /> : <Circle size={18} />}
                                            </button>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={opt}
                                                onChange={e => handleOptionChange(index, e.target.value)}
                                                placeholder={`Pilihan ${String.fromCharCode(65 + index)}`}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <p className="form-hint">Klik lingkaran untuk menandai jawaban benar</p>
                            </div>
                        )}

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

function BankSoalPage() {
    const { showConfirm } = useConfirm()
    const [questions, setQuestions] = useState([])
    const [prodiList, setProdiList] = useState([])
    const [matkulList, setMatkulList] = useState([])
    const [categories, setCategories] = useState([])
    const [isInitialized, setIsInitialized] = useState(false)
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [typeFilter, setTypeFilter] = useState('all')
    const [examTypeFilter, setExamTypeFilter] = useState('all') // UTS/UAS
    const [prodiFilter, setProdiFilter] = useState('all')
    const [currentPage, setCurrentPage] = useState(1)
    const [modalOpen, setModalOpen] = useState(false)
    const [editingQuestion, setEditingQuestion] = useState(null)
    const [previewQuestion, setPreviewQuestion] = useState(null)
    const itemsPerPage = 5

    // Load data from localStorage
    useEffect(() => {
        const soalData = localStorage.getItem(SOAL_KEY)
        const prodiData = localStorage.getItem(PRODI_KEY)
        const matkulData = localStorage.getItem(MATKUL_KEY)

        if (soalData) {
            const allSoal = JSON.parse(soalData)
            setQuestions(allSoal)
            // Extract unique categories
            const cats = [...new Set(allSoal.map(s => s.category).filter(Boolean))]
            setCategories(cats)
        }
        if (prodiData) setProdiList(JSON.parse(prodiData))
        if (matkulData) setMatkulList(JSON.parse(matkulData))
        setIsInitialized(true)
    }, [])

    // Save to localStorage when questions change (only after initialized)
    useEffect(() => {
        if (isInitialized) {
            localStorage.setItem(SOAL_KEY, JSON.stringify(questions))
        }
    }, [questions, isInitialized])

    // Type icons
    const typeIcons = {
        pilihan_ganda: HelpCircle,
        essay: FileText,
        benar_salah: CheckCircle
    }

    const typeLabels = {
        pilihan_ganda: 'Pilihan Ganda',
        essay: 'Essay',
        benar_salah: 'Benar/Salah'
    }

    // Filter questions
    const filteredQuestions = questions.filter(q => {
        const matchesSearch = q.text.toLowerCase().includes(search.toLowerCase())
        const matchesCategory = categoryFilter === 'all' || q.category === categoryFilter
        const matchesType = typeFilter === 'all' || q.type === typeFilter
        const matchesExamType = examTypeFilter === 'all' || q.examType === examTypeFilter
        const matchesProdi = prodiFilter === 'all' || q.prodiId === prodiFilter
        return matchesSearch && matchesCategory && matchesType && matchesExamType && matchesProdi
    })

    // Pagination
    const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage)
    const paginatedQuestions = filteredQuestions.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    const handleAddQuestion = () => {
        setEditingQuestion(null)
        setModalOpen(true)
    }

    const handleEditQuestion = (question) => {
        setEditingQuestion(question)
        setModalOpen(true)
    }

    const handleSaveQuestion = (data) => {
        if (editingQuestion) {
            setQuestions(questions.map(q => q.id === editingQuestion.id ? { ...data, id: editingQuestion.id } : q))
        } else {
            setQuestions([...questions, { ...data, id: Date.now(), createdAt: new Date().toISOString().split('T')[0] }])
        }
    }

    const handleDeleteQuestion = (id) => {
        showConfirm({
            title: 'Konfirmasi Hapus',
            message: 'Apakah Anda yakin ingin menghapus soal ini?',
            onConfirm: () => setQuestions(questions.filter(q => q.id !== id))
        })
    }

    const stats = {
        total: questions.length,
        pilihan_ganda: questions.filter(q => q.type === 'pilihan_ganda').length,
        essay: questions.filter(q => q.type === 'essay').length,
        benar_salah: questions.filter(q => q.type === 'benar_salah').length
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Bank Soal</h1>
                        <p className="page-subtitle">Kelola koleksi soal untuk ujian</p>
                    </div>
                    <button className="btn btn-primary" onClick={handleAddQuestion}>
                        <Plus size={18} />
                        Tambah Soal
                    </button>
                </div>

                {/* Stats */}
                <div className="mini-stats">
                    <div className="mini-stat">
                        <span className="mini-stat-value">{stats.total}</span>
                        <span className="mini-stat-label">Total Soal</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">{stats.pilihan_ganda}</span>
                        <span className="mini-stat-label">Pilihan Ganda</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">{stats.essay}</span>
                        <span className="mini-stat-label">Essay</span>
                    </div>
                    <div className="mini-stat">
                        <span className="mini-stat-value">{stats.benar_salah}</span>
                        <span className="mini-stat-label">Benar/Salah</span>
                    </div>
                </div>

                {/* Filters & Table */}
                <div className="card">
                    <div className="card-body">
                        <div className="filters-row">
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
                            <div className="filter-group">
                                <Tag size={16} />
                                <select
                                    className="form-input"
                                    value={categoryFilter}
                                    onChange={e => setCategoryFilter(e.target.value)}
                                >
                                    <option value="all">Semua Kategori</option>
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="filter-group">
                                <Filter size={16} />
                                <select
                                    className="form-input"
                                    value={typeFilter}
                                    onChange={e => setTypeFilter(e.target.value)}
                                >
                                    <option value="all">Semua Tipe</option>
                                    <option value="pilihan_ganda">Pilihan Ganda</option>
                                    <option value="essay">Essay</option>
                                    <option value="benar_salah">Benar/Salah</option>
                                </select>
                            </div>
                            <div className="filter-group">
                                <select
                                    className="form-input exam-type-select"
                                    value={examTypeFilter}
                                    onChange={e => setExamTypeFilter(e.target.value)}
                                >
                                    <option value="all">Semua Ujian</option>
                                    <option value="uts">UTS</option>
                                    <option value="uas">UAS</option>
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
                                        <option key={p.id} value={p.id}>{p.kode}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Questions List */}
                        <div className="questions-list">
                            {paginatedQuestions.map((question, index) => {
                                const TypeIcon = typeIcons[question.type]
                                return (
                                    <div key={question.id} className="question-card">
                                        <div className="question-header">
                                            <div className="question-meta">
                                                <span className="question-number">#{(currentPage - 1) * itemsPerPage + index + 1}</span>
                                                <span className={`badge badge-${question.type === 'pilihan_ganda' ? 'primary' :
                                                    question.type === 'essay' ? 'accent' : 'success'
                                                    }`}>
                                                    <TypeIcon size={12} />
                                                    {typeLabels[question.type]}
                                                </span>
                                                <span className="badge badge-info">{question.category}</span>
                                                <span className={`badge badge-${question.difficulty === 'mudah' ? 'success' :
                                                    question.difficulty === 'sedang' ? 'warning' : 'error'
                                                    }`}>
                                                    {question.difficulty}
                                                </span>
                                            </div>
                                            <span className="question-points">{question.points} poin</span>
                                        </div>
                                        <p className="question-text">{question.text}</p>
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
                                            <button className="btn btn-ghost btn-sm">
                                                <Copy size={16} />
                                                Duplikat
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
                            })}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="pagination">
                                <span className="pagination-info">
                                    Menampilkan {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredQuestions.length)} dari {filteredQuestions.length}
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
                        )}
                    </div>
                </div>

                <QuestionModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    question={editingQuestion}
                    onSave={handleSaveQuestion}
                    categories={categories}
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
                                        previewQuestion.type === 'essay' ? 'accent' : 'success'
                                        }`}>
                                        {typeLabels[previewQuestion.type]}
                                    </span>
                                    <span className="badge badge-info">{previewQuestion.category}</span>
                                    <span>{previewQuestion.points} poin</span>
                                </div>
                                <p className="preview-question">{previewQuestion.text}</p>

                                {previewQuestion.type === 'pilihan_ganda' && previewQuestion.options && (
                                    <div className="preview-options">
                                        {previewQuestion.options.map((opt, i) => (
                                            <div
                                                key={i}
                                                className={`preview-option ${i === previewQuestion.correctAnswer ? 'correct' : ''}`}
                                            >
                                                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                                                <span>{opt}</span>
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

                                {previewQuestion.type === 'essay' && (
                                    <div className="preview-essay-hint">
                                        <FileText size={20} />
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
        
        .question-actions {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }
        
        .question-actions .btn {
          font-size: var(--font-size-xs);
        }
        
        .text-error {
          color: var(--error-500) !important;
        }
        
        .badge svg {
          margin-right: var(--space-1);
        }
        
        /* Modal Large */
        .modal-lg {
          max-width: 700px;
        }
        
        .form-textarea {
          resize: vertical;
          min-height: 80px;
        }
        
        .form-row-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-4);
        }
        
        @media (max-width: 768px) {
          .form-row-3 {
            grid-template-columns: 1fr;
          }
        }
        
        .form-hint {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
          margin-top: var(--space-2);
        }
        
        .options-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        
        .option-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
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
        }
        
        .option-radio:hover {
          background: var(--primary-50);
          color: var(--primary-600);
        }
        
        .option-radio.selected {
          background: var(--success-500);
          color: white;
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
        
        /* Preview */
        .preview-meta {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
          flex-wrap: wrap;
        }
        
        .preview-question {
          font-size: var(--font-size-lg);
          font-weight: var(--font-medium);
          color: var(--text-primary);
          margin-bottom: var(--space-5);
          line-height: 1.6;
        }
        
        .preview-options {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        
        .preview-option {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: var(--bg-tertiary);
          border-radius: var(--radius-lg);
          border: 2px solid transparent;
        }
        
        .preview-option.correct {
          background: var(--success-50);
          border-color: var(--success-500);
          color: var(--success-700);
        }
        
        .option-letter {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: var(--bg-secondary);
          border-radius: var(--radius-full);
          font-weight: var(--font-semibold);
          font-size: var(--font-size-sm);
        }
        
        .preview-option.correct .option-letter {
          background: var(--success-500);
          color: white;
        }
        
        .preview-essay-hint {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-4);
          background: var(--bg-tertiary);
          border-radius: var(--radius-lg);
          color: var(--text-secondary);
        }
        
        .pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: var(--space-5);
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
        
        [data-theme="dark"] .question-points {
          background: rgba(0, 168, 168, 0.15);
        }
        
        [data-theme="dark"] .preview-option.correct {
          background: rgba(16, 185, 129, 0.15);
        }
      `}</style>
        </DashboardLayout>
    )
}

export default BankSoalPage
