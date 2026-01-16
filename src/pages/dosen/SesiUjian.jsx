import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useConfirm } from '../../components/ConfirmDialog'
import {
  FileText,
  Plus,
  Search,
  Calendar,
  Clock,
  Users,
  Settings,
  Play,
  Pause,
  Eye,
  Edit2,
  Trash2,
  Copy,
  ChevronRight,
  X,
  Save,
  BookOpen
} from 'lucide-react'
import '../admin/Dashboard.css'

// LocalStorage keys
const JADWAL_KEY = 'cat_jadwal_data'
const SOAL_KEY = 'cat_soal_data'
const MATKUL_KEY = 'cat_matkul_data'
const USERS_KEY = 'cat_users'

function ExamModal({ isOpen, onClose, exam, onSave, availableQuestions = [] }) {
  const [formData, setFormData] = useState(exam || {
    name: '',
    description: '',
    date: '',
    startTime: '09:00',
    duration: 60,
    shuffleQuestions: true,
    shuffleOptions: true,
    showResult: true
  })
  const [selectedQuestions, setSelectedQuestions] = useState([])

  const toggleQuestion = (q) => {
    if (selectedQuestions.find(sq => sq.id === q.id)) {
      setSelectedQuestions(selectedQuestions.filter(sq => sq.id !== q.id))
    } else {
      setSelectedQuestions([...selectedQuestions, q])
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      ...formData,
      totalQuestions: selectedQuestions.length,
      totalPoints: selectedQuestions.reduce((sum, q) => sum + q.points, 0)
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{exam ? 'Edit Sesi Ujian' : 'Buat Sesi Ujian Baru'}</h3>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-section">
              <h4 className="form-section-title">Informasi Ujian</h4>
              <div className="form-group">
                <label className="form-label">Nama Ujian</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: UTS Navigasi Sungai 2026"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Deskripsi</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Deskripsi singkat tentang ujian..."
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tanggal</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Waktu Mulai</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formData.startTime}
                    onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Durasi (menit)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.duration}
                    onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                    min={5}
                    max={300}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h4 className="form-section-title">Pengaturan</h4>
              <div className="settings-grid">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.shuffleQuestions}
                    onChange={e => setFormData({ ...formData, shuffleQuestions: e.target.checked })}
                  />
                  <span>Acak urutan soal</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.shuffleOptions}
                    onChange={e => setFormData({ ...formData, shuffleOptions: e.target.checked })}
                  />
                  <span>Acak pilihan jawaban</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.showResult}
                    onChange={e => setFormData({ ...formData, showResult: e.target.checked })}
                  />
                  <span>Tampilkan hasil setelah selesai</span>
                </label>
              </div>
            </div>

            <div className="form-section">
              <h4 className="form-section-title">Pilih Soal ({selectedQuestions.length} dipilih)</h4>
              <div className="question-selector">
                {availableQuestions.map(q => (
                  <div
                    key={q.id}
                    className={`question-select-item ${selectedQuestions.find(sq => sq.id === q.id) ? 'selected' : ''}`}
                    onClick={() => toggleQuestion(q)}
                  >
                    <div className="question-select-checkbox">
                      {selectedQuestions.find(sq => sq.id === q.id) ? '✓' : ''}
                    </div>
                    <div className="question-select-content">
                      <p className="question-select-text">{q.text}</p>
                      <div className="question-select-meta">
                        <span className="badge badge-sm badge-primary">{q.type.replace('_', ' ')}</span>
                        <span className="badge badge-sm badge-info">{q.category}</span>
                        <span>{q.points} poin</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {selectedQuestions.length > 0 && (
                <div className="selected-summary">
                  Total: {selectedQuestions.length} soal, {selectedQuestions.reduce((sum, q) => sum + q.points, 0)} poin
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary">
              <Save size={16} />
              {exam ? 'Simpan Perubahan' : 'Buat Ujian'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SesiUjianPage() {
  const { showConfirm } = useConfirm()
  const [exams, setExams] = useState([])
  const [availableQuestions, setAvailableQuestions] = useState([])
  const [matkulList, setMatkulList] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingExam, setEditingExam] = useState(null)

  // Load data from localStorage
  useEffect(() => {
    const jadwalData = localStorage.getItem(JADWAL_KEY)
    const soalData = localStorage.getItem(SOAL_KEY)
    const matkulData = localStorage.getItem(MATKUL_KEY)

    if (jadwalData) {
      const jadwals = JSON.parse(jadwalData)
      const matkuls = matkulData ? JSON.parse(matkulData) : []

      // Convert jadwal to exam format
      const examList = jadwals.map(j => {
        const matkul = matkuls.find(m => m.id === j.matkulId)
        return {
          id: j.id,
          name: `${j.tipeUjian} ${matkul?.nama || 'Ujian'}`,
          description: `Ujian ${j.tipeUjian} - ${matkul?.nama || ''}`,
          date: j.tanggal,
          startTime: j.waktuMulai,
          duration: Math.round((new Date(`2000-01-01T${j.waktuSelesai}`) - new Date(`2000-01-01T${j.waktuMulai}`)) / 60000),
          status: getExamStatus(j),
          totalQuestions: 0,
          participants: 0,
          totalPoints: 0
        }
      })
      setExams(examList)
    }

    if (soalData) {
      setAvailableQuestions(JSON.parse(soalData))
    }

    if (matkulData) {
      setMatkulList(JSON.parse(matkulData))
    }
  }, [])

  // Helper to determine exam status
  function getExamStatus(jadwal) {
    const now = new Date()
    const examDate = new Date(`${jadwal.tanggal}T${jadwal.waktuMulai}`)
    const endDate = new Date(`${jadwal.tanggal}T${jadwal.waktuSelesai}`)

    if (now < examDate) return 'scheduled'
    if (now >= examDate && now <= endDate) return 'active'
    return 'completed'
  }

  const statusColors = {
    draft: 'warning',
    scheduled: 'primary',
    active: 'success',
    completed: 'info'
  }

  const statusLabels = {
    draft: 'Draft',
    scheduled: 'Terjadwal',
    active: 'Berlangsung',
    completed: 'Selesai'
  }

  // Filter exams
  const filteredExams = exams.filter(exam => {
    const matchesSearch = exam.name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || exam.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleAddExam = () => {
    setEditingExam(null)
    setModalOpen(true)
  }

  const handleEditExam = (exam) => {
    setEditingExam(exam)
    setModalOpen(true)
  }

  const handleSaveExam = (data) => {
    if (editingExam) {
      setExams(exams.map(e => e.id === editingExam.id ? { ...data, id: editingExam.id, status: editingExam.status, participants: editingExam.participants } : e))
    } else {
      setExams([...exams, { ...data, id: Date.now(), status: 'draft', participants: 0 }])
    }
  }

  const handleDeleteExam = (id) => {
    showConfirm({
      title: 'Konfirmasi Hapus',
      message: 'Apakah Anda yakin ingin menghapus ujian ini?',
      onConfirm: () => setExams(exams.filter(e => e.id !== id))
    })
  }

  const handleToggleStatus = (id) => {
    setExams(exams.map(e => {
      if (e.id !== id) return e
      const nextStatus = {
        draft: 'scheduled',
        scheduled: 'active',
        active: 'completed'
      }
      return { ...e, status: nextStatus[e.status] || e.status }
    }))
  }

  return (
    <DashboardLayout>
      <div className="dashboard-page animate-fadeIn">
        <div className="page-header">
          <div>
            <h1 className="page-title">Sesi Ujian</h1>
            <p className="page-subtitle">Kelola jadwal dan sesi ujian</p>
          </div>
          <button className="btn btn-primary" onClick={handleAddExam}>
            <Plus size={18} />
            Buat Ujian
          </button>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="card-body">
            <div className="filters-row">
              <div className="search-box">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Cari ujian..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="filter-tabs">
                {['all', 'draft', 'scheduled', 'active', 'completed'].map(status => (
                  <button
                    key={status}
                    className={`filter-tab ${statusFilter === status ? 'active' : ''}`}
                    onClick={() => setStatusFilter(status)}
                  >
                    {status === 'all' ? 'Semua' : statusLabels[status]}
                    <span className="filter-tab-count">
                      {status === 'all' ? exams.length : exams.filter(e => e.status === status).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Exam Cards */}
            <div className="exam-cards-grid">
              {filteredExams.map(exam => (
                <div key={exam.id} className="exam-card-item">
                  <div className="exam-card-header">
                    <span className={`badge badge-${statusColors[exam.status]}`}>
                      {statusLabels[exam.status]}
                    </span>
                    <div className="exam-card-actions">
                      <button
                        className="btn btn-icon btn-ghost btn-sm"
                        onClick={() => handleEditExam(exam)}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="btn btn-icon btn-ghost btn-sm text-error"
                        onClick={() => handleDeleteExam(exam.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <h3 className="exam-card-title">{exam.name}</h3>
                  <p className="exam-card-desc">{exam.description}</p>

                  <div className="exam-card-info">
                    <div className="exam-info-item">
                      <Calendar size={14} />
                      <span>{exam.date}</span>
                    </div>
                    <div className="exam-info-item">
                      <Clock size={14} />
                      <span>{exam.startTime} ({exam.duration} menit)</span>
                    </div>
                    <div className="exam-info-item">
                      <BookOpen size={14} />
                      <span>{exam.totalQuestions} soal</span>
                    </div>
                    <div className="exam-info-item">
                      <Users size={14} />
                      <span>{exam.participants} peserta</span>
                    </div>
                  </div>

                  <div className="exam-card-footer">
                    {exam.status === 'draft' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleToggleStatus(exam.id)}
                      >
                        <Play size={14} />
                        Jadwalkan
                      </button>
                    )}
                    {exam.status === 'scheduled' && (
                      <button
                        className="btn btn-accent btn-sm"
                        onClick={() => handleToggleStatus(exam.id)}
                      >
                        <Play size={14} />
                        Mulai Ujian
                      </button>
                    )}
                    {exam.status === 'active' && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleToggleStatus(exam.id)}
                      >
                        <Pause size={14} />
                        Akhiri Ujian
                      </button>
                    )}
                    {exam.status === 'completed' && (
                      <button className="btn btn-outline btn-sm">
                        <Eye size={14} />
                        Lihat Hasil
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm">
                      <Settings size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredExams.length === 0 && (
              <div className="empty-state">
                <FileText size={48} />
                <h3>Tidak ada ujian</h3>
                <p>Buat ujian baru untuk memulai</p>
              </div>
            )}
          </div>
        </div>

        <ExamModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          exam={editingExam}
          onSave={handleSaveExam}
          availableQuestions={availableQuestions}
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
        
        .filters-row {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }
        
        .search-box {
          position: relative;
          max-width: 400px;
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
        
        .filter-tabs {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }
        
        .filter-tab {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-full);
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        
        .filter-tab:hover {
          border-color: var(--primary-400);
          color: var(--primary-600);
        }
        
        .filter-tab.active {
          background: var(--primary-600);
          border-color: var(--primary-600);
          color: white;
        }
        
        .filter-tab-count {
          background: rgba(255,255,255,0.2);
          padding: 2px 8px;
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
        }
        
        .filter-tab:not(.active) .filter-tab-count {
          background: var(--bg-secondary);
        }
        
        .exam-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: var(--space-5);
        }
        
        .exam-card-item {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: var(--space-5);
          transition: all var(--transition-normal);
        }
        
        .exam-card-item:hover {
          border-color: var(--primary-400);
          box-shadow: var(--shadow-lg);
          transform: translateY(-2px);
        }
        
        .exam-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-3);
        }
        
        .exam-card-actions {
          display: flex;
          gap: var(--space-1);
        }
        
        .exam-card-title {
          font-size: var(--font-size-lg);
          font-weight: var(--font-semibold);
          color: var(--text-primary);
          margin-bottom: var(--space-2);
        }
        
        .exam-card-desc {
          font-size: var(--font-size-sm);
          color: var(--text-muted);
          margin-bottom: var(--space-4);
          line-height: 1.5;
        }
        
        .exam-card-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-2);
          margin-bottom: var(--space-4);
        }
        
        .exam-info-item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
        }
        
        .exam-card-footer {
          display: flex;
          gap: var(--space-2);
          padding-top: var(--space-4);
          border-top: 1px solid var(--border-color);
        }
        
        .text-error {
          color: var(--error-500) !important;
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
          font-size: var(--font-size-lg);
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
          margin-bottom: var(--space-2);
        }
        
        /* Modal XL */
        .modal-xl {
          max-width: 800px;
        }
        
        .form-section {
          margin-bottom: var(--space-6);
        }
        
        .form-section:last-child {
          margin-bottom: 0;
        }
        
        .form-section-title {
          font-size: var(--font-size-sm);
          font-weight: var(--font-semibold);
          color: var(--text-secondary);
          margin-bottom: var(--space-4);
          padding-bottom: var(--space-2);
          border-bottom: 1px solid var(--border-color);
        }
        
        .form-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-4);
        }
        
        @media (max-width: 640px) {
          .form-row {
            grid-template-columns: 1fr;
          }
        }
        
        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: var(--space-3);
        }
        
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          cursor: pointer;
          font-size: var(--font-size-sm);
        }
        
        .checkbox-label input {
          width: 18px;
          height: 18px;
          accent-color: var(--primary-600);
        }
        
        .question-selector {
          max-height: 300px;
          overflow-y: auto;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
        }
        
        .question-select-item {
          display: flex;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
          transition: background var(--transition-fast);
        }
        
        .question-select-item:last-child {
          border-bottom: none;
        }
        
        .question-select-item:hover {
          background: var(--bg-tertiary);
        }
        
        .question-select-item.selected {
          background: var(--primary-50);
        }
        
        [data-theme="dark"] .question-select-item.selected {
          background: rgba(59, 103, 159, 0.15);
        }
        
        .question-select-checkbox {
          width: 24px;
          height: 24px;
          border: 2px solid var(--border-color);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: var(--font-size-sm);
          font-weight: var(--font-bold);
          color: var(--primary-600);
        }
        
        .question-select-item.selected .question-select-checkbox {
          background: var(--primary-600);
          border-color: var(--primary-600);
          color: white;
        }
        
        .question-select-content {
          flex: 1;
          min-width: 0;
        }
        
        .question-select-text {
          font-size: var(--font-size-sm);
          color: var(--text-primary);
          margin-bottom: var(--space-2);
        }
        
        .question-select-meta {
          display: flex;
          gap: var(--space-2);
          align-items: center;
          flex-wrap: wrap;
        }
        
        .question-select-meta span:last-child {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
        }
        
        .badge-sm {
          font-size: 10px;
          padding: 2px 6px;
        }
        
        .selected-summary {
          margin-top: var(--space-3);
          padding: var(--space-3);
          background: var(--accent-50);
          border-radius: var(--radius-lg);
          font-size: var(--font-size-sm);
          font-weight: var(--font-medium);
          color: var(--accent-700);
          text-align: center;
        }
        
        [data-theme="dark"] .selected-summary {
          background: rgba(0, 168, 168, 0.15);
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
          position: sticky;
          top: 0;
          background: var(--bg-secondary);
          z-index: 1;
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
          position: sticky;
          bottom: 0;
        }
      `}</style>
    </DashboardLayout>
  )
}

export default SesiUjianPage
