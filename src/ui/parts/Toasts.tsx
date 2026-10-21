import { useEffect, useState } from 'react'
import { act, useStore } from '../../store'

const SHOW_MS = 2800

function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, SHOW_MS)
    return () => window.clearTimeout(timer)
  }, [onDone])
  return <div className="toast">{text}</div>
}

let nextToast = 0

/** Short messages from the game (a joker used up, a tag kicking in), shown and then cleared. */
export function Toasts() {
  const notices = useStore((s) => s.game?.notices)
  const [items, setItems] = useState<{ id: number; text: string; done: () => void }[]>([])

  useEffect(() => {
    if (!notices?.length) return
    const added = notices.map((text) => {
      const id = ++nextToast
      return { id, text, done: () => setItems((list) => list.filter((t) => t.id !== id)) }
    })
    setItems((list) => [...list, ...added].slice(-3))
    act((g) => {
      g.notices = []
    })
  }, [notices])

  if (!items.length) return null
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <Toast key={t.id} text={t.text} onDone={t.done} />
      ))}
    </div>
  )
}
