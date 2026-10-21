import { useState, type ReactNode } from 'react'
import { rectOf, usePress, useSize } from '../hooks'

interface Props<T> {
  items: T[]
  getId: (t: T) => string
  render: (t: T, i: number) => ReactNode
  label?: string
  empty?: string
  onTap: (t: T, el: HTMLElement) => void
  onMove?: (from: number, to: number) => void
  className?: string
}

interface Slot {
  x: number
  step: number
  x0: number
}

function layout(n: number, w: number, cw: number, gap: number): Slot[] {
  if (!n) return []
  const maxStep = cw + gap
  const step = n > 1 ? Math.min(maxStep, (w - cw) / (n - 1)) : 0
  const total = step * (n - 1) + cw
  const x0 = Math.max(0, (w - total) / 2)
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * step, step, x0 }))
}

/** A row of cards that you can tap to inspect and drag to reorder. */
export function SlotRow<T>({ items, getId, render, label, empty, onTap, onMove, className = '' }: Props<T>) {
  const [ref, size] = useSize<HTMLDivElement>()
  const [probe, card] = useSize<HTMLDivElement>()
  const [drag, setDrag] = useState<{ id: string; from: number; dx: number } | null>(null)
  const cw = card.w || 80
  const slots = layout(items.length, Math.max(0, size.w - 20), cw, cw * 0.1)

  let order = items.map(getId)
  let target = -1
  if (drag && slots.length) {
    const x = slots[drag.from].x + drag.dx
    const step = slots[0].step || 1
    target = Math.max(0, Math.min(items.length - 1, Math.round((x - slots[0].x0) / step)))
    order = order.filter((id) => id !== drag.id)
    order.splice(target, 0, drag.id)
  }

  return (
    <div className={`slot-row ${className}`} ref={ref} data-empty={items.length ? undefined : empty}>
      <div className="card-probe" ref={probe} aria-hidden="true" />
      {items.map((item, i) => {
        const id = getId(item)
        const dragging = drag?.id === id
        const idx = order.indexOf(id)
        const x = dragging ? slots[i].x + drag.dx : (slots[idx]?.x ?? 0)
        return (
          <SlotItem
            key={id}
            x={x}
            z={dragging ? 50 : idx + 1}
            dragging={dragging}
            onTap={(el) => onTap(item, el)}
            onDragStart={onMove ? () => setDrag({ id, from: i, dx: 0 }) : undefined}
            onDragMove={(dx) => setDrag((d) => (d ? { ...d, dx } : d))}
            onDragEnd={() => {
              if (onMove && target >= 0 && target !== i) onMove(i, target)
              setDrag(null)
            }}
          >
            {render(item, i)}
          </SlotItem>
        )
      })}
      {label && <span className="slot-count">{label}</span>}
    </div>
  )
}

interface ItemProps {
  x: number
  z: number
  dragging: boolean
  children: ReactNode
  onTap: (el: HTMLElement) => void
  onDragStart?: () => void
  onDragMove: (dx: number) => void
  onDragEnd: () => void
}

function SlotItem({ x, z, dragging, children, onTap, onDragStart, onDragMove, onDragEnd }: ItemProps) {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const press = usePress({
    onTap: () => el && onTap(el),
    onDragStart,
    onDragMove: (dx) => onDragMove(dx),
    onDragEnd,
  })
  return (
    <div
      ref={setEl}
      className={`slot-item${dragging ? ' is-drag' : ''}`}
      style={{ transform: `translate3d(${x}px, ${dragging ? -8 : 0}px, 0)`, zIndex: z }}
      role="button"
      tabIndex={0}
      {...press}
    >
      {children}
    </div>
  )
}

export { rectOf }
