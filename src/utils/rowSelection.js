import { useState, useRef, useCallback, useMemo } from 'react'

// Tick rows in a table to act on several at once (e.g. give them the same
// score). Shift-click ticks every row between the last ticked row and this
// one ("blok"). `ids` is the order of the rows as shown.
export function useRowSelection(ids) {
    const [selected, setSelected] = useState(() => new Set())
    const lastIdRef = useRef(null)

    // Rows hidden by a filter or search stay out of the selection
    const visible = useMemo(() => new Set(ids), [ids])
    const shown = useMemo(() => new Set([...selected].filter(id => visible.has(id))), [selected, visible])

    const toggle = useCallback((id, shiftKey = false) => {
        // Read before setSelected: React runs the updater later, after
        // lastIdRef already points at this row
        const last = lastIdRef.current
        setSelected(prev => {
            const next = new Set([...prev].filter(x => visible.has(x)))
            const from = ids.indexOf(last)
            const to = ids.indexOf(id)
            if (shiftKey && from !== -1 && to !== -1) {
                const on = !prev.has(id)
                const [a, b] = from < to ? [from, to] : [to, from]
                for (let i = a; i <= b; i++) {
                    if (on) next.add(ids[i])
                    else next.delete(ids[i])
                }
            } else if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
        lastIdRef.current = id
    }, [ids, visible])

    const allSelected = ids.length > 0 && shown.size === ids.length
    const someSelected = shown.size > 0 && !allSelected

    const toggleAll = useCallback(() => {
        setSelected(allSelected ? new Set() : new Set(ids))
        lastIdRef.current = null
    }, [allSelected, ids])

    const clear = useCallback(() => {
        setSelected(new Set())
        lastIdRef.current = null
    }, [])

    return { selected: shown, toggle, toggleAll, clear, allSelected, someSelected }
}
