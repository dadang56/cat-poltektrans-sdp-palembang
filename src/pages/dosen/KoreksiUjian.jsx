import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../App'
import { hasilUjianService, jawabanMahasiswaService, soalService, jadwalService, matkulService, isSupabaseConfigured } from '../../services/supabaseService'
import { supabase } from '../../lib/supabase'
import {
    CheckSquare,
    Clock,
    Users,
    AlertTriangle,
    CheckCircle,
    X,
    Save,
    ChevronRight,
    Edit2,
    Eye,
    FileText,
    RefreshCw,
    Trash2,
    AlertCircle,
    Sparkles,
    ExternalLink,
    Copy,
    ClipboardPaste
} from 'lucide-react'
import '../admin/Dashboard.css'
import { useSettings } from '../../contexts/SettingsContext'
import { toPercentScore } from '../../utils/gradeUtils'
import { getActiveAcademicYear } from '../../utils/academicYear'
import { toast, errorMessage } from '../../components/Toast'
import { AI_CHATS, buildGradingPrompt, buildBulkGradingPrompt, openAiChat, copyText } from '../../utils/aiGradingPrompt'
import { useConfirm } from '../../components/ConfirmDialog'

// Data kosong - akan diisi dari data nyata
const EXAMS_TO_CORRECT = []
const STUDENT_ANSWERS = []
const QUESTIONS = []

