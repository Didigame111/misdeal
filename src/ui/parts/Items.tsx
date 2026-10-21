import { memo, useEffect, useRef } from 'react'
import { isDebuffed } from '../../game/blinds'
import { JOKER_MAP } from '../../game/jokers'
import type { Card, ConsInst, Edition, GameState, JokerInst } from '../../game/types'
import { CardBack } from '../art/CardBack'
import { CardFace } from '../art/CardFace'
import { ConsArt } from '../art/ItemArt'
import { JokerArt } from '../art/JokerArt'
import { useFx } from '../fx'
import { prefersReducedMotion } from '../hooks'
import { useStore } from '../../store'

/** Re-runs a little bump animation whenever a scoring event lands on this id. */
export function useHit(id: string) {
  const ref = useRef<HTMLDivElement>(null)
  const anim = useRef<Animation | null>(null)
  const key = useFx((s) => (s.active && (s.active.target === id || s.active.sub === id) ? s.active.key : 0))
  useEffect(() => {
    if (!key || !ref.current?.animate || prefersReducedMotion()) return
    // Restart rather than stack: fast scoring can hit the same card again before the last bump ends.
    anim.current?.cancel()
    anim.current = ref.current.animate(
      [
        { transform: 'scale(1) rotate(0deg)' },
        { transform: 'scale(1.13) rotate(-4deg)', offset: 0.35 },
        { transform: 'scale(1) rotate(0deg)' },
      ],
      { duration: 280 / useStore.getState().settings.speed, easing: 'cubic-bezier(.3,1.6,.5,1)' },
    )
  }, [key])
  useEffect(() => () => anim.current?.cancel(), [])
  return ref
}

export function PopLabel({ id }: { id: string }) {
  const a = useFx((s) => (s.active?.target === id ? s.active : null))
  if (!a?.label) return null
  return (
    <span key={a.key} className={`pop tone-${a.tone ?? 'info'}`}>
      {a.label}
    </span>
  )
}

export const edClass = (ed?: Edition) => (ed ? ` ed-${ed}` : '')

/** Moving shine for Glossy cards; the other editions are static CSS overlays. */
const Sheen = ({ ed }: { ed?: Edition }) => (ed === 'glossy' ? <span className="sheen" aria-hidden="true" /> : null)

interface PlayingCardProps {
  card: Card
  deck?: string
  faceDown?: boolean
  debuffed?: boolean
}

export const PlayingCard = memo(function PlayingCard({ card, deck, faceDown, debuffed }: PlayingCardProps) {
  const ref = useHit(card.id)
  return (
    <div className={`card${faceDown ? '' : edClass(card.ed)}`} ref={ref}>
      {faceDown ? <CardBack deck={deck} /> : <CardFace card={card} debuffed={debuffed} />}
      {!faceDown && <Sheen ed={card.ed} />}
      <PopLabel id={card.id} />
    </div>
  )
})

export const cardDebuffed = (g: GameState, c: Card) => isDebuffed(g, c)

export const JokerCard = memo(function JokerCard({ joker, g }: { joker: JokerInst; g: GameState }) {
  const def = JOKER_MAP[joker.key]
  const ref = useHit(joker.id)
  const badge = def?.badge?.(joker, g)
  return (
    <div className={`card${edClass(joker.ed)}`} ref={ref}>
      <JokerArt jkey={joker.key} rarity={def?.rarity ?? 1} />
      <Sheen ed={joker.ed} />
      {badge && <span className="card-badge">{badge}</span>}
      <PopLabel id={joker.id} />
    </div>
  )
})

export function ConsCard({ cons }: { cons: ConsInst }) {
  const ref = useHit(cons.id)
  return (
    <div className="card" ref={ref}>
      <ConsArt ckey={cons.key} />
      <PopLabel id={cons.id} />
    </div>
  )
}
