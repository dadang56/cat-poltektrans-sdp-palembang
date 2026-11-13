// Stops accidental double clicks on action buttons (Simpan, Hapus, Tambah…)
// from running the action twice, e.g. creating the same jadwal or user two
// times on a slow connection. After a click, the same button ignores further
// clicks for a moment and shows a pressed state.
//
// Only solid action buttons inside the dashboard and pop-ups are guarded.
// The exam page is left alone (fast next/previous taps are normal there).
const GUARD_MS = 900
const ACTION = '.btn-primary, .btn-success, .btn-error, .btn-danger, .btn-warning'

export function installDoubleClickGuard() {
    if (typeof document === 'undefined') return
    document.addEventListener('click', (e) => {
        const btn = e.target.closest?.('button')
        if (!btn || !btn.matches(ACTION)) return
        if (!btn.closest('.dashboard-layout, .confirm-dialog, .modal')) return
        if (btn.closest('.take-exam-page')) return
        if (btn.dataset.clickGuard === '1') {
            e.preventDefault()
            e.stopImmediatePropagation()
            return
        }
        btn.dataset.clickGuard = '1'
        btn.classList.add('is-busy')
        setTimeout(() => {
            delete btn.dataset.clickGuard
            btn.classList.remove('is-busy')
        }, GUARD_MS)
    }, true)
}
