import { useEffect, useRef } from 'react'

// Phones/tablets: swipe right from the left edge opens the menu, swipe left
// closes it, so the menu can be reached with the thumb instead of the ☰
// button in the top corner.
//
// The start zone is the first EDGE_PX of the screen. The very edge (a few
// px) may be taken by the phone's own "back" gesture; starting a little
// further in always works. Vertical scrolling is never blocked: the swipe
// only counts when the finger moves clearly sideways.
const EDGE_PX = 48
const DISTANCE = 45
const MAX_WIDTH = 1024 // the menu is a drawer only below this width

export function useEdgeSwipe(isOpen, setOpen) {
    const openRef = useRef(isOpen)
    useEffect(() => {
        openRef.current = isOpen
    }, [isOpen])

    useEffect(() => {
        let start = null
        const onStart = (e) => {
            start = null
            if (window.innerWidth > MAX_WIDTH || e.touches.length !== 1) return
            const t = e.touches[0]
            if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
            if (!openRef.current && t.clientX > EDGE_PX) return
            start = { x: t.clientX, y: t.clientY, closing: openRef.current }
        }
        const onMove = (e) => {
            if (!start) return
            const t = e.touches[0]
            const dx = t.clientX - start.x
            const dy = t.clientY - start.y
            if (Math.abs(dy) > 30 && Math.abs(dy) > Math.abs(dx)) {
                start = null // scrolling, not a swipe
                return
            }
            if (Math.abs(dx) < DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return
            if (!start.closing && dx > 0) setOpen(true)
            if (start.closing && dx < 0) setOpen(false)
            start = null
        }
        const onEnd = () => { start = null }
        document.addEventListener('touchstart', onStart, { passive: true })
        document.addEventListener('touchmove', onMove, { passive: true })
        document.addEventListener('touchend', onEnd, { passive: true })
        document.addEventListener('touchcancel', onEnd, { passive: true })
        return () => {
            document.removeEventListener('touchstart', onStart)
            document.removeEventListener('touchmove', onMove)
            document.removeEventListener('touchend', onEnd)
            document.removeEventListener('touchcancel', onEnd)
        }
    }, [setOpen])
}
