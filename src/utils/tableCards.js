import { useEffect } from 'react'

// On phones, wide tables are shown as one card per row (see mobile.css,
// "Tables as cards"). CSS can only print a label next to each value if the
// cell carries it, so this copies every column heading onto its cells as
// data-label and marks the table with .table-cards.
//
// Applies to table.table, table.data-table and table.nk-table in the page. Skipped:
// tables with class no-cards, more than MAX_COLUMNS columns (grids such as
// attendance per meeting read better scrolled sideways), or multi-row /
// merged headings.
//
// Each card is folded to one line, the row's name (Nama / Mata Kuliah /
// Ujian … column), and opens on tap to show the rest. Cells holding an
// input (e.g. a score to type) stay visible when folded, so data entry
// doesn't need a tap per row. Tables with 3 columns or fewer aren't folded.
const MAX_COLUMNS = 9
const FOLD_MIN_COLUMNS = 4
const TITLE_PATTERNS = [
    /^nama\b/i,
    /nama/i,
    /mata kuliah|matkul/i,
    /ujian|judul|soal/i,
    /mahasiswa|dosen|pengguna|user/i,
    /kelas|ruang|prodi|program studi/i
]
const SKIP_TITLE = /^(no\.?|#|aksi|status)$/i

function pickTitleColumn(labels) {
    for (const re of TITLE_PATTERNS) {
        const i = labels.findIndex(l => re.test(l) && !SKIP_TITLE.test(l))
        if (i !== -1) return i
    }
    const i = labels.findIndex(l => l && !SKIP_TITLE.test(l))
    return i === -1 ? 0 : i
}
const SELECTOR = 'table.table, table.data-table, table.nk-table'

function labelTable(table) {
    if (table.classList.contains('no-cards')) return
    const headRows = table.tHead ? table.tHead.rows : []
    if (headRows.length !== 1) return
    const heads = [...headRows[0].cells]
    if (heads.length < 2 || heads.length > MAX_COLUMNS || heads.some(th => th.colSpan > 1)) {
        table.classList.remove('table-cards')
        return
    }
    const labels = heads.map(th => th.textContent.trim())
    const fold = labels.length >= FOLD_MIN_COLUMNS
    const titleIndex = pickTitleColumn(labels)
    for (const body of table.tBodies) {
        for (const row of body.rows) {
            const cells = row.cells
            if (cells.length !== labels.length) continue // e.g. "no data" row
            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i]
                if (cell.getAttribute('data-label') !== labels[i]) {
                    cell.setAttribute('data-label', labels[i])
                }
                cell.classList.toggle('card-title-cell', fold && i === titleIndex)
                cell.classList.toggle('card-keep', fold && i !== titleIndex &&
                    !!cell.querySelector('input:not([type=checkbox]):not([type=radio]), select, textarea'))
            }
            row.classList.toggle('card-fold', fold)
        }
    }
    table.classList.add('table-cards')
}

// The header bar already names the page; on phones the page's own big
// title is hidden (mobile.css .dup-title) when it says the same thing.
const norm = t => t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
function markDuplicateTitle(root, headerTitle) {
    const h = norm(headerTitle || '')
    root.querySelectorAll('.page-header .page-title').forEach(el => {
        const t = norm(el.textContent)
        el.classList.toggle('dup-title', !!h && !!t && (t === h || t.startsWith(h + ' ') || h.startsWith(t + ' ')))
    })
}

export function useTableCards(rootRef, headerTitle) {
    useEffect(() => {
        const root = rootRef.current
        if (!root || typeof MutationObserver === 'undefined') return
        let frame = 0
        const run = () => {
            frame = 0
            root.querySelectorAll(SELECTOR).forEach(labelTable)
            markDuplicateTitle(root, headerTitle)
        }
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(run)
        }
        run()
        // Tap a folded card to open / close it (not when tapping a
        // button, link or field inside it). Phones only.
        const phone = window.matchMedia('(max-width: 640px)')
        const onClick = (e) => {
            if (!phone.matches) return
            const row = e.target.closest('table.table-cards tr.card-fold')
            if (!row || !root.contains(row)) return
            if (e.target.closest('button, a, input, select, textarea, label, [role="button"]')) return
            row.classList.toggle('is-open')
            row.setAttribute('aria-expanded', row.classList.contains('is-open') ? 'true' : 'false')
        }
        root.addEventListener('click', onClick)
        const observer = new MutationObserver(schedule)
        observer.observe(root, { childList: true, subtree: true })
        return () => {
            root.removeEventListener('click', onClick)
            observer.disconnect()
            if (frame) cancelAnimationFrame(frame)
        }
    }, [rootRef, headerTitle])
}