function CorrectionModal({ isOpen, onClose, student, questions, onSave, onSaveNext, position, total }) {
    const [answers, setAnswers] = useState(student?.answers || [])
    const [saving, setSaving] = useState(false)
    const bodyRef = useRef(null)

    // ---- Tempel hasil AI: read "Soal 1: Skor 30/50" lines into the scores ----
    const [pasteOpen, setPasteOpen] = useState(false)
    const [pasteText, setPasteText] = useState('')

    // ---- Tanya AI (opens ChatGPT / Claude / Gemini with a grading prompt) ----
    const [openPrompt, setOpenPrompt] = useState(null) // originalIndex whose prompt is shown, or 'all'

    const promptFor = (answer) => {
        const question = questions.find(q => String(q.id) === String(answer.questionId))
        return buildGradingPrompt({
            question: question?.pertanyaan || question?.text || '',
            answerGuide: question?.pedoman_jawaban || '',
            maxPoints: answer.maxPoints,
            studentAnswer: typeof answer.answer === 'string' ? answer.answer : String(answer.answer ?? '')
        })
    }

    // All essay answers of this student in one prompt
    const allEssayPrompt = () => buildBulkGradingPrompt({
        items: answers
            .filter(a => a.type === 'essay' || a.type === 'uraian')
            .map(a => {
                const question = questions.find(q => String(q.id) === String(a.questionId))
                return {
                    question: question?.pertanyaan || question?.text || '',
                    answerGuide: question?.pedoman_jawaban || '',
                    maxPoints: a.maxPoints,
                    studentAnswer: typeof a.answer === 'string' ? a.answer : String(a.answer ?? '')
                }
            })
    })

    const askAiAll = async (chat) => {
        const { prefilled, copied } = await openAiChat(chat.id, allEssayPrompt())
        if (prefilled) {
            toast.info(`${chat.label} dibuka dengan prompt semua soal essay.${copied ? ' Prompt juga disalin.' : ''}`)
        } else if (copied) {
            toast.info(`${chat.label} dibuka. Prompt semua soal sudah disalin: tempel (Ctrl+V) di kolom chat lalu kirim.`)
        } else {
            setOpenPrompt('all')
            toast.warning(`${chat.label} dibuka, tetapi prompt gagal disalin otomatis. Salin dari kotak prompt di atas.`)
        }
    }

    const copyAllPrompt = async () => {
        const ok = await copyText(allEssayPrompt())
        if (ok) toast.success('Prompt semua soal essay disalin.')
        else {
            setOpenPrompt('all')
            toast.warning('Gagal menyalin otomatis. Salin manual dari kotak prompt.')
        }
    }

    const askAi = async (chat, answer) => {
        const { prefilled, copied } = await openAiChat(chat.id, promptFor(answer))
        if (prefilled) {
            toast.info(`${chat.label} dibuka di tab baru dengan prompt penilaian.${copied ? ' Prompt juga disalin.' : ''}`)
        } else if (copied) {
            toast.info(`${chat.label} dibuka. Prompt sudah disalin: tempel (Ctrl+V) di kolom chat lalu kirim.`)
        } else {
            setOpenPrompt(answer.originalIndex)
            toast.warning(`${chat.label} dibuka, tetapi prompt gagal disalin otomatis. Salin dari kotak prompt di bawah jawaban.`)
        }
    }

    const copyPrompt = async (answer) => {
        const ok = await copyText(promptFor(answer))
        if (ok) toast.success('Prompt penilaian disalin.')
        else {
            setOpenPrompt(answer.originalIndex)
            toast.warning('Gagal menyalin otomatis. Salin manual dari kotak prompt.')
        }
    }

    // Reset answers when student changes
    useEffect(() => {
        if (student?.answers) {
            setAnswers(student.answers)
        }
        setOpenPrompt(null)
        setPasteOpen(false)
        setPasteText('')
        if (bodyRef.current) bodyRef.current.scrollTop = 0
    }, [student])

    // Fills essay scores from an AI reply. Understands the bulk format
    // ("Soal 2: Skor 30/50") and, for a single essay, a plain "Skor: 30/50".
    const applyAiScores = (text) => {
        text = String(text || '').replace(/[*_#`]/g, '') // AI replies often use markdown bold
        const essays = answers
            .map((a, idx) => ({ ...a, originalIndex: idx }))
            .filter(a => a.type === 'essay' || a.type === 'uraian')
        const found = new Map()
        const numbered = /soal(?:\s+essay)?\s*(\d+)\s*[:.)\-–]?\s*(?:\r?\n\s*)?skor\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*\/\s*\d+/gi
        let m
        while ((m = numbered.exec(text))) found.set(Number(m[1]), m[2])
        if (found.size === 0 && essays.length === 1) {
            const single = /skor\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*\/\s*\d+/i.exec(text)
            if (single) found.set(1, single[1])
        }
        if (found.size === 0) {
            toast.warning('Tidak menemukan skor. Pastikan balasan AI berisi baris seperti "Soal 1: Skor 30/50".')
            return
        }
        const next = [...answers]
        let filled = 0
        found.forEach((value, no) => {
            const target = essays[no - 1]
            if (!target) return
            const max = next[target.originalIndex].maxPoints
            const score = Math.max(0, Math.min(Math.round(parseFloat(String(value).replace(',', '.'))), max))
            next[target.originalIndex] = { ...next[target.originalIndex], earnedPoints: score }
            filled++
        })
        if (filled === 0) {
            toast.warning('Nomor soal pada hasil AI tidak cocok dengan soal essay di sini.')
            return
        }
        setAnswers(next)
        toast.success(`${filled} nilai essay terisi dari hasil AI. Periksa lalu simpan.`)
        setPasteOpen(false)
        setPasteText('')
    }

    const pasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText()
            if (text?.trim()) {
                setPasteText(text)
                applyAiScores(text)
            } else {
                toast.info('Clipboard kosong. Salin dulu balasan AI, atau tempel manual di kotak.')
            }
        } catch {
            toast.info('Browser tidak mengizinkan membaca clipboard. Tempel manual (Ctrl+V) di kotak.')
        }
    }

    const handlePointChange = (index, points) => {
        const newAnswers = [...answers]
        newAnswers[index] = { ...newAnswers[index], earnedPoints: Math.min(points, newAnswers[index].maxPoints) }
        setAnswers(newAnswers)
    }

    const handleSave = (andNext = false) => {
        // Automatically default any null or undefined earnedPoints in essay/uraian answers to 0
        const gradedAnswers = answers.map(a => {
            if (isEssayType(a.type) && (a.earnedPoints === null || a.earnedPoints === undefined)) {
                return { ...a, earnedPoints: 0, isCorrect: false }
            }
            return a
        })
        const totalScore = gradedAnswers.reduce((sum, a) => sum + (a.earnedPoints || 0), 0)
        if (saving) return
        setSaving(true)
        // Close only after the save succeeded, so typed scores aren't lost
        const payload = { ...student, answers: gradedAnswers, totalScore }
        // "Simpan & Lanjut" keeps the window open on the next student
        const run = andNext && onSaveNext ? onSaveNext(payload) : onSave(payload)
        Promise.resolve(run)
            .then(ok => { if (ok !== false && !(andNext && onSaveNext)) onClose() })
            .finally(() => setSaving(false))
    }

    if (!isOpen || !student) return null

    // Calculate current total and max points
    const currentTotal = answers.reduce((sum, a) => sum + (a.earnedPoints || 0), 0)
    const maxTotal = answers.reduce((sum, a) => sum + (a.maxPoints || 0), 0)

    // Helper to check if type is essay (stored as 'uraian' in DB)
    const isEssayType = (type) => type === 'essay' || type === 'uraian'

    // Get essay questions that need grading
    const essayAnswers = answers
        .map((a, idx) => ({ ...a, originalIndex: idx }))
        .filter(a => isEssayType(a.type))

    // Get all auto-graded answers
    const autoGradedAnswers = answers
        .map((a, idx) => ({ ...a, originalIndex: idx }))
        .filter(a => !isEssayType(a.type))

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-lg correction-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h3>
                            Koreksi Jawaban
                            {total > 1 && <span className="correction-position">{position} dari {total}</span>}
                        </h3>
                        <p className="modal-subtitle">{student.studentName} - {student.nim}</p>
                    </div>
                    <button className="btn btn-icon btn-ghost" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body correction-body-simple" ref={bodyRef}>
                    {/* Auto-graded answers summary */}
                    {autoGradedAnswers.length > 0 && (
                        <div className="auto-graded-section">
                            <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
                                Soal Pilihan Ganda / Benar-Salah ({autoGradedAnswers.length} soal)
                            </h4>
                            <div className="answer-summary-grid">
                                {autoGradedAnswers.map((answer, idx) => {
                                    const question = questions.find(q => String(q.id) === String(answer.questionId))
                                    const isCorrect = answer.isCorrect
                                    return (
                                        <div key={idx} className={`answer-summary-item ${isCorrect ? 'correct' : 'incorrect'}`}>
                                            <div className="answer-summary-header">
                                                <span className="answer-summary-num">Soal {answer.originalIndex + 1}</span>
                                                <span className={`answer-summary-badge ${isCorrect ? 'correct' : 'incorrect'}`}>
                                                    {isCorrect ? '✓ Benar' : '✗ Salah'}
                                                </span>
                                            </div>
                                            <p className="answer-summary-question">{(question?.pertanyaan || question?.text)?.substring(0, 100) || 'Soal tidak ditemukan'}...</p>
                                            <div className="answer-summary-detail">
                                                <span>Jawaban: <strong>{answer.type === 'pilihan_ganda' ? String.fromCharCode(65 + (answer.answer || 0)) : (answer.answer === true ? 'Benar' : 'Salah')}</strong></span>
                                                <span>Nilai: <strong>{answer.earnedPoints || 0}/{answer.maxPoints}</strong></span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Essay grading section */}
                    {essayAnswers.length > 0 ? (
                        <div className="essay-section" style={{ marginTop: '20px' }}>
                            <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
                                Soal Essay - Perlu Dikoreksi Manual ({essayAnswers.length} soal)
                            </h4>
                            <div className="ai-toolbar">
                                <Sparkles size={16} />
                                <span className="ai-toolbar-label">Tanya AI</span>
                                <span className="ai-toolbar-note">Buka ChatGPT, Claude, atau Gemini dengan prompt penilaian otomatis. Nama & NIM tidak ikut. Nilai akhir tetap Anda yang menentukan.</span>
                                {essayAnswers.length > 1 && (
                                    <div className="ai-ask-row ai-ask-all">
                                        <span className="ai-ask-label">Semua {essayAnswers.length} soal sekaligus:</span>
                                        {AI_CHATS.map(chat => (
                                            <button
                                                key={chat.id}
                                                type="button"
                                                className={`btn btn-outline btn-sm ai-chat-btn ai-chat-${chat.id}`}
                                                onClick={() => askAiAll(chat)}
                                                title={`Buka ${chat.label} dengan prompt semua soal essay`}
                                            >
                                                {chat.label}
                                                <ExternalLink size={12} />
                                            </button>
                                        ))}
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={copyAllPrompt}>
                                            <Copy size={13} /> Salin prompt
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => setOpenPrompt(openPrompt === 'all' ? null : 'all')}
                                        >
                                            {openPrompt === 'all' ? 'Tutup prompt' : 'Lihat prompt'}
                                        </button>
                                    </div>
                                )}
                                {openPrompt === 'all' && (
                                    <textarea
                                        className="form-input ai-prompt-preview"
                                        readOnly
                                        rows={12}
                                        value={allEssayPrompt()}
                                        onFocus={e => e.target.select()}
                                    />
                                )}
                                <div className="ai-ask-row ai-ask-all">
                                    <span className="ai-ask-label">Sudah dapat jawaban AI?</span>
                                    <button type="button" className="btn btn-outline btn-sm ai-paste-btn" onClick={pasteFromClipboard}>
                                        <ClipboardPaste size={13} /> Tempel hasil AI
                                    </button>
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPasteOpen(o => !o)}>
                                        {pasteOpen ? 'Tutup' : 'Tempel manual'}
                                    </button>
                                </div>
                                {pasteOpen && (
                                    <div className="ai-paste-box">
                                        <textarea
                                            className="form-input ai-prompt-preview"
                                            rows={6}
                                            value={pasteText}
                                            onChange={e => setPasteText(e.target.value)}
                                            placeholder={'Tempel balasan AI di sini, contoh:\nSoal 1: Skor 30/50\nSoal 2: Skor 45/50'}
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            disabled={!pasteText.trim()}
                                            onClick={() => applyAiScores(pasteText)}
                                        >
                                            Isi nilai dari teks ini
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="essay-grading-list">
                                {essayAnswers.map((answer, idx) => {
                                    const question = questions.find(q => String(q.id) === String(answer.questionId))
                                    const questionImg = question?.gambar || question?.image
                                    return (
                                        <div key={idx} className="essay-grading-item">
                                            <div className="essay-q-header">
                                                <span className="essay-q-label">Soal Essay {idx + 1}</span>
                                                <span className="essay-max-points">Maks: {answer.maxPoints} poin</span>
                                            </div>
                                            <p className="essay-question-text">{question?.pertanyaan || question?.text || 'Soal tidak ditemukan'}</p>
                                            {questionImg && (
                                                <div className="question-image-container" style={{ marginTop: '10px', marginBottom: '15px' }}>
                                                    <img
                                                        src={questionImg}
                                                        alt="Gambar Soal"
                                                        style={{
                                                            maxWidth: '100%',
                                                            maxHeight: '200px',
                                                            borderRadius: 'var(--radius-md, 8px)',
                                                            border: '1px solid var(--border-color, #e2e8f0)',
                                                            cursor: 'zoom-in'
                                                        }}
                                                        onClick={() => window.open(questionImg, '_blank')}
                                                        title="Klik untuk memperbesar gambar"
                                                    />
                                                </div>
                                            )}
                                            {question?.pedoman_jawaban && (
                                                <div className="essay-guide-box">
                                                    <strong>Pedoman jawaban:</strong>
                                                    <p>{question.pedoman_jawaban}</p>
                                                </div>
                                            )}
                                            <div className="essay-answer-box">
                                                <strong>Jawaban:</strong>
                                                <p>{answer.answer || '(Tidak dijawab)'}</p>
                                            </div>
                                            <div className="ai-ask-row">
                                                <span className="ai-ask-label"><Sparkles size={14} /> Tanya AI:</span>
                                                {AI_CHATS.map(chat => (
                                                    <button
                                                        key={chat.id}
                                                        type="button"
                                                        className={`btn btn-outline btn-sm ai-chat-btn ai-chat-${chat.id}`}
                                                        onClick={() => askAi(chat, answer)}
                                                        title={`Buka ${chat.label} dengan prompt penilaian`}
                                                    >
                                                        {chat.label}
                                                        <ExternalLink size={12} />
                                                    </button>
                                                ))}
                                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyPrompt(answer)}>
                                                    <Copy size={13} /> Salin prompt
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => setOpenPrompt(openPrompt === answer.originalIndex ? null : answer.originalIndex)}
                                                >
                                                    {openPrompt === answer.originalIndex ? 'Tutup prompt' : 'Lihat prompt'}
                                                </button>
                                            </div>
                                            {openPrompt === answer.originalIndex && (
                                                <textarea
                                                    className="form-input ai-prompt-preview"
                                                    readOnly
                                                    rows={10}
                                                    value={promptFor(answer)}
                                                    onFocus={e => e.target.select()}
                                                />
                                            )}
                                            <div className="essay-score-input">
                                                <label>Nilai:</label>
                                                <input
                                                    type="number"
                                                    className="form-input points-input-simple"
                                                    value={answer.earnedPoints ?? ''}
                                                    onChange={e => handlePointChange(answer.originalIndex, parseInt(e.target.value) || 0)}
                                                    min={0}
                                                    max={answer.maxPoints}
                                                    placeholder="0"
                                                />
                                                <span className="points-max-label">/ {answer.maxPoints}</span>
                                                <div className="quick-scores" role="group" aria-label="Nilai cepat">
                                                    {[
                                                        ['0', 0],
                                                        ['½', Math.round(answer.maxPoints / 2)],
                                                        ['¾', Math.round(answer.maxPoints * 0.75)],
                                                        ['Penuh', answer.maxPoints]
                                                    ].map(([label, value]) => (
                                                        <button
                                                            key={label}
                                                            type="button"
                                                            className={`quick-score ${answer.earnedPoints === value ? 'is-on' : ''}`}
                                                            onClick={() => handlePointChange(answer.originalIndex, value)}
                                                            title={`${value} poin`}
                                                        >
                                                            {label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="no-essay-message" style={{ marginTop: autoGradedAnswers.length > 0 ? '20px' : '0' }}>
                            <p>Tidak ada soal essay yang perlu dikoreksi manual.</p>
                            <p>Semua soal telah dikoreksi otomatis.</p>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <div className="total-score-simple">
                        Total: <strong className="score-value">{currentTotal}</strong> / {maxTotal}
                    </div>
                    <div className="modal-actions">
                        <button className="btn btn-ghost" onClick={onClose}>Batal</button>
                        <button
                            className={`btn ${onSaveNext && position < total ? 'btn-outline' : 'btn-primary'}`}
                            onClick={() => handleSave(false)}
                            disabled={saving}
                        >
                            <Save size={16} />
                            {saving ? 'Menyimpan...' : 'Simpan'}
                        </button>
                        {onSaveNext && position < total && (
                            <button className="btn btn-primary" onClick={() => handleSave(true)} disabled={saving}>
                                {saving ? 'Menyimpan...' : 'Simpan & Lanjut'}
                                <ChevronRight size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .essay-guide-box {
                    border: 1px dashed var(--border-color);
                    border-radius: var(--radius-md);
                    padding: var(--space-2) var(--space-3);
                    margin-bottom: var(--space-3);
                    font-size: var(--font-size-sm);
                    color: var(--text-secondary);
                }
                .essay-guide-box strong {
                    display: block;
                    font-size: 0.78rem;
                    margin-bottom: 2px;
                }
                .essay-guide-box p {
                    margin: 0;
                    white-space: pre-wrap;
                    line-height: 1.5;
                }
                .ai-toolbar {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.6rem 0.8rem;
                    margin-bottom: var(--space-3);
                    border-radius: 16px;
                    background: linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(59, 130, 246, 0.08));
                    border: 1px solid rgba(139, 92, 246, 0.2);
                    color: #7c3aed;
                }
                .ai-toolbar-label {
                    font-weight: 700;
                    font-size: 0.85rem;
                }
                .ai-toolbar-note {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }
                .ai-ask-row {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 0.4rem;
                    margin-bottom: var(--space-3);
                }
                .ai-ask-label {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.3rem;
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: #7c3aed;
                    margin-right: 0.15rem;
                }
                .ai-chat-btn {
                    gap: 0.3rem;
                }
                .correction-modal {
                    width: min(1100px, 96vw) !important;
                    max-width: none !important;
                    max-height: calc(100vh - 32px);
                    display: flex;
                    flex-direction: column;
                }
                .correction-modal .correction-body-simple {
                    flex: 1 1 auto;
                    min-height: 0;
                    max-height: calc(100vh - 220px);
                    overflow-y: auto;
                    padding-top: 1rem;
                }
                .correction-position {
                    display: inline-block;
                    margin-left: 0.6rem;
                    padding: 2px 10px;
                    border-radius: 999px;
                    background: rgba(37, 99, 235, 0.1);
                    color: #1d4ed8;
                    font-size: 0.75rem;
                    font-weight: 700;
                    vertical-align: middle;
                }
                .quick-scores {
                    display: inline-flex;
                    gap: 0.3rem;
                    margin-left: 0.5rem;
                    flex-wrap: wrap;
                }
                .quick-score {
                    min-width: 40px;
                    height: 34px;
                    padding: 0 0.6rem;
                    border-radius: 999px;
                    border: 1px solid var(--border-color);
                    background: rgba(255, 255, 255, 0.85);
                    color: var(--text-secondary);
                    font-size: 0.8rem;
                    font-weight: 700;
                    cursor: pointer;
                }
                .quick-score:hover {
                    border-color: #2563eb;
                    color: #1d4ed8;
                }
                .quick-score.is-on {
                    background: #2563eb;
                    border-color: #2563eb;
                    color: #fff;
                }
                .ai-paste-box {
                    flex-basis: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 0.5rem;
                }
                .ai-paste-btn {
                    gap: 0.3rem;
                    color: #7c3aed !important;
                }
                @media (max-width: 640px) {
                    .correction-modal {
                        width: 100vw !important;
                        height: 100dvh;
                        max-height: 100dvh;
                        border-radius: 0 !important;
                    }
                    .correction-modal .correction-body-simple {
                        max-height: none;
                    }
                    .quick-scores {
                        margin: 0.4rem 0 0;
                        width: 100%;
                    }
                    .correction-modal .modal-footer {
                        flex-wrap: wrap;
                        gap: 0.5rem;
                    }
                    .correction-modal .modal-actions {
                        width: 100%;
                        display: flex;
                        gap: 0.4rem;
                    }
                    .correction-modal .modal-actions .btn {
                        flex: 1 1 0;
                        justify-content: center;
                        padding-left: 0.5rem;
                        padding-right: 0.5rem;
                    }
                }
                .ai-toolbar .ai-ask-all {
                    flex-basis: 100%;
                    margin: 0.35rem 0 0;
                    padding-top: 0.6rem;
                    border-top: 1px dashed rgba(139, 92, 246, 0.25);
                }
                .ai-toolbar .ai-prompt-preview {
                    margin: 0.4rem 0 0;
                    color: var(--text-primary);
                }
                .ai-chat-chatgpt { color: #0f766e !important; }
                .ai-chat-claude { color: #c2410c !important; }
                .ai-chat-gemini { color: #2563eb !important; }
                .ai-prompt-preview {
                    width: 100%;
                    margin-bottom: var(--space-3);
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 0.75rem !important;
                    line-height: 1.45;
                    border-radius: 14px !important;
                }
                .essay-score-input {
                    flex-wrap: wrap;
                }
                .answer-summary-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: var(--space-3);
                }
                .answer-summary-item {
                    padding: var(--space-3);
                    border-radius: var(--radius-md);
                    border: 1px solid var(--border-color);
                    background: var(--bg-tertiary);
                }
                .answer-summary-item.correct {
                    border-left: 3px solid var(--success-500);
                }
                .answer-summary-item.incorrect {
                    border-left: 3px solid var(--error-500);
                }
                .answer-summary-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--space-2);
                }
                .answer-summary-num {
                    font-weight: var(--font-semibold);
                    font-size: var(--font-size-sm);
                }
                .answer-summary-badge {
                    font-size: var(--font-size-xs);
                    padding: 2px 8px;
                    border-radius: var(--radius-full);
                }
                .answer-summary-badge.correct {
                    background: var(--success-100);
                    color: var(--success-700);
                }
                .answer-summary-badge.incorrect {
                    background: var(--error-100);
                    color: var(--error-700);
                }
                .answer-summary-question {
                    font-size: var(--font-size-sm);
                    color: var(--text-secondary);
                    margin-bottom: var(--space-2);
                    line-height: 1.4;
                }
                .answer-summary-detail {
                    display: flex;
                    justify-content: space-between;
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
                .modal-lg {
                    max-width: 800px;
                }
            `}</style>
        </div>
    )
}

function KoreksiUjianPage() {
    const { ask } = useConfirm()
    const { user } = useAuth()
    const { settings } = useSettings()
    const tahunAkademik = getActiveAcademicYear(settings, user)
    const [examResults, setExamResults] = useState([])
    const [selectedExam, setSelectedExam] = useState(null)
    const [correctionModal, setCorrectionModal] = useState({ open: false, student: null })
    const [soalList, setSoalList] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadData = async () => {
            try {
                if (isSupabaseConfigured()) {
                    // Load from Supabase
                    let hasilData = []

                    // If user is Dosen, use specialized fetch to respect RLS and Logic
                    if (user.role === 'dosen') {
                        console.log('[KoreksiUjian] Fetching for Dosen:', user.id)
                        hasilData = await hasilUjianService.getByDosen(user.id, tahunAkademik)
                    } else {
                        // Admin can see all (filtered by matkul_prodi_id if admin_prodi)
                        const filter = {
                            ...(user?.role === 'admin_prodi' && user?.prodi_id ? { matkul_prodi_id: user.prodi_id } : {}),
                            ...(tahunAkademik ? { tahun_akademik: tahunAkademik } : {})
                        }
                        hasilData = await hasilUjianService.getAll(filter)
                    }

                    const soalData = await soalService.getAll({ tahun_akademik: tahunAkademik })

                    setSoalList(soalData)

                    console.log('[KoreksiUjian] Raw hasilData count:', hasilData?.length || 0)
                    if (hasilData?.length > 0) {
                        console.log('[KoreksiUjian] Sample hasil:', {
                            id: hasilData[0].id,
                            jadwal_id: hasilData[0].jadwal_id,
                            status: hasilData[0].status,
                            has_jadwal: !!hasilData[0].jadwal,
                            has_mahasiswa: !!hasilData[0].mahasiswa,
                            jadwal_tipe: hasilData[0].jadwal?.tipe,
                            jadwal_matkul: hasilData[0].jadwal?.matkul?.nama
                        })
                    }

                    // Group results by jadwal (exam)
                    const examGroups = {}
                    hasilData.forEach(hasil => {
                        const jadwalId = hasil.jadwal_id
                        if (!jadwalId) return

                        const jadwal = hasil.jadwal
                        const mahasiswa = hasil.mahasiswa

                        if (!examGroups[jadwalId]) {
                            const kelasName = jadwal?.kelas?.nama || ''
                            examGroups[jadwalId] = {
                                id: jadwalId,
                                name: `${jadwal?.tipe || 'Ujian'} ${jadwal?.matkul?.nama || 'Mata Kuliah'}${kelasName ? ` - ${kelasName}` : ''}`,
                                matkul: jadwal?.matkul?.nama || 'N/A',
                                kelas: kelasName || '-',
                                date: jadwal?.tanggal || 'N/A',
                                deadline: jadwal?.tanggal ? new Date(new Date(jadwal.tanggal).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : 'N/A',
                                students: [],
                                totalStudents: 0,
                                corrected: 0,
                                status: 'in_progress'
                            }
                        }

                        // Parse answers_detail if exists
                        let answers = []
                        try {
                            if (hasil.answers_detail) {
                                answers = typeof hasil.answers_detail === 'string'
                                    ? JSON.parse(hasil.answers_detail)
                                    : hasil.answers_detail
                            }
                        } catch (e) {
                            console.error('Error parsing answers:', e)
                        }

                        // Enrich answers with maxPoints from soal if missing
                        let enrichedAnswers = answers.map(a => {
                            // Lookup soal for this answer
                            const soal = soalData.find(s => String(s.id) === String(a.questionId))
                            const type = a.type || soal?.tipe_soal || 'pilihan_ganda'
                            const isEssay = type === 'essay' || type === 'uraian'
                            let earnedPoints = a.earnedPoints
                            if (hasil.status === 'graded' && isEssay && (earnedPoints === null || earnedPoints === undefined)) {
                                earnedPoints = 0
                            }
                            return {
                                ...a,
                                type,
                                maxPoints: (a.maxPoints != null && a.maxPoints !== undefined) 
                                    ? a.maxPoints 
                                    : (soal?.bobot || soal?.points || 10),
                                earnedPoints,
                                _soalDosenId: soal?.dosen_id || null
                            }
                        })

                        // If answers_detail is empty but exam was taken, build stubs from soal
                        if (enrichedAnswers.length === 0 && jadwal?.matkul_id) {
                            const examSoal = soalData.filter(s =>
                                String(s.matkul_id) === String(jadwal.matkul_id) &&
                                (s.tipe_ujian?.toUpperCase() === (jadwal.tipe || jadwal.tipe_ujian || '').toUpperCase())
                            )
                            enrichedAnswers = examSoal.map(s => ({
                                questionId: s.id,
                                type: s.tipe_soal || 'pilihan_ganda',
                                answer: null,
                                maxPoints: s.bobot || 10,
                                earnedPoints: null,
                                isCorrect: false,
                                _soalDosenId: s.dosen_id || null
                            }))
                        }

                        // Store dosen's soal IDs for filtering in correction modal
                        let dosenSoalIds = null
                        if (user.role === 'dosen') {
                            dosenSoalIds = new Set(
                                soalData
                                    .filter(s => String(s.dosen_id) === String(user.id))
                                    .map(s => String(s.id))
                            )
                        }

                        // For display: filter to dosen's soal only
                        const dosenAnswers = dosenSoalIds
                            ? enrichedAnswers.filter(a => dosenSoalIds.has(String(a.questionId)))
                            : enrichedAnswers

                        // Clean up internal field
                        const cleanAnswers = enrichedAnswers.map(({ _soalDosenId, ...rest }) => rest)
                        const cleanDosenAnswers = dosenAnswers.map(({ _soalDosenId, ...rest }) => rest)

                        // Status: use full answers for DB status, but dosen answers for display
                        const dosenHasEssay = cleanDosenAnswers.some(a => a.type === 'essay' || a.type === 'uraian')
                        const dosenEssayPending = cleanDosenAnswers.some(a =>
                            (a.type === 'essay' || a.type === 'uraian') && (a.earnedPoints === null || a.earnedPoints === undefined)
                        )
                        
                        // Fully corrected if: status is 'graded', OR no dosen essay pending, OR no dosen answers (nothing to correct)
                        const isFullyCorrected = hasil.status === 'graded' || (
                            cleanDosenAnswers.length === 0 
                                ? (hasil.status === 'graded' || hasil.status === 'submitted')
                                : !dosenEssayPending
                        )

                        // Debug: log students that are NOT fully corrected
                        if (!isFullyCorrected) {
                            const pendingEssays = cleanDosenAnswers.filter(a => 
                                (a.type === 'essay' || a.type === 'uraian') && (a.earnedPoints === null || a.earnedPoints === undefined)
                            )
                            console.log(`[LOAD DEBUG] ${mahasiswa?.nama} NOT corrected. dosenAnswers: ${cleanDosenAnswers.length}, allAnswers: ${enrichedAnswers.length}, pendingEssays:`, pendingEssays.map(p => ({qId: p.questionId, type: p.type, earned: p.earnedPoints})))
                        }

                        examGroups[jadwalId].students.push({
                            id: hasil.id,
                            resultId: hasil.id,
                            studentName: mahasiswa?.nama || 'N/A',
                            nim: mahasiswa?.nim_nip || 'N/A',
                            submittedAt: hasil.waktu_selesai ? new Date(hasil.waktu_selesai).toLocaleString('id-ID') : 'N/A',
                            answers: cleanDosenAnswers, // Only this dosen's soal for correction modal
                            fullAnswers: cleanAnswers,  // ALL answers for save merging
                            allAnswersCount: answers.length,
                            totalScore: isFullyCorrected ? (cleanDosenAnswers.reduce((sum, a) => sum + (a.earnedPoints || 0), 0)) : null,
                            maxScore: cleanDosenAnswers.reduce((sum, a) => sum + (a.maxPoints || 0), 0) || 100,
                            hasEssay: dosenHasEssay,
                            isFullyCorrected,
                            submitType: hasil.submit_type || (hasil.status === 'graded' || hasil.status === 'submitted' ? 'manual' : null),
                            hasilStatus: hasil.status
                        })

                        examGroups[jadwalId].totalStudents = examGroups[jadwalId].students.length
                        examGroups[jadwalId].corrected = examGroups[jadwalId].students.filter(s => s.isFullyCorrected).length
                    })

                    setExamResults(Object.values(examGroups))
                    console.log('[KoreksiUjian] Loaded', Object.keys(examGroups).length, 'exams from Supabase')
                } else {
                    loadFromLocalStorage()
                }
            } catch (error) {
                console.error('[KoreksiUjian] Error loading from Supabase:', error)
                // (the local-storage fallback referenced undefined data and crashed)
                toast.error('Gagal memuat data koreksi: ' + errorMessage(error) + '. Muat ulang halaman.')
                setExamResults([])
            }
            setLoading(false)
        }

        const loadFromLocalStorage = () => {

            setSoalList(soal)

            const examGroups = {}
            results.forEach(result => {
                const examJadwal = jadwal.find(j => j.id === result.examId)

                if (!examGroups[result.examId]) {
                    const mk = examJadwal ? matkul.find(m => m.id === examJadwal.matkulId) : null
                    examGroups[result.examId] = {
                        id: result.examId,
                        name: result.examName || `Ujian ${result.examId}`,
                        matkul: mk?.nama || result.matkulName || 'N/A',
                        date: examJadwal?.tanggal || 'N/A',
                        deadline: examJadwal ? new Date(new Date(examJadwal.tanggal).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : 'N/A',
                        students: [],
                        totalStudents: 0,
                        corrected: 0,
                        status: 'in_progress'
                    }
                }

                examGroups[result.examId].students.push({
                    id: result.id,
                    resultId: result.id,
                    studentName: result.mahasiswaName,
                    nim: result.nim,
                    submittedAt: result.submittedAtDisplay || new Date(result.submittedAt).toLocaleString('id-ID'),
                    answers: result.answers,
                    totalScore: result.isFullyCorrected ? result.totalScore : null,
                    maxScore: result.maxScore,
                    hasEssay: result.hasEssay,
                    isFullyCorrected: result.isFullyCorrected
                })

                examGroups[result.examId].totalStudents = examGroups[result.examId].students.length
                examGroups[result.examId].corrected = examGroups[result.examId].students.filter(s => s.isFullyCorrected).length
            })

            setExamResults(Object.values(examGroups))
        }

        loadData()
    }, [user, tahunAkademik])

    const handleSelectExam = (exam) => {
        setSelectedExam(exam)
    }

    // Delete all exam results for a jadwal (for re-examination due to technical issues)
    const handleDeleteExamResults = async (exam, e) => {
        if (e) e.stopPropagation()
        
        const confirmed = await ask({
            title: 'Hapus Semua Hasil Ujian',
            message: `Semua hasil ujian "${exam.name}" (${exam.totalStudents} mahasiswa) akan DIHAPUS. ` +
                `Mahasiswa dapat mengerjakan ujian kembali dari awal.\n\n` +
                `Untuk konfirmasi, ketik nama ujian: ${exam.name}`,
            requireText: exam.name,
            confirmText: 'Hapus Semua',
            confirmVariant: 'error'
        })
        if (!confirmed) return
        
        try {
            // 1. Delete all jawaban for this jadwal
            await jawabanMahasiswaService.deleteByJadwal(exam.id)
            
            // 2. Delete all hasil_ujian for this jadwal
            await hasilUjianService.deleteByJadwal(exam.id)
            
            // 3. Remove from local state
            setExamResults(prev => prev.filter(e => e.id !== exam.id))
            if (selectedExam?.id === exam.id) {
                setSelectedExam(null)
            }
            
            toast.success(`Semua hasil ujian "${exam.name}" berhasil dihapus. Mahasiswa dapat mengerjakan ujian kembali.`)
            console.log('[KoreksiUjian] Deleted all results for jadwal:', exam.id)
        } catch (error) {
            console.error('[KoreksiUjian] Error deleting results:', error)
            toast.error('Gagal menghapus hasil ujian: ' + errorMessage(error))
        }
    }

    const handleOpenCorrection = (student) => {
        setCorrectionModal({ open: true, student })
    }

    // Save, then open the next student in the list (preferring one not yet
    // graded) without closing the window
    const handleSaveAndNext = async (updatedStudent) => {
        const ok = await handleSaveCorrection(updatedStudent)
        if (!ok) return false
        const list = selectedExam?.students || []
        const i = list.findIndex(s => s.id === updatedStudent.id)
        const after = list.slice(i + 1)
        const next = after.find(s => s.totalScore === null && s.hasilStatus !== 'in_progress') || after[0]
        if (next) setCorrectionModal({ open: true, student: next })
        else {
            setCorrectionModal({ open: false, student: null })
            toast.success('Semua mahasiswa di daftar ini sudah dibuka.')
        }
        return true
    }

    const handleSaveCorrection = async (updatedStudent) => {
        try {
            let savedScore = updatedStudent.totalScore
            // 1. Update in Supabase — MERGE corrected answers into full answers_detail
            if (isSupabaseConfigured()) {
                // Fetch current full answers_detail from DB
                const { data: currentRecord, error: fetchError } = await supabase
                    .from('hasil_ujian')
                    .select('answers_detail, is_ulang')
                    .eq('id', updatedStudent.resultId)
                    .single()

                if (fetchError) {
                    console.error('Error fetching current answers:', fetchError)
                    throw fetchError
                }

                // Parse current answers from DB
                let dbAnswers = []
                try {
                    if (currentRecord?.answers_detail) {
                        dbAnswers = typeof currentRecord.answers_detail === 'string'
                            ? JSON.parse(currentRecord.answers_detail)
                            : currentRecord.answers_detail
                    }
                } catch (e) {
                    console.error('Error parsing DB answers:', e)
                    dbAnswers = []
                }

                // Build map of corrected answers from this dosen
                const correctedMap = new Map()
                updatedStudent.answers.forEach(a => {
                    correctedMap.set(String(a.questionId), a)
                })

                console.log('[Save] DB answers count:', dbAnswers.length, 
                    'Corrected answers count:', updatedStudent.answers.length)

                // Merge corrected answers into DB answers
                let mergedAnswers
                if (dbAnswers.length > 0) {
                    mergedAnswers = dbAnswers.map(a => {
                        const corrected = correctedMap.get(String(a.questionId))
                        return corrected || a
                    })
                    // Also add any corrected answers not in DB (shouldn't happen but safety)
                    const dbQuestionIds = new Set(dbAnswers.map(a => String(a.questionId)))
                    updatedStudent.answers.forEach(a => {
                        if (!dbQuestionIds.has(String(a.questionId))) {
                            mergedAnswers.push(a)
                        }
                    })
                } else {
                    // DB was corrupted/empty — use corrected answers directly
                    mergedAnswers = updatedStudent.answers
                }

                // Calculate total score from ALL merged answers, normalized to 0-100
                const rawTotal = mergedAnswers.reduce((sum, a) => sum + (a.earnedPoints || 0), 0)
                const maxTotal = mergedAnswers.reduce((sum, a) => sum + (a.maxPoints || 0), 0)
                const totalScore = toPercentScore(rawTotal, maxTotal)
                savedScore = totalScore

                // Log essay answers specifically
                const essayAnswers = mergedAnswers.filter(a => a.type === 'essay' || a.type === 'uraian')
                console.log('[Save] Essay answers being saved:', essayAnswers.map(e => ({
                    qId: e.questionId, 
                    earned: e.earnedPoints, 
                    max: e.maxPoints,
                    type: e.type
                })))

                const isUlang = currentRecord?.is_ulang || false
                let nilaiFinal = totalScore
                if (isUlang && totalScore >= 70) {
                    nilaiFinal = 70
                }

                const updateResult = await hasilUjianService.update(updatedStudent.resultId, {
                    nilai_total: totalScore,
                    nilai_final: nilaiFinal,
                    answers_detail: mergedAnswers,
                    status: 'graded'
                })
                console.log('[Save] Update result:', updateResult?.id, 'status:', updateResult?.status)

                // VERIFY: Read back from DB to confirm save worked
                const { data: verifyRecord } = await supabase
                    .from('hasil_ujian')
                    .select('answers_detail, nilai_total, status')
                    .eq('id', updatedStudent.resultId)
                    .single()
                
                if (verifyRecord?.answers_detail) {
                    const verifyAnswers = typeof verifyRecord.answers_detail === 'string' 
                        ? JSON.parse(verifyRecord.answers_detail) 
                        : verifyRecord.answers_detail
                    const verifyEssays = verifyAnswers.filter(a => a.type === 'essay' || a.type === 'uraian')
                    console.log('[VERIFY] DB read-back essays:', verifyEssays.map(e => ({
                        qId: e.questionId, 
                        earned: e.earnedPoints, 
                        type: e.type
                    })))
                    console.log('[VERIFY] DB nilai_total:', verifyRecord.nilai_total, 'status:', verifyRecord.status)
                }
            }

            // 2. Update student in state (list shows raw points / max points)
            const updatedStudents = selectedExam.students.map(s =>
                s.id === updatedStudent.id ? updatedStudent : s
            )
            setSelectedExam({ ...selectedExam, students: updatedStudents })

            // 3. Update in examResults
            setExamResults(prev => prev.map(exam =>
                exam.id === selectedExam.id
                    ? { ...exam, students: updatedStudents, corrected: updatedStudents.filter(s => s.totalScore !== null).length }
                    : exam
            ))

            toast.success(`Koreksi ${updatedStudent.studentName || 'mahasiswa'} tersimpan (nilai ${savedScore})`)
            return true
        } catch (error) {
            console.error('Failed to save correction:', error)
            toast.error('Gagal menyimpan nilai: ' + errorMessage(error))
            return false
        }
    }

    const getDaysRemaining = (deadline) => {
        const today = new Date()
        const deadlineDate = new Date(deadline)
        const diff = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24))
        return diff
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'completed':
                return <span className="badge badge-success">Selesai</span>
            case 'in_progress':
                return <span className="badge badge-warning">Berlangsung</span>
            default:
                return <span className="badge badge-info">Pending</span>
        }
    }

    // ========================================
    // REGRADE: Re-evaluate all answers against actual correct answers
    // ========================================
    const [regrading, setRegrading] = useState(false)

    const normalizeAnswer = (val) => {
        if (val === null || val === undefined) return null
        // If it's a letter like "A", "B", convert to index
        if (typeof val === 'string' && /^[A-E]$/i.test(val)) {
            return { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4 }[val.toUpperCase()]
        }
        return Number(val)
    }

    const handleRegradeAll = async () => {
        if (!(await ask({ title: 'Hitung Ulang Nilai', message: 'Regrade semua hasil ujian? Ini akan menghitung ulang nilai berdasarkan kunci jawaban terbaru.', confirmText: 'Hitung Ulang' }))) return
        setRegrading(true)
        try {
            // Fetch ALL soal for correct answers
            const allSoal = await soalService.getAll({ tahun_akademik: tahunAkademik })
            const soalMap = {}
            allSoal.forEach(s => {
                soalMap[s.id] = s
            })

            // Fetch ALL hasil ujian
            let allHasil = []
            if (user.role === 'dosen') {
                allHasil = await hasilUjianService.getByDosen(user.id, tahunAkademik)
            } else {
                const filter = {
                    ...(user?.role === 'admin_prodi' && user?.prodi_id ? { matkul_prodi_id: user.prodi_id } : {}),
                    ...(tahunAkademik ? { tahun_akademik: tahunAkademik } : {})
                }
                allHasil = await hasilUjianService.getAll(filter)
            }

            let changedCount = 0
            let skippedRunning = 0
            const RUNNING_WINDOW_MS = 6 * 60 * 60 * 1000
            for (const hasil of allHasil) {
                if (!hasil.answers_detail) continue
                // A student who is still working has status in_progress and a
                // recent start. Grading that row would lock them out on refresh.
                if (hasil.status === 'in_progress' && hasil.waktu_mulai &&
                    Date.now() - new Date(hasil.waktu_mulai).getTime() < RUNNING_WINDOW_MS) {
                    skippedRunning++
                    continue
                }
                let answers = typeof hasil.answers_detail === 'string'
                    ? JSON.parse(hasil.answers_detail)
                    : hasil.answers_detail
                if (!Array.isArray(answers) || answers.length === 0) continue

                let newTotal = 0
                let changed = false
                const newAnswers = answers.map(a => {
                    // Skip essay/manual grading
                    if (a.needsManualGrading || a.type === 'essay' || a.type === 'uraian') {
                        newTotal += (a.earnedPoints || 0)
                        return a
                    }

                    const soal = soalMap[a.questionId]
                    if (!soal) return a

                    const studentAns = normalizeAnswer(a.answer)
                    const correctAns = normalizeAnswer(soal.jawaban_benar)

                    let isCorrect = false
                    let earned = 0

                    if (studentAns !== null && correctAns !== null) {
                        if (a.type === 'benar_salah') {
                            isCorrect = String(a.answer) === String(soal.jawaban_benar)
                        } else {
                            isCorrect = studentAns === correctAns
                        }
                        if (isCorrect) {
                            earned = a.maxPoints || soal.bobot || 10
                        }
                    }

                    if (a.isCorrect !== isCorrect || a.earnedPoints !== earned) {
                        changed = true
                    }

                    newTotal += earned
                    return {
                        ...a,
                        correctAnswer: soal.jawaban_benar,
                        isCorrect,
                        earnedPoints: earned
                    }
                })

                if (changed) {
                    const maxTotal = newAnswers.reduce((sum, a) => sum + (a.maxPoints || 0), 0)
                    const regradedScore = toPercentScore(newTotal, maxTotal)
                    await hasilUjianService.update(hasil.id, {
                        answers_detail: newAnswers,
                        nilai_total: regradedScore,
                        nilai_final: hasil.is_ulang ? Math.min(regradedScore, 70) : regradedScore,
                        status: newAnswers.some(a => a.needsManualGrading) ? 'submitted' : 'graded'
                    })
                    changedCount++
                }
            }

            const skippedNote = skippedRunning ? ` ${skippedRunning} peserta yang masih mengerjakan ujian dilewati.` : ''
            toast.success(`Regrade selesai: ${changedCount} hasil ujian diperbarui.${skippedNote}`)
            // Reload page to see changes (alert kept: a toast would vanish with the reload)
            window.location.reload()
        } catch (error) {
            console.error('Regrade error:', error)
            toast.error('Gagal regrade: ' + errorMessage(error))
        }
        setRegrading(false)
    }

    return (
        <DashboardLayout>
            <div className="dashboard-page animate-fadeIn">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Koreksi Ujian</h1>
                        <p className="page-subtitle">Koreksi jawaban ujian mahasiswa</p>
                    </div>
                    <button
                        className="btn btn-warning"
                        onClick={handleRegradeAll}
                        disabled={regrading}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <RefreshCw size={16} className={regrading ? 'spin' : ''} />
                        {regrading ? 'Regrading...' : 'Regrade Semua Hasil'}
                    </button>
                </div>

                {!selectedExam ? (
                    <>
                        {/* Exam List */}
                        <div className="card">
                            <div className="card-header">
                                <h3>Ujian Perlu Dikoreksi</h3>
                            </div>
                            <div className="card-body">
                                {loading ? (
                                    <div className="text-center" style={{ padding: '48px' }}>
                                        <div style={{
                                            width: '48px', height: '48px', margin: '0 auto 16px',
                                            border: '4px solid var(--border-color)',
                                            borderTopColor: 'var(--primary-500)',
                                            borderRadius: '50%',
                                            animation: 'spin 0.8s linear infinite'
                                        }} />
                                        <h4 style={{ margin: '0 0 8px' }}>Memuat Data Koreksi...</h4>
                                        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Sedang mengambil hasil ujian dari server</p>
                                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                                    </div>
                                ) : examResults.length === 0 ? (
                                    <div className="text-center" style={{ padding: '48px', opacity: 0.6 }}>
                                        <FileText size={48} style={{ marginBottom: '16px' }} />
                                        <h4 style={{ margin: '0 0 8px' }}>Tidak Ada Ujian</h4>
                                        <p style={{ margin: 0 }}>Belum ada ujian yang perlu dikoreksi saat ini.</p>
                                    </div>
                                ) : (
                                    <div className="exam-list">
                                        {examResults.map(exam => {
                                            const daysRemaining = getDaysRemaining(exam.deadline)
                                            const isUrgent = daysRemaining <= 2 && exam.status !== 'completed'
                                            return (
                                                <div
                                                    key={exam.id}
                                                    className={`exam-item ${isUrgent ? 'urgent' : ''}`}
                                                    onClick={() => handleSelectExam(exam)}
                                                >
                                                    <div className="exam-info">
                                                        <h4>{exam.name}</h4>
                                                        <p>{exam.matkul}{exam.kelas && exam.kelas !== '-' ? ` • Kelas ${exam.kelas}` : ''}</p>
                                                        <p className="exam-date">Tanggal: {exam.date}</p>
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            onClick={(e) => handleDeleteExamResults(exam, e)}
                                                            title="Hapus semua hasil ujian agar mahasiswa bisa ujian ulang"
                                                            style={{ 
                                                                padding: '2px 8px', 
                                                                fontSize: '0.75rem', 
                                                                color: 'var(--error-600)',
                                                                marginTop: '4px'
                                                            }}
                                                        >
                                                            <Trash2 size={12} />
                                                            Hapus Hasil Ujian
                                                        </button>
                                                    </div>
                                                    <div className="exam-meta">
                                                        {getStatusBadge(exam.status)}
                                                        <div className="correction-progress">
                                                            <div className="progress-bar-container">
                                                                <div
                                                                    className="progress-bar-fill"
                                                                    style={{ width: `${(exam.corrected / exam.totalStudents) * 100}%` }}
                                                                />
                                                            </div>
                                                            <span>{exam.corrected}/{exam.totalStudents}</span>
                                                        </div>
                                                        <div className={`deadline ${isUrgent ? 'urgent' : ''}`}>
                                                            <Clock size={14} />
                                                            {daysRemaining > 0 ? (
                                                                <span>{daysRemaining} hari lagi</span>
                                                            ) : daysRemaining === 0 ? (
                                                                <span>Hari ini!</span>
                                                            ) : (
                                                                <span className="overdue">Terlambat {Math.abs(daysRemaining)} hari</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <ChevronRight size={20} className="chevron" />
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Back Button */}
                        <button
                            className="btn btn-ghost mb-4"
                            onClick={() => setSelectedExam(null)}
                        >
                            ← Kembali ke Daftar Ujian
                        </button>

                        {/* Exam Header */}
                        <div className="exam-detail-header card mb-4">
                            <div className="card-body">
                                <div className="exam-detail-info">
                                    <h2>{selectedExam.name}</h2>
                                    <p>{selectedExam.matkul} - Kelas {selectedExam.kelas}</p>
                                </div>
                                <div className="exam-detail-stats">
                                    <div className="stat-item">
                                        <Users size={18} />
                                        <span>{selectedExam.totalStudents} Peserta</span>
                                    </div>
                                    <div className="stat-item">
                                        <CheckSquare size={18} />
                                        <span>{selectedExam.corrected} Terkoreksi</span>
                                    </div>
                                    <div className="stat-item">
                                        <Clock size={18} />
                                        <span>Deadline: {selectedExam.deadline}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Student List */}
                        <div className="card">
                            <div className="card-header">
                                <h3>Daftar Jawaban Mahasiswa</h3>
                            </div>
                            <div className="card-body">
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>No</th>
                                                <th>Nama</th>
                                                <th>NIM</th>
                                                <th>Submit</th>
                                                <th>Status</th>
                                                <th>Nilai</th>
                                                <th>Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedExam.students.map((student, index) => {
                                                const hasEssayPending = student.answers.some(a => (a.type === 'essay' || a.type === 'uraian') && a.earnedPoints === null)
                                                return (
                                                    <tr key={student.id}>
                                                        <td>{index + 1}</td>
                                                        <td className="font-medium">{student.studentName}</td>
                                                        <td>{student.nim}</td>
                                                        <td className="text-muted">{student.submittedAt}</td>
                                                        <td>
                                                            {student.totalScore !== null ? (
                                                                <span className="badge badge-success">Selesai</span>
                                                            ) : hasEssayPending ? (
                                                                <span className="badge badge-warning">Essay Pending</span>
                                                            ) : student.submitType === 'auto' ? (
                                                                <span className="badge badge-info" title="Waktu ujian habis, jawaban disimpan otomatis">Submitted (Waktu Habis)</span>
                                                            ) : student.hasilStatus === 'in_progress' ? (
                                                                <span className="badge badge-error" title="Mahasiswa tidak submit jawaban">Belum Submit</span>
                                                            ) : (
                                                                <span className="badge badge-info">Submitted</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {student.totalScore !== null ? (
                                                                <span className="score-badge">{student.totalScore}</span>
                                                            ) : (
                                                                <span className="text-muted">-</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="btn btn-primary btn-sm"
                                                                onClick={() => handleOpenCorrection(student)}
                                                            >
                                                                {student.totalScore !== null ? (
                                                                    <>
                                                                        <Eye size={14} />
                                                                        Lihat
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Edit2 size={14} />
                                                                        Koreksi
                                                                    </>
                                                                )}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <CorrectionModal
                    isOpen={correctionModal.open}
                    onClose={() => setCorrectionModal({ open: false, student: null })}
                    student={correctionModal.student}
                    questions={soalList}
                    onSave={handleSaveCorrection}
                    onSaveNext={handleSaveAndNext}
                    position={correctionModal.student && selectedExam ? selectedExam.students.findIndex(s => s.id === correctionModal.student.id) + 1 : 0}
                    total={selectedExam?.students?.length || 0}
                />
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
                .btn-warning {
                    background: var(--warning-500, #f59e0b);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: var(--radius-md, 8px);
                    cursor: pointer;
                    font-weight: 600;
                }
                .btn-warning:hover {
                    background: var(--warning-600, #d97706);
                }
                .btn-warning:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                
                .card-header {
                    padding: var(--space-4) var(--space-5);
                    border-bottom: 1px solid var(--border-color);
                }
                .card-header h3 {
                    margin: 0;
                    font-size: var(--font-size-lg);
                }
                .exam-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-3);
                }
                .exam-item {
                    display: flex;
                    align-items: center;
                    gap: var(--space-4);
                    padding: var(--space-4);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-lg);
                    border: 2px solid transparent;
                    cursor: pointer;
                    transition: all var(--transition-fast);
                }
                .exam-item:hover {
                    border-color: var(--primary-300);
                }
                .exam-item.urgent {
                    border-color: var(--warning-300);
                    background: var(--warning-50);
                }
                .exam-info {
                    flex: 1;
                }
                .exam-info h4 {
                    margin: 0 0 var(--space-1);
                    font-size: var(--font-size-base);
                }
                .exam-info p {
                    margin: 0;
                    font-size: var(--font-size-sm);
                    color: var(--text-secondary);
                }
                .exam-date {
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
                .exam-meta {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2);
                    align-items: flex-end;
                }
                .correction-progress {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    font-size: var(--font-size-xs);
                }
                .progress-bar-container {
                    width: 60px;
                    height: 6px;
                    background: var(--border-color);
                    border-radius: 3px;
                    overflow: hidden;
                }
                .progress-bar-fill {
                    height: 100%;
                    background: var(--primary-500);
                    border-radius: 3px;
                }
                .deadline {
                    display: flex;
                    align-items: center;
                    gap: var(--space-1);
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                }
                .deadline.urgent {
                    color: var(--warning-600);
                }
                .deadline .overdue {
                    color: var(--error-500);
                }
                .chevron {
                    color: var(--text-muted);
                }
                
                .exam-detail-header .card-body {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: var(--space-4);
                }
                .exam-detail-info h2 {
                    margin: 0 0 var(--space-1);
                }
                .exam-detail-info p {
                    margin: 0;
                    color: var(--text-secondary);
                }
                .exam-detail-stats {
                    display: flex;
                    gap: var(--space-4);
                }
                .stat-item {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    padding: var(--space-2) var(--space-4);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-md);
                    font-size: var(--font-size-sm);
                }
                .score-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 36px;
                    padding: var(--space-1) var(--space-2);
                    background: var(--success-100);
                    color: var(--success-700);
                    font-weight: var(--font-bold);
                    border-radius: var(--radius-md);
                }
                .modal-xl {
                    max-width: 900px;
                    max-height: 90vh;
                }
                .modal-subtitle {
                    margin: var(--space-1) 0 0;
                    font-size: var(--font-size-sm);
                    color: var(--text-muted);
                }
                .correction-body {
                    max-height: 60vh;
                    overflow-y: auto;
                }
                .correction-item {
                    padding: var(--space-4);
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-lg);
                    margin-bottom: var(--space-4);
                    position: relative;
                }
                .correction-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--space-3);
                }
                .correction-q-info {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                }
                .q-number {
                    font-weight: var(--font-bold);
                    color: var(--text-secondary);
                }
                .correction-points {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                }
                .points-input {
                    width: 60px;
                    padding: var(--space-2);
                    border: 2px solid var(--border-color);
                    border-radius: var(--radius-md);
                    font-size: var(--font-size-base);
                    font-weight: var(--font-bold);
                    text-align: center;
                }
                .points-input:focus {
                    border-color: var(--primary-500);
                    outline: none;
                }
                .max-points {
                    font-size: var(--font-size-sm);
                    color: var(--text-muted);
                }
                .correction-question {
                    font-weight: var(--font-medium);
                    margin-bottom: var(--space-3);
                }
                .correction-answer {
                    padding: var(--space-3);
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                }
                .answer-label {
                    display: block;
                    font-size: var(--font-size-xs);
                    color: var(--text-muted);
                    margin-bottom: var(--space-2);
                }
                .answer-content {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-1);
                }
                .answer-content .correct {
                    color: var(--success-600);
                }
                .answer-content .incorrect {
                    color: var(--error-600);
                }
                .correct-answer {
                    font-size: var(--font-size-sm);
                    color: var(--success-600);
                    font-style: italic;
                }
                .essay-answer {
                    padding: var(--space-3);
                    background: white;
                    border-radius: var(--radius-md);
                    border: 1px solid var(--border-color);
                }
                .essay-answer p {
                    margin: 0;
                    line-height: 1.6;
                }
                .matching-answer {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-2);
                }
                .match-item {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    font-size: var(--font-size-sm);
                }
                .match-item .correct {
                    color: var(--success-600);
                }
                .match-item .incorrect {
                    color: var(--error-600);
                }
                .auto-correct-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: var(--space-1);
                    position: absolute;
                    top: var(--space-3);
                    right: var(--space-3);
                    font-size: var(--font-size-xs);
                    color: var(--success-600);
                    background: var(--success-50);
                    padding: var(--space-1) var(--space-2);
                    border-radius: var(--radius-full);
                }
                .modal-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .total-score {
                    font-size: var(--font-size-lg);
                }
                .total-score strong {
                    color: var(--primary-600);
                }
                .modal-actions {
                    display: flex;
                    gap: var(--space-2);
                }
                /* Simplified Essay Grading Styles */
                .correction-body-simple {
                    padding: var(--space-4);
                    max-height: 60vh;
                    overflow-y: auto;
                }
                .essay-grading-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-4);
                }
                .essay-grading-item {
                    background: var(--gray-50);
                    border: 1px solid var(--gray-200);
                    border-radius: var(--radius-lg);
                    padding: var(--space-4);
                }
                .essay-q-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--space-2);
                }
                .essay-q-label {
                    font-weight: 600;
                    color: var(--primary-600);
                }
                .essay-max-points {
                    font-size: var(--font-size-sm);
                    color: var(--accent-600);
                    font-weight: 500;
                    background: var(--accent-50);
                    padding: var(--space-1) var(--space-2);
                    border-radius: var(--radius-full);
                }
                .essay-question-text {
                    font-size: var(--font-size-sm);
                    color: var(--gray-700);
                    margin-bottom: var(--space-3);
                    line-height: 1.5;
                }
                .essay-answer-box {
                    background: white;
                    border: 1px solid var(--gray-200);
                    border-radius: var(--radius-md);
                    padding: var(--space-3);
                    margin-bottom: var(--space-3);
                }
                .essay-answer-box strong {
                    font-size: var(--font-size-sm);
                    color: var(--gray-500);
                    display: block;
                    margin-bottom: var(--space-1);
                }
                .essay-answer-box p {
                    font-size: var(--font-size-sm);
                    color: var(--gray-800);
                    line-height: 1.6;
                    white-space: pre-wrap;
                    word-break: break-word;
                }

                .essay-score-input {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                }
                .essay-score-input label {
                    font-weight: 500;
                    font-size: var(--font-size-sm);
                    color: var(--gray-600);
                }
                .points-input-simple {
                    width: 80px;
                    text-align: center;
                    font-weight: 600;
                    font-size: var(--font-size-lg);
                }
                .points-max-label {
                    font-size: var(--font-size-sm);
                    color: var(--gray-500);
                }
                .no-essay-message {
                    text-align: center;
                    padding: var(--space-8);
                    color: var(--gray-500);
                }
                .no-essay-message p {
                    margin: var(--space-1) 0;
                }
                .total-score-simple {
                    font-size: var(--font-size-lg);
                    display: flex;
                    align-items: center;
                    gap: var(--space-1);
                }
                .total-score-simple .score-value {
                    color: var(--primary-600);
                    font-size: var(--font-size-xl);
                }
                @media (max-width: 768px) {
                    .exam-item {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    .exam-meta {
                        align-items: flex-start;
                    }
                    .exam-detail-stats {
                        flex-wrap: wrap;
                    }
                }
            `}</style>
        </DashboardLayout>
    )
}

export default KoreksiUjianPage
