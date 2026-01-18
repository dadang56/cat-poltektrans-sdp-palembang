import { supabase, isSupabaseConfigured } from '../lib/supabase'

/**
 * Audit Logging Service
 * 
 * Logs all critical user actions to the audit_logs table for
 * compliance and security monitoring.
 */

// Actions enum
export const AuditAction = {
    // Auth
    LOGIN: 'login',
    LOGOUT: 'logout',
    LOGIN_FAILED: 'login_failed',
    PASSWORD_CHANGE: 'password_change',

    // Exam
    EXAM_START: 'exam_start',
    EXAM_SUBMIT: 'exam_submit',
    EXAM_TIMEOUT: 'exam_timeout',
    EXAM_FORCE_SUBMIT: 'exam_force_submit',

    // Answers
    ANSWER_SAVE: 'answer_save',
    ANSWER_UPDATE: 'answer_update',

    // Grading
    GRADE_SUBMIT: 'grade_submit',
    GRADE_UPDATE: 'grade_update',

    // Admin
    USER_CREATE: 'user_create',
    USER_UPDATE: 'user_update',
    USER_DELETE: 'user_delete',

    // Data
    DATA_EXPORT: 'data_export',
    DATA_IMPORT: 'data_import',

    // Security
    VIOLATION_WARNING: 'violation_warning',
    VIOLATION_MAX_REACHED: 'violation_max_reached'
}

/**
 * Log an action to the audit trail
 */
export async function logAction({
    action,
    tableName = null,
    recordId = null,
    oldValues = null,
    newValues = null,
    extraData = null,
    userId = null
}) {
    // Always log locally for debugging
    console.log('[Audit]', action, { tableName, recordId, extraData })

    if (!isSupabaseConfigured()) {
        // Store in localStorage for demo mode
        logToLocalStorage({ action, tableName, recordId, oldValues, newValues, extraData })
        return { data: null, error: null }
    }

    try {
        // Get current user if not provided
        let currentUserId = userId
        if (!currentUserId) {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase
                    .from('users')
                    .select('id')
                    .eq('auth_id', user.id)
                    .single()
                currentUserId = profile?.id
            }
        }

        const { data, error } = await supabase
            .from('audit_logs')
            .insert({
                user_id: currentUserId,
                action,
                table_name: tableName,
                record_id: recordId,
                old_values: oldValues,
                new_values: newValues,
                extra_data: extraData,
                user_agent: navigator.userAgent
                // ip_address is set server-side via RLS function
            })
            .select()
            .single()

        if (error) throw error
        return { data, error: null }

    } catch (error) {
        console.error('[Audit] Error logging action:', error)
        // Fallback to localStorage
        logToLocalStorage({ action, tableName, recordId, oldValues, newValues, extraData, userId })
        return { data: null, error }
    }
}

/**
 * Log login event
 */
export async function logLogin(userId, success = true, extraData = null) {
    return logAction({
        action: success ? AuditAction.LOGIN : AuditAction.LOGIN_FAILED,
        userId,
        extraData: {
            ...extraData,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        }
    })
}

/**
 * Log logout event
 */
export async function logLogout(userId) {
    return logAction({
        action: AuditAction.LOGOUT,
        userId
    })
}

/**
 * Log exam start
 */
export async function logExamStart(jadwalId, mahasiswaId, extraData = null) {
    return logAction({
        action: AuditAction.EXAM_START,
        tableName: 'jadwal_ujian',
        recordId: jadwalId,
        userId: mahasiswaId,
        extraData: {
            ...extraData,
            startTime: new Date().toISOString()
        }
    })
}

/**
 * Log exam submission
 */
export async function logExamSubmit(jadwalId, mahasiswaId, submissionData) {
    return logAction({
        action: AuditAction.EXAM_SUBMIT,
        tableName: 'hasil_ujian',
        recordId: jadwalId,
        userId: mahasiswaId,
        newValues: submissionData
    })
}

/**
 * Log exam timeout (auto-submit)
 */
export async function logExamTimeout(jadwalId, mahasiswaId) {
    return logAction({
        action: AuditAction.EXAM_TIMEOUT,
        tableName: 'jadwal_ujian',
        recordId: jadwalId,
        userId: mahasiswaId
    })
}

/**
 * Log anti-cheat violation
 */
export async function logViolation(jadwalId, mahasiswaId, violationType, warningCount, maxWarnings) {
    const action = warningCount >= maxWarnings
        ? AuditAction.VIOLATION_MAX_REACHED
        : AuditAction.VIOLATION_WARNING

    return logAction({
        action,
        tableName: 'jadwal_ujian',
        recordId: jadwalId,
        userId: mahasiswaId,
        extraData: {
            violationType,
            warningCount,
            maxWarnings,
            timestamp: new Date().toISOString()
        }
    })
}

/**
 * Log grade submission
 */
export async function logGradeSubmit(jawabanId, dosenId, oldNilai, newNilai) {
    return logAction({
        action: AuditAction.GRADE_SUBMIT,
        tableName: 'jawaban_mahasiswa',
        recordId: jawabanId,
        userId: dosenId,
        oldValues: { nilai: oldNilai },
        newValues: { nilai: newNilai }
    })
}

/**
 * Log data export
 */
export async function logDataExport(tableName, userId, format, recordCount) {
    return logAction({
        action: AuditAction.DATA_EXPORT,
        tableName,
        userId,
        extraData: {
            format,
            recordCount,
            timestamp: new Date().toISOString()
        }
    })
}

// ============================================
// LocalStorage Fallback
// ============================================

const LOCAL_AUDIT_KEY = 'cat_audit_logs'
const MAX_LOCAL_LOGS = 1000

function logToLocalStorage(logEntry) {
    try {
        const logs = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY) || '[]')
        logs.push({
            ...logEntry,
            id: Date.now(),
            created_at: new Date().toISOString(),
            user_agent: navigator.userAgent
        })

        // Keep only last N logs
        if (logs.length > MAX_LOCAL_LOGS) {
            logs.splice(0, logs.length - MAX_LOCAL_LOGS)
        }

        localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(logs))
    } catch (e) {
        console.error('[Audit] Error saving to localStorage:', e)
    }
}

/**
 * Get audit logs from localStorage (for demo mode)
 */
export function getLocalAuditLogs(limit = 100) {
    try {
        const logs = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY) || '[]')
        return logs.slice(-limit).reverse()
    } catch (e) {
        return []
    }
}

/**
 * Clear local audit logs
 */
export function clearLocalAuditLogs() {
    localStorage.removeItem(LOCAL_AUDIT_KEY)
}

// Export service object
export default {
    AuditAction,
    logAction,
    logLogin,
    logLogout,
    logExamStart,
    logExamSubmit,
    logExamTimeout,
    logViolation,
    logGradeSubmit,
    logDataExport,
    getLocalAuditLogs,
    clearLocalAuditLogs
}
