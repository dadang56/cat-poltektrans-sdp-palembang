import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../App'
import { SEBService, AntiCheat } from '../../services/SEBService'
import { jadwalService, matkulService, soalService, hasilUjianService, isSupabaseConfigured } from '../../services/supabaseService'
import {
    Clock,
    ChevronLeft,
    ChevronRight,
    Flag,
    Send,
    AlertTriangle,
    CheckCircle,
    Circle,
    FileText,
    Maximize,
    X,
    Shield,
    ShieldAlert,
    Monitor
} from 'lucide-react'
import './TakeExam.css'

// LocalStorage keys
const JADWAL_STORAGE_KEY = 'cat_jadwal_data'
const MATKUL_STORAGE_KEY = 'cat_matkul_data'
const SOAL_STORAGE_KEY = 'cat_soal_data'
const SETTINGS_STORAGE_KEY = 'cat_settings_data'

// Default anti-cheat settings
const DEFAULT_ANTICHEAT_SETTINGS = {
    requireSEB: false,
    maxWarnings: 5,
    antiCheatLevel: 'medium' // low, medium, high
}

function TakeExamPage() {
    const { user } = useAuth()
    const { id } = useParams()
    const navigate = useNavigate()

    // Exam data from localStorage
    const [examData, setExamData] = useState(null)
    const [questions, setQuestions] = useState([])
    const [loading, setLoading] = useState(true)

    // Exam state
    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [answers, setAnswers] = useState({})
    const [flagged, setFlagged] = useState(new Set())
    const [timeLeft, setTimeLeft] = useState(0)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [showWarning, setShowWarning] = useState(false)
    const [warningCount, setWarningCount] = useState(0)
    const [submitted, setSubmitted] = useState(false)
    const [showConfirmSubmit, setShowConfirmSubmit] = useState(false)
    const [showNavigator, setShowNavigator] = useState(false)
    const [examStartTime, setExamStartTime] = useState(null) // actual waktu_mulai
    const [existingHasilId, setExistingHasilId] = useState(null) // for resume

    // SEB & Anti-Cheat state
    const [sebDetected, setSebDetected] = useState(false)
    const [platformInfo, setPlatformInfo] = useState(null)
    const [sebRequired, setSebRequired] = useState(false)
    const [showSEBWarning, setShowSEBWarning] = useState(false)
    const [lockdownActive, setLockdownActive] = useState(false)
    const [violations, setViolations] = useState([])
    const [antiCheatSettings, setAntiCheatSettings] = useState(DEFAULT_ANTICHEAT_SETTINGS)

    // Load exam from Supabase (with localStorage fallback)
    useEffect(() => {
        const loadExamData = async () => {
            console.log('TakeExam: Loading exam with id:', id, 'type:', typeof id)

            try {
                let jadwal = null
                let matkulList = []
                let allSoal = []

                if (isSupabaseConfigured()) {
                    // Load from Supabase
                    const [jadwalData, matkulData] = await Promise.all([
                        jadwalService.getAll(),
                        matkulService.getAll()
                    ])
                    jadwal = jadwalData.find(j => String(j.id) === String(id))
                    matkulList = matkulData

                    if (jadwal) {
                        const matkulId = jadwal.matkul_id || jadwal.matkulId
                        const examType = (jadwal.tipe || jadwal.tipe_ujian || jadwal.tipeUjian || '').toUpperCase()

                        allSoal = await soalService.getAll({ matkul_id: matkulId })
                        allSoal = allSoal.filter(s => {
                            if (!s.tipe_ujian) return true
                            return s.tipe_ujian.toUpperCase() === examType
                        })

                        console.log('TakeExam: Supabase soal found:', allSoal.length, 'for matkulId:', matkulId, 'examType:', examType)
                    }
                } else {
                    // Fallback to localStorage
                    const jadwalData = localStorage.getItem(JADWAL_STORAGE_KEY)
                    const matkulData = localStorage.getItem(MATKUL_STORAGE_KEY)
                    const soalData = localStorage.getItem(SOAL_STORAGE_KEY)

                    if (jadwalData) {
                        const jadwalList = JSON.parse(jadwalData)
                        jadwal = jadwalList.find(j => String(j.id) === String(id))
                    }
                    matkulList = matkulData ? JSON.parse(matkulData) : []
                    allSoal = soalData ? JSON.parse(soalData) : []

                    if (jadwal) {
                        const examType = jadwal.tipeUjian?.toUpperCase()
                        allSoal = allSoal.filter(s => {
                            const soalMatkulMatch = s.matkulId === jadwal.matkulId
                            if (!s.examType) return soalMatkulMatch
                            return soalMatkulMatch && s.examType.toUpperCase() === examType
                        })
                    }
                }

                console.log('TakeExam: Found jadwal:', jadwal)

                if (jadwal) {
                    const matkulId = jadwal.matkul_id || jadwal.matkulId
                    const matkul = matkulList.find(m => String(m.id) === String(matkulId))
                    const waktuMulai = jadwal.waktu_mulai || jadwal.waktuMulai
                    const waktuSelesai = jadwal.waktu_selesai || jadwal.waktuSelesai
                    const tipeUjian = jadwal.tipe || jadwal.tipe_ujian || jadwal.tipeUjian || 'UTS'
                    const durasiMenit = jadwal.durasi || 90 // personal duration in minutes

                    // Map soal to questions format
                    const examSoal = allSoal.map(s => ({
                        id: s.id,
                        type: s.tipe_soal || s.type,
                        text: s.pertanyaan || s.text,
                        points: s.bobot || s.points || 10,
                        options: (s.pilihan || s.options || []).map(o => typeof o === 'string' ? o : o.text),
                        correctAnswer: s.jawaban_benar || s.correctAnswer,
                        image: s.gambar || null
                    }))

                    console.log('TakeExam: Processed', examSoal.length, 'questions')

                    // ========================================
                    // RESUME LOGIC: Check for existing session
                    // ========================================
                    let resumedAnswers = {}
                    let personalStartTime = null
                    let hasilId = null

                    if (isSupabaseConfigured() && user?.id) {
                        try {
                            const existingHasil = await hasilUjianService.getByJadwalAndMahasiswa(jadwal.id, user.id)

                            if (existingHasil) {
                                hasilId = existingHasil.id
                                setExistingHasilId(existingHasil.id)

                                if (existingHasil.status === 'submitted' || existingHasil.status === 'graded') {
                                    // Exam already completed — block re-entry
                                    console.log('[TakeExam] Exam already submitted, blocking re-entry')
                                    setExamData({
                                        id: jadwal.id,
                                        name: `${tipeUjian} ${matkul?.nama || 'Ujian'}`,
                                        duration: durasiMenit,
                                        matkulName: matkul?.nama || 'N/A',
                                        dosenName: jadwal.dosen?.nama || '-'
                                    })
                                    setSubmitted(true)
                                    setQuestions(examSoal)
                                    setLoading(false)
                                    return
                                }

                                if (existingHasil.status === 'in_progress') {
                                    // RESUME: load saved answers and calculate remaining time
                                    personalStartTime = new Date(existingHasil.waktu_mulai)
                                    console.log('[TakeExam] Resuming exam, started at:', personalStartTime)

                                    // Load saved answers
                                    if (existingHasil.answers_detail) {
                                        try {
                                            const savedDetails = typeof existingHasil.answers_detail === 'string'
                                                ? JSON.parse(existingHasil.answers_detail)
                                                : existingHasil.answers_detail
                                            if (Array.isArray(savedDetails)) {
                                                savedDetails.forEach(a => {
                                                    if (a.answer !== null && a.answer !== undefined) {
                                                        resumedAnswers[a.questionId] = a.answer
                                                    }
                                                })
                                                console.log('[TakeExam] Resumed', Object.keys(resumedAnswers).length, 'answers')
                                            }
                                        } catch (e) {
                                            console.error('[TakeExam] Error parsing saved answers:', e)
                                        }
                                    }
                                }
                            }
                        } catch (err) {
                            console.error('[TakeExam] Error checking existing session:', err)
                        }
                    }

                    // Set exam data
                    setExamData({
                        id: jadwal.id,
                        name: `${tipeUjian} ${matkul?.nama || 'Ujian'}`,
                        duration: durasiMenit,
                        matkulName: matkul?.nama || 'N/A',
                        dosenName: jadwal.dosen?.nama || '-'
                    })
                    setQuestions(examSoal)

                    // Set resumed answers if any
                    if (Object.keys(resumedAnswers).length > 0) {
                        setAnswers(resumedAnswers)
                    }

                    // ===========================
                    // TIMER: Personal duration
                    // ===========================
                    const now = new Date()
                    const windowStart = new Date(`${jadwal.tanggal}T${waktuMulai}`)
                    const windowEnd = new Date(`${jadwal.tanggal}T${waktuSelesai}`)

                    if (personalStartTime) {
                        // RESUME: calculate remaining from personal start
                        const elapsedSeconds = Math.floor((now - personalStartTime) / 1000)
                        const totalDurationSeconds = durasiMenit * 60
                        const remainingSeconds = Math.max(0, totalDurationSeconds - elapsedSeconds)
                        setExamStartTime(personalStartTime)
                        setTimeLeft(remainingSeconds)

                        if (remainingSeconds <= 0) {
                            // Duration expired while away — auto-submit
                            console.log('[TakeExam] Duration expired during absence, auto-submitting')
                            setSubmitted(true)
                        }
                    } else {
                        // NEW session: record start time
                        const startNow = new Date()
                        setExamStartTime(startNow)
                        setTimeLeft(durasiMenit * 60)

                        if (isSupabaseConfigured() && user?.id) {
                            try {
                                const result = await hasilUjianService.upsert({
                                    jadwal_id: jadwal.id,
                                    mahasiswa_id: user.id,
                                    status: 'in_progress',
                                    waktu_mulai: startNow.toISOString()
                                })
                                if (result?.id) setExistingHasilId(result.id)
                                console.log('[TakeExam] New exam session recorded')
                            } catch (err) {
                                console.error('[TakeExam] Error recording exam start:', err)
                            }
                        }
                    }
                } else {
                    console.log('TakeExam: No jadwal found for id:', id)
                }
            } catch (error) {
                console.error('TakeExam: Error loading exam data:', error)
            }

            setLoading(false)
        }

        if (id) loadExamData()
    }, [id, user])

    // SEB Detection & Anti-Cheat Initialization
    useEffect(() => {
        // Detect SEB and platform
        const isSEB = SEBService.isSEBBrowser()
        const platform = SEBService.detectPlatform()
        setSebDetected(isSEB)
        setPlatformInfo(platform)

        console.log('[TakeExam] SEB Detection:', { isSEB, platform })

        // Load anti-cheat settings
        const settingsData = localStorage.getItem(SETTINGS_STORAGE_KEY)
        if (settingsData) {
            try {
                const settings = JSON.parse(settingsData)
                const acSettings = {
                    requireSEB: settings.requireSEB || false,
                    maxWarnings: settings.maxWarnings || 5,
                    antiCheatLevel: settings.antiCheatLevel || 'medium'
                }
                setAntiCheatSettings(acSettings)
                setSebRequired(acSettings.requireSEB)

                // Show SEB warning if required but not detected
                if (acSettings.requireSEB && !isSEB) {
                    setShowSEBWarning(true)
                }
            } catch (e) {
                console.error('Error loading settings:', e)
            }
        }

        // Initialize AntiCheat if not submitted
        if (!submitted) {
            AntiCheat.init({
                maxWarnings: antiCheatSettings.maxWarnings,
                level: antiCheatSettings.antiCheatLevel || 'medium',
                onViolation: (violation, count) => {
                    setViolations(prev => [...prev, violation])
                    setWarningCount(count)
                    setShowWarning(true)

                    // Auto-submit if max warnings reached
                    if (count >= antiCheatSettings.maxWarnings) {
                        console.warn('[TakeExam] Max warnings reached, auto-submitting')
                        handleSubmit()
                    }
                },
                onLockdownChange: (locked) => {
                    setLockdownActive(locked)
                }
            })
        }

        // Try to enter fullscreen on exam start (medium = optional, high = enforced)
        if (antiCheatSettings.antiCheatLevel === 'high' || antiCheatSettings.antiCheatLevel === 'medium') {
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                AntiCheat.requestFullscreen()
            }, 500)
        }

        // Cleanup on unmount
        return () => {
            AntiCheat.destroy()
        }
    }, [submitted])

    // Timer effect
    useEffect(() => {
        if (submitted || timeLeft <= 0 || loading) return

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    handleSubmit()
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [submitted, timeLeft, loading])

    // Auto-save answers to Supabase every 30 seconds
    useEffect(() => {
        if (submitted || loading || !examData?.id || !user?.id || questions.length === 0) return
        if (!isSupabaseConfigured()) return

        const autoSaveInterval = setInterval(async () => {
            try {
                const answerSnapshot = questions.map(q => ({
                    questionId: q.id,
                    type: q.type,
                    answer: answers[q.id] ?? null
                }))

                await hasilUjianService.upsert({
                    jadwal_id: examData.id,
                    mahasiswa_id: user.id,
                    status: 'in_progress',
                    answers_detail: JSON.stringify(answerSnapshot)
                })
                console.log('[TakeExam] Auto-saved', Object.keys(answers).length, 'answers')
            } catch (err) {
                console.error('[TakeExam] Auto-save failed:', err)
            }
        }, 30000)

        return () => clearInterval(autoSaveInterval)
    }, [submitted, loading, examData, user, questions, answers])

    // Check for kicked status (pengawas can kick students during exam)
    useEffect(() => {
        if (submitted || !isSupabaseConfigured() || !user?.id || !id) return

        const checkKickedStatus = async () => {
            try {
                const results = await hasilUjianService.getByMahasiswa(user.id)
                const currentResult = results.find(r => String(r.jadwal_id) === String(id))

                if (currentResult?.status === 'kicked') {
                    alert('Anda telah dikeluarkan dari ujian oleh pengawas.')
                    navigate('/mahasiswa/dashboard')
                }
            } catch (error) {
                console.error('[TakeExam] Error checking kicked status:', error)
            }
        }

        // Check immediately
        checkKickedStatus()

        // Then check every 10 seconds
        const kickCheckInterval = setInterval(checkKickedStatus, 10000)

        return () => clearInterval(kickCheckInterval)
    }, [submitted, user, id, navigate])

    // Format time
    const formatTime = (seconds) => {
        const hrs = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    // Note: Anti-cheat is now handled by AntiCheat service in SEBService.js

    // Fullscreen toggle
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }, [])

    // Answer handlers
    const handleAnswer = (value) => {
        if (questions[currentQuestion]) {
            setAnswers(prev => ({
                ...prev,
                [questions[currentQuestion].id]: value
            }))
        }
    }

    const toggleFlag = () => {
        const qId = questions[currentQuestion]?.id
        if (qId) {
            setFlagged(prev => {
                const newFlagged = new Set(prev)
                if (newFlagged.has(qId)) {
                    newFlagged.delete(qId)
                } else {
                    newFlagged.add(qId)
                }
                return newFlagged
            })
        }
    }

    const goToQuestion = (index) => {
        setCurrentQuestion(index)
        setShowNavigator(false)
    }

    const handleSubmit = () => {
        setSubmitted(true)
        setShowConfirmSubmit(false)

        // Calculate score
        let totalScore = 0
        let maxScore = 0
        const answerDetails = questions.map(q => {
            maxScore += q.points
            let earned = 0
            let isCorrect = false

            if (q.type === 'pilihan_ganda' && answers[q.id] !== undefined) {
                if (answers[q.id] === q.correctAnswer) {
                    earned = q.points
                    isCorrect = true
                }
            } else if (q.type === 'benar_salah' && answers[q.id] !== undefined) {
                if (answers[q.id] === q.correctAnswer) {
                    earned = q.points
                    isCorrect = true
                }
            }
            // Essay questions need manual grading, set earnedPoints to null
            const needsManualGrading = q.type === 'essay'

            totalScore += earned

            return {
                questionId: q.id,
                type: q.type,
                answer: answers[q.id] ?? null,
                correctAnswer: q.correctAnswer,
                maxPoints: q.points,
                earnedPoints: needsManualGrading ? null : earned,
                isCorrect: needsManualGrading ? null : isCorrect,
                needsManualGrading
            }
        })

        // Create exam result object
        const examResult = {
            id: Date.now(),
            examId: examData.id,
            examName: examData.name,
            matkulName: examData.matkulName,
            mahasiswaId: user?.id,
            mahasiswaName: user?.name || user?.nama,
            nim: user?.nim,
            kelasId: user?.kelasId,
            answers: answerDetails,
            totalScore: totalScore,
            maxScore: maxScore,
            hasEssay: answerDetails.some(a => a.needsManualGrading),
            isFullyCorrected: !answerDetails.some(a => a.needsManualGrading),
            warningCount: warningCount,
            submittedAt: new Date().toISOString(),
            submittedAtDisplay: new Date().toLocaleString('id-ID')
        }

        // Save to Supabase (primary) and localStorage (fallback)
        const saveExamResult = async () => {
            // Count statistics
            const jumlahBenar = answerDetails.filter(a => a.isCorrect === true).length
            const jumlahSalah = answerDetails.filter(a => a.isCorrect === false).length
            const jumlahKosong = answerDetails.filter(a => a.answer === null).length

            if (isSupabaseConfigured()) {
                try {
                    // Save to hasil_ujian table
                    const hasilData = {
                        jadwal_id: examData.id,
                        mahasiswa_id: user?.id,
                        nilai_total: totalScore,
                        jumlah_benar: jumlahBenar,
                        jumlah_salah: jumlahSalah,
                        jumlah_kosong: jumlahKosong,
                        waktu_mulai: examStartTime ? examStartTime.toISOString() : new Date(Date.now() - (examData.duration * 60 * 1000)).toISOString(),
                        waktu_selesai: new Date().toISOString(),
                        status: answerDetails.some(a => a.needsManualGrading) ? 'submitted' : 'graded',
                        // Store detailed answers as JSON
                        answers_detail: JSON.stringify(answerDetails)
                    }

                    await hasilUjianService.upsert(hasilData)
                    console.log('[TakeExam] Exam result saved to Supabase:', hasilData)
                } catch (error) {
                    console.error('[TakeExam] Error saving to Supabase:', error)
                }
            }

            // Also save to localStorage for compatibility
            const EXAM_RESULTS_KEY = 'cat_exam_results'
            const existingResults = JSON.parse(localStorage.getItem(EXAM_RESULTS_KEY) || '[]')
            const alreadySubmitted = existingResults.some(r =>
                r.examId === examResult.examId && r.mahasiswaId === examResult.mahasiswaId
            )

            if (!alreadySubmitted) {
                existingResults.push(examResult)
                localStorage.setItem(EXAM_RESULTS_KEY, JSON.stringify(existingResults))
            }
        }

        saveExamResult()
    }

    // Calculate score for display
    const calculateScore = () => {
        let score = 0
        let total = 0
        questions.forEach(q => {
            total += q.points
            // Simple scoring for multiple choice
            if (q.type === 'pilihan_ganda' && answers[q.id] !== undefined) {
                // Check if answer matches correct answer index
                if (answers[q.id] === q.correctAnswer) score += q.points
            }
            if (q.type === 'benar_salah' && answers[q.id] !== undefined) {
                if (answers[q.id] === q.correctAnswer) score += q.points
            }
        })
        return { score, total }
    }

    // Loading state
    if (loading) {
        return (
            <div className="exam-loading">
                <div className="spinner-lg"></div>
                <p>Memuat ujian...</p>
            </div>
        )
    }

    // No exam or no questions
    if (!examData || questions.length === 0) {
        return (
            <div className="exam-error">
                <AlertTriangle size={64} />
                <h2>Ujian Tidak Tersedia</h2>
                <p>Tidak ada soal untuk ujian ini atau jadwal tidak ditemukan.</p>
                <button className="btn btn-primary" onClick={() => navigate('/mahasiswa')}>
                    Kembali ke Dashboard
                </button>
            </div>
        )
    }

    const question = questions[currentQuestion]
    const totalQuestions = questions.length
    const answeredCount = Object.keys(answers).length
    const flaggedCount = flagged.size

    if (submitted) {
        const { score, total } = calculateScore()
        return (
            <div className="exam-result-page">
                <div className="result-card animate-scaleIn">
                    <div className="result-icon success">
                        <CheckCircle size={64} />
                    </div>
                    <h1>Ujian Selesai!</h1>
                    <p className="result-exam-name">{examData.name}</p>

                    <div className="result-stats">
                        <div className="result-stat">
                            <span className="result-stat-value">{answeredCount}/{totalQuestions}</span>
                            <span className="result-stat-label">Soal Dijawab</span>
                        </div>
                        <div className="result-stat">
                            <span className="result-stat-value">{formatTime(examData.duration * 60 - timeLeft)}</span>
                            <span className="result-stat-label">Waktu Pengerjaan</span>
                        </div>
                        <div className="result-stat">
                            <span className="result-stat-value">{warningCount}</span>
                            <span className="result-stat-label">Peringatan</span>
                        </div>
                    </div>

                    <div className="result-score">
                        <span className="score-label">Skor Sementara</span>
                        <span className="score-value">{score}</span>
                        <span className="score-total">/ {total}</span>
                    </div>

                    <p className="result-note">
                        Hasil akhir akan diumumkan setelah semua jawaban essay dikoreksi oleh dosen.
                    </p>

                    <a href="/mahasiswa" className="btn btn-primary btn-lg">
                        Kembali ke Dashboard
                    </a>
                </div>
            </div>
        )
    }

    return (
        <div className="take-exam-page">
            {/* SEB Required Modal */}
            {showSEBWarning && sebRequired && (
                <div className="warning-overlay">
                    <div className="seb-required-modal animate-scaleIn">
                        <ShieldAlert size={64} className="seb-warning-icon" />
                        <h2>Safe Exam Browser Diperlukan</h2>
                        <p>Ujian ini wajib menggunakan Safe Exam Browser.</p>
                        <p>Browser yang terdeteksi: <strong>{platformInfo?.browser || 'Unknown'}</strong></p>

                        <div className="seb-instructions">
                            <h4>Langkah-langkah:</h4>
                            <ol>
                                <li>Download Safe Exam Browser dari halaman panduan</li>
                                <li>Install dan buka SEB</li>
                                <li>Masukkan URL: <code>{window.location.origin}</code></li>
                                <li>Login dan akses ujian kembali</li>
                            </ol>
                        </div>

                        <div className="seb-modal-actions">
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate('/mahasiswa/seb-instructions')}
                            >
                                <Shield size={18} />
                                Lihat Panduan SEB
                            </button>
                            <button
                                className="btn btn-outline"
                                onClick={() => setShowSEBWarning(false)}
                            >
                                Lanjutkan Tanpa SEB (Dengan Risiko)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lockdown Overlay — shown when student exits fullscreen in high mode */}
            {lockdownActive && (
                <div className="lockdown-overlay">
                    <div className="lockdown-content animate-scaleIn">
                        <ShieldAlert size={80} className="lockdown-icon" />
                        <h2>⚠️ Mode Ujian Terkunci</h2>
                        <p>Anda keluar dari mode fullscreen.</p>
                        <p>Soal ujian tersembunyi untuk keamanan.</p>
                        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.5rem' }}>
                            Peringatan ke-{warningCount} dari {antiCheatSettings.maxWarnings}
                        </p>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={() => AntiCheat.requestFullscreen()}
                            style={{ marginTop: '1.5rem', fontSize: '1.1rem', padding: '0.75rem 2rem' }}
                        >
                            <Maximize size={20} />
                            Kembali ke Ujian (Fullscreen)
                        </button>
                    </div>
                </div>
            )}

            {/* Warning Modal */}
            {showWarning && (
                <div className="warning-overlay">
                    <div className="warning-modal animate-shake">
                        <AlertTriangle size={48} className="warning-icon" />
                        <h2>Peringatan!</h2>
                        <p>Anda terdeteksi melakukan aktivitas mencurigakan.</p>
                        <p>Peringatan ke-{warningCount} dari {antiCheatSettings.maxWarnings}.</p>
                        <p className="warning-note">Aktivitas ini akan dilaporkan ke pengawas.</p>
                        {warningCount >= antiCheatSettings.maxWarnings - 1 && (
                            <p className="warning-critical">
                                <strong>⚠️ Peringatan terakhir! Pelanggaran berikutnya akan mengakhiri ujian.</strong>
                            </p>
                        )}
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowWarning(false)}
                        >
                            Saya Mengerti
                        </button>
                    </div>
                </div>
            )}

            {/* Confirm Submit Modal */}
            {showConfirmSubmit && (
                <div className="modal-overlay">
                    <div className="modal animate-scaleIn">
                        <div className="modal-header">
                            <h3>Konfirmasi Submit</h3>
                            <button className="btn btn-icon btn-ghost" onClick={() => setShowConfirmSubmit(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>Apakah Anda yakin ingin mengakhiri ujian?</p>
                            <div className="submit-summary">
                                <div className="summary-item">
                                    <span>Soal dijawab:</span>
                                    <span>{answeredCount} dari {totalQuestions}</span>
                                </div>
                                <div className="summary-item">
                                    <span>Soal ditandai:</span>
                                    <span>{flaggedCount}</span>
                                </div>
                                <div className="summary-item">
                                    <span>Sisa waktu:</span>
                                    <span>{formatTime(timeLeft)}</span>
                                </div>
                            </div>
                            {answeredCount < totalQuestions && (
                                <div className="warning-text">
                                    <AlertTriangle size={16} />
                                    <span>Masih ada {totalQuestions - answeredCount} soal yang belum dijawab!</span>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowConfirmSubmit(false)}>
                                Kembali
                            </button>
                            <button className="btn btn-primary" onClick={handleSubmit}>
                                <Send size={16} />
                                Submit Ujian
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="exam-header">
                <div className="exam-info">
                    <h1>{examData.name}</h1>
                    <span className="exam-student">{user?.name} • {user?.nim}</span>
                </div>
                <div className="exam-timer-container">
                    {/* Security Status Badge */}
                    <div className={`security-badge ${warningCount > 0 ? 'has-warnings' : 'secure'}`}
                        title={`Anti-Cheat: ${antiCheatSettings.antiCheatLevel?.toUpperCase()} | Peringatan: ${warningCount}/${antiCheatSettings.maxWarnings}`}
                    >
                        <Shield size={14} />
                        <span>{warningCount > 0 ? `${warningCount}⚠` : '✓'}</span>
                    </div>
                    <div className={`exam-timer ${timeLeft < 300 ? 'warning' : ''} ${timeLeft < 60 ? 'danger' : ''}`}>
                        <Clock size={20} />
                        <span>{formatTime(timeLeft)}</span>
                    </div>
                    <button
                        className="btn btn-icon btn-ghost"
                        onClick={toggleFullscreen}
                        title="Fullscreen"
                    >
                        <Maximize size={20} />
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="exam-content">
                {/* Question Navigator (Mobile Toggle) */}
                <button
                    className="navigator-toggle"
                    onClick={() => setShowNavigator(!showNavigator)}
                >
                    Navigasi Soal ({answeredCount}/{totalQuestions})
                </button>

                {/* Question Navigator */}
                <aside className={`question-navigator ${showNavigator ? 'open' : ''}`}>
                    <div className="navigator-header">
                        <h3>Navigasi Soal</h3>
                        <button
                            className="btn btn-icon btn-ghost navigator-close"
                            onClick={() => setShowNavigator(false)}
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <div className="question-grid">
                        {questions.map((q, index) => (
                            <button
                                key={q.id}
                                className={`question-number-btn 
                  ${currentQuestion === index ? 'current' : ''} 
                  ${answers[q.id] !== undefined ? 'answered' : ''} 
                  ${flagged.has(q.id) ? 'flagged' : ''}
                `}
                                onClick={() => goToQuestion(index)}
                            >
                                {index + 1}
                                {flagged.has(q.id) && <Flag size={10} className="flag-icon" />}
                            </button>
                        ))}
                    </div>
                    <div className="navigator-legend">
                        <div className="legend-item">
                            <span className="legend-dot current"></span>
                            <span>Sekarang</span>
                        </div>
                        <div className="legend-item">
                            <span className="legend-dot answered"></span>
                            <span>Dijawab</span>
                        </div>
                        <div className="legend-item">
                            <span className="legend-dot flagged"></span>
                            <span>Ditandai</span>
                        </div>
                        <div className="legend-item">
                            <span className="legend-dot"></span>
                            <span>Belum</span>
                        </div>
                    </div>
                    <div className="navigator-stats">
                        <div>Dijawab: <strong>{answeredCount}/{totalQuestions}</strong></div>
                        <div>Ditandai: <strong>{flaggedCount}</strong></div>
                    </div>
                </aside>

                {/* Question Area */}
                <main className="question-area">
                    <div className="question-card">
                        <div className="question-header">
                            <div className="question-meta">
                                <span className="question-number">Soal {currentQuestion + 1} dari {totalQuestions}</span>
                                <span className={`badge badge-${question.type === 'pilihan_ganda' ? 'primary' :
                                    (question.type === 'essay' || question.type === 'uraian') ? 'accent' : 'success'
                                    }`}>
                                    {question.type === 'pilihan_ganda' ? 'Pilihan Ganda' :
                                        (question.type === 'essay' || question.type === 'uraian') ? 'Essay' :
                                            question.type === 'benar_salah' ? 'Benar/Salah' : 'Menjodohkan'}
                                </span>
                                <span className="question-points">{question.points} poin</span>
                            </div>
                            <button
                                className={`flag-btn ${flagged.has(question.id) ? 'flagged' : ''}`}
                                onClick={toggleFlag}
                            >
                                <Flag size={18} />
                                {flagged.has(question.id) ? 'Ditandai' : 'Tandai'}
                            </button>
                        </div>

                        <div className="question-text">
                            <p>{question.text}</p>
                            {question.image && (
                                <img src={question.image} alt="Soal" className="question-image" />
                            )}
                        </div>

                        <div className="answer-area">
                            {question.type === 'pilihan_ganda' && (
                                <div className="options-list">
                                    {question.options.map((option, index) => (
                                        <label
                                            key={index}
                                            className={`option-item ${answers[question.id] === index ? 'selected' : ''}`}
                                        >
                                            <input
                                                type="radio"
                                                name={`question-${question.id}`}
                                                checked={answers[question.id] === index}
                                                onChange={() => handleAnswer(index)}
                                            />
                                            <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                                            <span className="option-text">{option}</span>
                                            {answers[question.id] === index && (
                                                <CheckCircle size={20} className="option-check" />
                                            )}
                                        </label>
                                    ))}
                                </div>
                            )}

                            {question.type === 'benar_salah' && (
                                <div className="true-false-options">
                                    <label className={`tf-option ${answers[question.id] === true ? 'selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name={`question-${question.id}`}
                                            checked={answers[question.id] === true}
                                            onChange={() => handleAnswer(true)}
                                        />
                                        <CheckCircle size={24} />
                                        <span>Benar</span>
                                    </label>
                                    <label className={`tf-option ${answers[question.id] === false ? 'selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name={`question-${question.id}`}
                                            checked={answers[question.id] === false}
                                            onChange={() => handleAnswer(false)}
                                        />
                                        <X size={24} />
                                        <span>Salah</span>
                                    </label>
                                </div>
                            )}

                            {(question.type === 'essay' || question.type === 'uraian') && (
                                <div className="essay-area">
                                    <textarea
                                        className="essay-input"
                                        placeholder="Tulis jawaban Anda di sini..."
                                        value={answers[question.id] || ''}
                                        onChange={(e) => handleAnswer(e.target.value)}
                                        rows={8}
                                    />
                                    <div className="essay-info">
                                        <FileText size={14} />
                                        <span>{(answers[question.id] || '').length} karakter</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="question-navigation">
                        <button
                            className="btn btn-outline"
                            disabled={currentQuestion === 0}
                            onClick={() => setCurrentQuestion(prev => prev - 1)}
                        >
                            <ChevronLeft size={18} />
                            Sebelumnya
                        </button>

                        {currentQuestion < totalQuestions - 1 ? (
                            <button
                                className="btn btn-primary"
                                onClick={() => setCurrentQuestion(prev => prev + 1)}
                            >
                                Selanjutnya
                                <ChevronRight size={18} />
                            </button>
                        ) : (
                            <button
                                className="btn btn-accent"
                                onClick={() => setShowConfirmSubmit(true)}
                            >
                                <Send size={18} />
                                Submit Ujian
                            </button>
                        )}
                    </div>
                </main>
            </div>

            <style>{`
                .exam-loading, .exam-error {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    gap: 1rem;
                    text-align: center;
                    padding: 2rem;
                }
                .exam-error svg {
                    color: var(--warning);
                }
                .question-image {
                    max-width: 100%;
                    max-height: 300px;
                    margin-top: 1rem;
                    border-radius: 0.5rem;
                }
            `}</style>
        </div>
    )
}

export default TakeExamPage
