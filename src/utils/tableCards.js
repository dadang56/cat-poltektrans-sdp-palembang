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
const MAX_COLUMNS = 9
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
    for (const body of table.tBodies) {
        for (const row of body.rows) {
            const cells = row.cells
            if (cells.length !== labels.length) continue // e.g. "no data" row
            for (let i = 0; i < cells.length; i++) {
                if (cells[i].getAttribute('data-label') !== labels[i]) {
                    cells[i].setAttribute('data-label', labels[i])
                }
            }
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
        const observer = new MutationObserver(schedule)
        observer.observe(root, { childList: true, subtree: true })
        return () => {
            observer.disconnect()
            if (frame) cancelAnimationFrame(frame)
        }
    }, [rootRef, headerTitle])
}
