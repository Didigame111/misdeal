import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Rect } from '../store'

export interface PressHandlers {
  onTap?: () => void
  onLongPress?: () => void
  onDragStart?: () => void
  onDragMove?: (dx: number, dy: number) => void
  onDragEnd?: (dx: number, dy: number) => void
}

const SLOP = 9
const LONG_MS = 430

/** Tap, long-press and drag on one element, with pointer capture so drags survive leaving it. */
export function usePress(handlers: PressHandlers) {
  const h = useRef(handlers)
  h.current = handlers
  const st = useRef<{ id: number; x: number; y: number; dragging: boolean; long: boolean; timer: number } | null>(null)

  const end = (e: React.PointerEvent, cancelled: boolean) => {
    const s = st.current
    if (!s || s.id !== e.pointerId) return
    window.clearTimeout(s.timer)
    st.current = null
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (s.dragging) h.current.onDragEnd?.(dx, dy)
    else if (!s.long && !cancelled) h.current.onTap?.()
  }

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 || st.current) return
      const target = e.currentTarget as HTMLElement
      try {
        target.setPointerCapture(e.pointerId)
      } catch {
        // Some synthetic events cannot be captured; dragging still works inside the element.
      }
      const timer = window.setTimeout(() => {
        const s = st.current
        if (s && !s.dragging && h.current.onLongPress) {
          s.long = true
          h.current.onLongPress()
        }
      }, LONG_MS)
      st.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false, long: false, timer }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = st.current
      if (!s || s.id !== e.pointerId) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      if (!s.dragging && !s.long && Math.hypot(dx, dy) > SLOP) {
        window.clearTimeout(s.timer)
        if (h.current.onDragStart) {
          s.dragging = true
          h.current.onDragStart()
        } else {
          s.long = true // moved too far for a tap
        }
      }
      if (s.dragging) h.current.onDragMove?.(dx, dy)
    },
    onPointerUp: (e: React.PointerEvent) => end(e, false),
    onPointerCancel: (e: React.PointerEvent) => end(e, true),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        h.current.onTap?.()
      }
    },
  }
}

export function rectOf(el: Element | null): Rect {
  const b = el?.getBoundingClientRect()
  return b ? { x: b.left, y: b.top, w: b.width, h: b.height } : { x: 0, y: 0, w: 0, h: 0 }
}

/** Element size, kept fresh with a ResizeObserver. */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

/** Animates a number towards its target value. */
export function useCountUp(value: number, ms = 520) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  const shownRef = useRef(value)
  shownRef.current = shown
  useEffect(() => {
    from.current = shownRef.current
    if (from.current === value) return
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(Math.round(from.current + (value - from.current) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return shown
}
