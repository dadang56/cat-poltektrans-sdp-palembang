import { supabase, isSupabaseConfigured } from '../lib/supabase'

// Exam timers must not trust the device clock: lab PCs and phones are often
// minutes or hours off, which made the countdown start at 00:00. We measure
// the offset to the database clock once (via the server_now() RPC) and use
// it for every exam timestamp and elapsed-time calculation.
let offsetMs = 0
let syncPromise = null

export function syncServerClock() {
    if (syncPromise) return syncPromise
    syncPromise = (async () => {
        if (!isSupabaseConfigured()) return 0
        try {
            const sentAt = Date.now()
            const { data, error } = await supabase.rpc('server_now')
            const receivedAt = Date.now()
            if (error || !data) throw error || new Error('empty server_now')
            const serverMs = new Date(data).getTime()
            if (Number.isNaN(serverMs)) throw new Error('invalid server_now')
            // Assume the server read the clock halfway through the round trip
            offsetMs = serverMs - (sentAt + receivedAt) / 2
            if (Math.abs(offsetMs) > 60000) {
                console.warn(`[serverTime] Device clock is off by ${Math.round(offsetMs / 1000)}s; using server time`)
            }
        } catch (err) {
            console.warn('[serverTime] Could not sync with server clock, using device clock:', err?.message || err)
            offsetMs = 0
            syncPromise = null // allow a retry on the next call
        }
        return offsetMs
    })()
    return syncPromise
}

export function serverNowMs() {
    return Date.now() + offsetMs
}

export function serverNow() {
    return new Date(serverNowMs())
}
