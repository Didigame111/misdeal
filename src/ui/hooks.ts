import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Rect } from '../store'

export interface PressHandlers {
  onTap?: () => void
  onLongPress?: () => void
  onDragStart?: () => void
  onDragMove?: (dx: number, dy: number) => void
  onDragEnd?: (dx: number, dy: number) => void
  /** Finger down / up, for press feedback such as tilting toward the touch. */
  onPressStart?: (e: React.PointerEvent) => void
  onPressEnd?: () => void
}

const SLOP = 9
const LONG_MS = 430
/** A quick press may wander this far and still count as a tap. Stylus tips skid on glass far more than fingers do. */
const FLICK = 32
/** How long a press must last before moving under FLICK turns it into a drag. */
const QUICK_MS = 160

/** Tap, long-press and drag on one element, with pointer capture so drags survive leaving it. */
export function usePress(handlers: PressHandlers) {
  const h = useRef(handlers)
  h.current = handlers
  const st = useRef<{ id: number; el: HTMLElement; x: number; y: number; t: number; dragging: boolean; long: boolean; timer: number } | null>(null)
  // Pointer events can arrive several times per frame; only the latest drag position matters.
  const frame = useRef({ raf: 0, dx: 0, dy: 0 })
  const flushDrag = () => {
    frame.current.raf = 0
    h.current.onDragMove?.(frame.current.dx, frame.current.dy)
  }

  const end = (e: React.PointerEvent, cancelled: boolean) => {
    const s = st.current
    if (!s || s.id !== e.pointerId) return
    window.clearTimeout(s.timer)
    st.current = null
    // Let go straight away: a stylus reuses one pointer id, so a lingering capture could steal its next tap.
    if (s.el.hasPointerCapture?.(e.pointerId)) s.el.releasePointerCapture(e.pointerId)
    h.current.onPressEnd?.()
    if (frame.current.raf) {
      cancelAnimationFrame(frame.current.raf)
      frame.current.raf = 0
    }
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (s.dragging) h.current.onDragEnd?.(dx, dy)
    else if (!s.long && !cancelled && Math.hypot(dx, dy) <= FLICK) h.current.onTap?.()
  }

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      // Ignore a second finger, but never let a press whose pointerup went missing block the next one.
      if (st.current && st.current.id !== e.pointerId) return
      if (st.current) window.clearTimeout(st.current.timer)
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
      st.current = { id: e.pointerId, el: target, x: e.clientX, y: e.clientY, t: performance.now(), dragging: false, long: false, timer }
      h.current.onPressStart?.(e)
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = st.current
      if (!s || s.id !== e.pointerId) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      const dist = Math.hypot(dx, dy)
      // A fast tap that skids a little is still a tap; only a held or long move becomes a drag.
      const quick = performance.now() - s.t < QUICK_MS && dist <= FLICK
      if (!s.dragging && !s.long && dist > SLOP && !quick) {
        window.clearTimeout(s.timer)
        if (h.current.onDragStart) {
          s.dragging = true
          h.current.onDragStart()
        } else {
          s.long = true // moved too far for a tap
        }
      }
      if (s.dragging) {
        frame.current.dx = dx
        frame.current.dy = dy
        if (!frame.current.raf) frame.current.raf = requestAnimationFrame(flushDrag)
      }
    },
    onPointerUp: (e: React.PointerEvent) => end(e, false),
    onPointerCancel: (e: React.PointerEvent) => end(e, true),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
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
/** True when the user asked iPadOS to reduce motion. Scripted animations check this; CSS handles the rest. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useCountUp(value: number, ms = 520) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  const shownRef = useRef(value)
  shownRef.current = shown
  useEffect(() => {
    from.current = shownRef.current
    if (from.current === value) return
    if (prefersReducedMotion()) {
      setShown(value)
      return
    }
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
