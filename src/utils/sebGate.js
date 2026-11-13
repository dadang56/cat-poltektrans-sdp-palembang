import { SEBService } from '../services/SEBService'

// "Wajib SEB" gate for mahasiswa accounts.
//
// When Pengaturan > requireSEB is on, a mahasiswa can only sign in from Safe
// Exam Browser (or another exam browser SEBService recognises). An admin can
// open a mahasiswa account in a normal browser for testing with the "password
// uji coba" set in Pengaturan; that unlock lasts for the current browser tab
// only (sessionStorage).
//
// Note: this is enforced in the browser. It stops normal use of a regular
// browser, but like every client-side check it is not proof against someone
// who edits the page's code or spoofs the user agent.

const BYPASS_KEY = 'cat_seb_bypass'
const HASH_PREFIX = 'sipandu-seb-bypass:'

export async function hashBypassPassword(password) {
    const bytes = new TextEncoder().encode(HASH_PREFIX + String(password))
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// SEB quit password: SEB stores it as a plain SHA-256 hex hash (upper case)
// in its settings (hashedQuitPassword). The /sipandu.seb config file
// (api/seb-config.js) puts this hash in, which is what makes SEB on iPhone/
// iPad lock the device during the exam.
export async function hashSebQuitPassword(password) {
    const bytes = new TextEncoder().encode(String(password))
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

// sebs:// link that makes SEB download the locked exam configuration
export function sebConfigLink() {
    return `sebs://${window.location.host}/sipandu.seb`
}

// Opening this URL inside SEB closes SEB (quitURL in the config file)
export function sebQuitUrl() {
    return `${window.location.origin}/seb-keluar`
}

export function isSebGateOn(config) {
    return config?.requireSEB === true
}

export function isSebBrowser() {
    try {
        return SEBService.isSEBBrowser()
    } catch {
        return false
    }
}

export function hasBypass(userId) {
    try {
        return !!userId && sessionStorage.getItem(BYPASS_KEY) === String(userId)
    } catch {
        return false
    }
}

export function grantBypass(userId) {
    try {
        sessionStorage.setItem(BYPASS_KEY, String(userId))
    } catch { /* storage blocked: bypass simply won't persist */ }
}

export function clearBypass() {
    try {
        sessionStorage.removeItem(BYPASS_KEY)
    } catch { /* ignore */ }
}

// true when this mahasiswa must be kept out of this browser
export function isBlockedHere(user, config) {
    return user?.role === 'mahasiswa'
        && isSebGateOn(config)
        && !isSebBrowser()
        && !hasBypass(user.id)
}

export class SebRequiredError extends Error {
    constructor(code, message) {
        super(message)
        this.code = code // 'SEB_REQUIRED' | 'SEB_BYPASS_WRONG' | 'SEB_BYPASS_NOT_SET'
    }
}
