import { supabase, isSupabaseConfigured } from '../lib/supabase'

// Instant updates for the pengawas monitor without database realtime.
//
// The student's browser sends a tiny broadcast ("something changed") on the
// channel of its jadwal when it starts, records a violation, or submits.
// The monitor listens on the channels of the room it shows and reloads the
// participant list right away. Autosaves are NOT signalled, so a full exam
// room produces only a handful of messages. The monitor still polls every
// 30 s as a fallback, so a lost message only means the usual delay.
//
// Uses Supabase Realtime public broadcast (no table publication or SQL
// setting needed); sending goes over plain HTTPS.
const topic = jadwalId => `monitor-${jadwalId}`
const senders = new Map()

export function signalMonitor(jadwalId, reason = 'changed') {
    if (!jadwalId || !isSupabaseConfigured()) return
    try {
        let channel = senders.get(jadwalId)
        if (!channel) {
            channel = supabase.channel(topic(jadwalId))
            senders.set(jadwalId, channel)
        }
        channel.httpSend('changed', { reason, at: Date.now() }).catch(() => { /* fallback: polling */ })
    } catch {
        /* never let monitoring break the exam */
    }
}

// Calls onChange (debounced) whenever a student in these jadwal signals.
// Returns a function that stops listening.
export function watchMonitor(jadwalIds, onChange, debounceMs = 1500) {
    if (!isSupabaseConfigured() || !jadwalIds?.length) return () => {}
    let timer = null
    const fire = () => {
        clearTimeout(timer)
        timer = setTimeout(onChange, debounceMs)
    }
    const channels = jadwalIds.map(id =>
        supabase
            .channel(topic(id))
            .on('broadcast', { event: 'changed' }, fire)
            .subscribe()
    )
    return () => {
        clearTimeout(timer)
        channels.forEach(ch => supabase.removeChannel(ch))
    }
}
