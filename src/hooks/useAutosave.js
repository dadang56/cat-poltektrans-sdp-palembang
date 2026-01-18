import { useState, useEffect, useRef, useCallback } from 'react'
import { jawabanMahasiswaService, isSupabaseConfigured } from '../services/supabaseService'

/**
 * Autosave Hook for Exam Answers
 * 
 * Features:
 * - Debounced autosave (configurable delay)
 * - Exponential backoff retry (max 3 attempts)
 * - Offline queue with localStorage backup
 * - Online/offline status detection
 * - Optimistic updates with rollback
 */

const OFFLINE_QUEUE_KEY = 'cat_offline_queue'
const LOCAL_ANSWERS_KEY = 'cat_exam_answers'

export const SaveStatus = {
    IDLE: 'idle',
    SAVING: 'saving',
    SAVED: 'saved',
    ERROR: 'error',
    OFFLINE: 'offline',
    PENDING: 'pending'
}

export function useAutosave({
    jadwalId,
    mahasiswaId,
    debounceMs = 5000,
    maxRetries = 3,
    onSaveSuccess,
    onSaveError
}) {
    const [saveStatus, setSaveStatus] = useState(SaveStatus.IDLE)
    const [lastSaved, setLastSaved] = useState(null)
    const [pendingChanges, setPendingChanges] = useState({})
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [retryCount, setRetryCount] = useState(0)

    const debounceTimer = useRef(null)
    const retryTimer = useRef(null)

    // Monitor online/offline status
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true)
            // Sync pending changes when back online
            syncOfflineQueue()
        }

        const handleOffline = () => {
            setIsOnline(false)
            setSaveStatus(SaveStatus.OFFLINE)
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    // Load pending changes from localStorage on mount
    useEffect(() => {
        const savedAnswers = localStorage.getItem(`${LOCAL_ANSWERS_KEY}_${jadwalId}_${mahasiswaId}`)
        if (savedAnswers) {
            try {
                const answers = JSON.parse(savedAnswers)
                setPendingChanges(answers)
            } catch (e) {
                console.error('[useAutosave] Error loading saved answers:', e)
            }
        }
    }, [jadwalId, mahasiswaId])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current)
            if (retryTimer.current) clearTimeout(retryTimer.current)
        }
    }, [])

    /**
     * Queue an answer change for autosave
     */
    const queueChange = useCallback((soalId, jawaban) => {
        const change = {
            jadwal_id: jadwalId,
            mahasiswa_id: mahasiswaId,
            soal_id: soalId,
            jawaban,
            answered_at: new Date().toISOString(),
            _localVersion: Date.now()
        }

        // Update pending changes
        setPendingChanges(prev => {
            const updated = { ...prev, [soalId]: change }
            // Save to localStorage for offline backup
            localStorage.setItem(
                `${LOCAL_ANSWERS_KEY}_${jadwalId}_${mahasiswaId}`,
                JSON.stringify(updated)
            )
            return updated
        })

        setSaveStatus(isOnline ? SaveStatus.PENDING : SaveStatus.OFFLINE)

        // Debounce the save
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        debounceTimer.current = setTimeout(() => {
            saveChanges()
        }, debounceMs)
    }, [jadwalId, mahasiswaId, debounceMs, isOnline])

    /**
     * Force save immediately (e.g., on submit)
     */
    const forceSave = useCallback(async () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        return await saveChanges()
    }, [])

    /**
     * Save pending changes to Supabase
     */
    const saveChanges = async () => {
        const changes = Object.values(pendingChanges)
        if (changes.length === 0) {
            setSaveStatus(SaveStatus.IDLE)
            return { success: true }
        }

        if (!isOnline) {
            addToOfflineQueue(changes)
            setSaveStatus(SaveStatus.OFFLINE)
            return { success: false, error: 'offline' }
        }

        if (!isSupabaseConfigured()) {
            // In demo mode, just mark as saved
            setSaveStatus(SaveStatus.SAVED)
            setLastSaved(new Date())
            setPendingChanges({})
            return { success: true }
        }

        setSaveStatus(SaveStatus.SAVING)

        try {
            // Prepare data for upsert
            const upsertData = changes.map(change => ({
                jadwal_id: change.jadwal_id,
                mahasiswa_id: change.mahasiswa_id,
                soal_id: change.soal_id,
                jawaban: typeof change.jawaban === 'object'
                    ? change.jawaban
                    : { value: change.jawaban },
                answered_at: change.answered_at
            }))

            await jawabanMahasiswaService.bulkUpsert(upsertData)

            // Success
            setSaveStatus(SaveStatus.SAVED)
            setLastSaved(new Date())
            setRetryCount(0)
            setPendingChanges({})

            // Clear localStorage backup
            localStorage.removeItem(`${LOCAL_ANSWERS_KEY}_${jadwalId}_${mahasiswaId}`)

            onSaveSuccess?.()
            return { success: true }

        } catch (error) {
            console.error('[useAutosave] Save error:', error)
            setSaveStatus(SaveStatus.ERROR)

            // Retry with exponential backoff
            if (retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
                setRetryCount(prev => prev + 1)
                retryTimer.current = setTimeout(saveChanges, delay)
            } else {
                // Max retries reached, add to offline queue
                addToOfflineQueue(Object.values(pendingChanges))
                onSaveError?.(error)
            }

            return { success: false, error }
        }
    }

    /**
     * Add changes to offline queue
     */
    const addToOfflineQueue = (changes) => {
        const queue = getOfflineQueue()
        const queueKey = `${jadwalId}_${mahasiswaId}`

        queue[queueKey] = {
            jadwalId,
            mahasiswaId,
            changes,
            timestamp: Date.now()
        }

        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
    }

    /**
     * Get offline queue from localStorage
     */
    const getOfflineQueue = () => {
        try {
            const queue = localStorage.getItem(OFFLINE_QUEUE_KEY)
            return queue ? JSON.parse(queue) : {}
        } catch (e) {
            return {}
        }
    }

    /**
     * Sync offline queue when back online
     */
    const syncOfflineQueue = async () => {
        if (!isSupabaseConfigured()) return

        const queue = getOfflineQueue()
        const keys = Object.keys(queue)

        for (const key of keys) {
            const item = queue[key]
            try {
                const upsertData = item.changes.map(change => ({
                    jadwal_id: change.jadwal_id,
                    mahasiswa_id: change.mahasiswa_id,
                    soal_id: change.soal_id,
                    jawaban: typeof change.jawaban === 'object'
                        ? change.jawaban
                        : { value: change.jawaban },
                    answered_at: change.answered_at
                }))

                await jawabanMahasiswaService.bulkUpsert(upsertData)

                // Remove from queue on success
                delete queue[key]
            } catch (error) {
                console.error('[useAutosave] Sync error for', key, error)
            }
        }

        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))

        if (Object.keys(queue).length === 0) {
            setSaveStatus(SaveStatus.SAVED)
        }
    }

    /**
     * Get all answers (pending + saved)
     */
    const getAnswers = useCallback(() => {
        return { ...pendingChanges }
    }, [pendingChanges])

    return {
        saveStatus,
        lastSaved,
        isOnline,
        pendingCount: Object.keys(pendingChanges).length,
        queueChange,
        forceSave,
        getAnswers
    }
}

export default useAutosave
