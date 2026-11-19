import { supabase, isSupabaseConfigured } from '../lib/supabase'

// Shared "who is supervising which room" lock, without any database table.
//
// Every pengawas/admin viewing the monitor joins one Realtime Presence
// channel. When a pengawas opens a room to supervise it, their browser
// tracks { room_id, pengawas_id, pengawas_name } on the channel. All other
// clients receive a presence "sync" and learn the room is taken, so they can
// label it and block entry. When that pengawas leaves the room, closes the
// tab, or loses connection, Realtime drops their presence automatically and
// the room frees up — no stale locks to clean.
const CHANNEL = 'pengawas-room-locks'

// Returns a handle: setRoom(roomId) to claim a room, clearRoom() to release,
// leave() to tear down. onSync(locksMap) fires with { [roomId]: { pengawasId,
// pengawasName } } whenever presence changes. A no-op handle is returned when
// Supabase isn't configured, so callers never need to special-case it.
export function joinRoomLocks({ pengawasId, pengawasName, onSync }) {
    if (!isSupabaseConfigured()) {
        return { setRoom: () => {}, clearRoom: () => {}, leave: () => {} }
    }

    const channel = supabase.channel(CHANNEL, {
        config: { presence: { key: String(pengawasId || Math.random()) } }
    })

    const readState = () => {
        const locks = {}
        try {
            const state = channel.presenceState()
            Object.values(state).forEach(entries => {
                entries.forEach(e => {
                    if (e?.room_id && e?.pengawas_id && !locks[e.room_id]) {
                        locks[e.room_id] = { pengawasId: e.pengawas_id, pengawasName: e.pengawas_name }
                    }
                })
            })
        } catch { /* ignore malformed state */ }
        onSync(locks)
    }

    channel.on('presence', { event: 'sync' }, readState)
    channel.subscribe(status => { if (status === 'SUBSCRIBED') readState() })

    let currentRoom = null
    return {
        setRoom: (roomId) => {
            if (!roomId || currentRoom === roomId) return
            currentRoom = roomId
            channel.track({
                room_id: roomId,
                pengawas_id: pengawasId,
                pengawas_name: pengawasName,
                at: Date.now()
            }).catch(() => { /* fallback: polling / local state */ })
        },
        clearRoom: () => {
            currentRoom = null
            channel.untrack().catch(() => {})
        },
        leave: () => {
            try { supabase.removeChannel(channel) } catch { /* ignore */ }
        }
    }
}
