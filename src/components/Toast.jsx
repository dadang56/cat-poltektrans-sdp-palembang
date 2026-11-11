import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'

// App-wide notifications. Call from anywhere (pages, services, handlers):
//   import { toast } from '../components/Toast'
//   toast.success('User berhasil disimpan')
//   toast.error('Gagal menyimpan: ' + err.message)
// <ToastContainer /> is mounted once in App.

const listeners = new Set()
let nextId = 1

function push(type, message, duration) {
    const item = {
        id: nextId++,
        type,
        message: String(message ?? ''),
        // Errors stay longer so they can be read before they disappear
        duration: duration ?? (type === 'error' ? 7000 : 3500)
    }
    listeners.forEach(fn => fn(item))
    return item.id
}

export const toast = {
    success: (message, duration) => push('success', message, duration),
    error: (message, duration) => push('error', message, duration),
    info: (message, duration) => push('info', message, duration),
    warning: (message, duration) => push('warning', message, duration)
}

// Turn a Supabase/JS error into a short Indonesian message
export function errorMessage(err) {
    if (!err) return 'Terjadi kesalahan'
    const msg = err.message || err.error_description || String(err)
    if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Koneksi ke server gagal. Periksa internet lalu coba lagi.'
    if (err.code === '23505' || /duplicate key/i.test(msg)) return 'Data sudah ada (duplikat).'
    if (err.code === '23503' || /foreign key/i.test(msg)) return 'Data masih dipakai oleh data lain, tidak bisa diubah/dihapus.'
    if (err.code === '23502' || /null value/i.test(msg)) return 'Ada isian wajib yang masih kosong.'
    return msg
}

const ICONS = { success: CheckCircle, error: XCircle, info: Info, warning: AlertTriangle }

export function ToastContainer() {
    const [items, setItems] = useState([])

    const dismiss = useCallback(id => setItems(prev => prev.filter(t => t.id !== id)), [])

    useEffect(() => {
        const onPush = item => {
            setItems(prev => [...prev.slice(-4), item]) // at most 5 on screen
            setTimeout(() => dismiss(item.id), item.duration)
        }
        listeners.add(onPush)
        return () => listeners.delete(onPush)
    }, [dismiss])

    return (
        <div className="app-toast-stack" role="status" aria-live="polite">
            {items.map(t => {
                const Icon = ICONS[t.type] || Info
                return (
                    <div key={t.id} className={`app-toast app-toast-${t.type}`}>
                        <Icon size={20} className="app-toast-icon" />
                        <span className="app-toast-msg">{t.message}</span>
                        <button className="app-toast-close" onClick={() => dismiss(t.id)} aria-label="Tutup notifikasi">
                            <X size={16} />
                        </button>
                    </div>
                )
            })}
            <style>{`
                .app-toast-stack {
                    position: fixed;
                    top: 1rem;
                    right: 1rem;
                    z-index: 10000;
                    display: flex;
                    flex-direction: column;
                    gap: 0.6rem;
                    max-width: min(420px, calc(100vw - 2rem));
                    pointer-events: none;
                }
                .app-toast {
                    pointer-events: auto;
                    display: flex;
                    align-items: flex-start;
                    gap: 0.65rem;
                    padding: 0.85rem 0.9rem;
                    border-radius: 0.75rem;
                    background: var(--bg-secondary, #fff);
                    color: var(--text-primary, #0f172a);
                    border: 1px solid var(--border-color, #e2e8f0);
                    border-left-width: 4px;
                    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15);
                    font-size: 0.9rem;
                    line-height: 1.4;
                    animation: app-toast-in 0.18s ease-out;
                }
                .app-toast-success { border-left-color: #16a34a; }
                .app-toast-success .app-toast-icon { color: #16a34a; }
                .app-toast-error { border-left-color: #dc2626; }
                .app-toast-error .app-toast-icon { color: #dc2626; }
                .app-toast-warning { border-left-color: #d97706; }
                .app-toast-warning .app-toast-icon { color: #d97706; }
                .app-toast-info { border-left-color: #2563eb; }
                .app-toast-info .app-toast-icon { color: #2563eb; }
                .app-toast-icon { flex-shrink: 0; margin-top: 1px; }
                .app-toast-msg { flex: 1; white-space: pre-line; word-break: break-word; }
                .app-toast-close {
                    flex-shrink: 0;
                    border: none;
                    background: transparent;
                    color: var(--text-muted, #64748b);
                    cursor: pointer;
                    padding: 2px;
                    border-radius: 4px;
                }
                .app-toast-close:hover { background: var(--bg-tertiary, #f1f5f9); }
                @keyframes app-toast-in {
                    from { opacity: 0; transform: translateY(-6px); }
                    to { opacity: 1; transform: none; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .app-toast { animation: none; }
                }
                @media (max-width: 640px) {
                    .app-toast-stack { left: 1rem; right: 1rem; max-width: none; }
                }
            `}</style>
        </div>
    )
}
