import { useEffect, useState } from 'react'
import { act, useStore } from '../../store'

/** Short messages from the game (a joker used up, a tag kicking in), shown and then cleared. */
export function Toasts() {
  const notices = useStore((s) => s.game?.notices)
  const [items, setItems] = useState<{ id: number; text: string }[]>([])

  useEffect(() => {
    if (!notices?.length) return
    const added = notices.map((text, i) => ({ id: Date.now() + i, text }))
    setItems((list) => [...list, ...added].slice(-3))
    act((g) => {
      g.notices = []
    })
    const timer = window.setTimeout(() => setItems((list) => list.filter((t) => !added.includes(t))), 2800)
    return () => window.clearTimeout(timer)
  }, [notices])

  if (!items.length) return null
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="toast">
          {t.text}
        </div>
      ))}
    </div>
  )
}
