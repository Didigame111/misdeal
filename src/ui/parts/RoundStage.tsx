import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { roundBoss } from '../../game/blinds'
import { cardName } from '../../game/cards'
import * as E from '../../game/engine'
import { deckSize } from '../../game/ops'
import type { Card, GameState } from '../../game/types'
import { act, useStore } from '../../store'
import { CardBack } from '../art/CardBack'
import { sfx } from '../audio'
import { useFx } from '../fx'
import { rectOf, usePress } from '../hooks'
import { cardDebuffed, PlayingCard } from './Items'
import { RichText } from './RichText'
import { ScorePanel } from './ScorePanel'

interface P {
  x: number
  y: number
  r: number
}
interface Zone {
  x: number
  y: number
  w: number
  h: number
}
interface Geo {
  play: Zone
  hand: Zone
  deck: Zone
  cw: number
  ch: number
  w: number
  h: number
}

function useGeo(stage: RefObject<HTMLElement | null>, play: RefObject<HTMLElement | null>, hand: RefObject<HTMLElement | null>, deck: RefObject<HTMLElement | null>) {
  const [geo, setGeo] = useState<Geo | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      if (!stage.current || !play.current || !hand.current || !deck.current) return
      const s = stage.current.getBoundingClientRect()
      const rel = (el: HTMLElement): Zone => {
        const b = el.getBoundingClientRect()
        return { x: b.left - s.left, y: b.top - s.top, w: b.width, h: b.height }
      }
      setGeo({
        play: rel(play.current),
        hand: rel(hand.current),
        deck: rel(deck.current),
        cw: deck.current.offsetWidth,
        ch: deck.current.offsetHeight,
        w: s.width,
        h: s.height,
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(stage.current!)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [stage, play, hand, deck])
  return geo
}

export function fanSlots(n: number, zone: Zone, cw: number, ch: number) {
  if (!n) return { x0: zone.x, step: cw, pos: [] as P[] }
  const step = n > 1 ? Math.min(cw * 1.04, (zone.w - cw) / (n - 1)) : 0
  const total = step * (n - 1) + cw
  const x0 = zone.x + (zone.w - total) / 2
  const mid = (n - 1) / 2
  const pos = Array.from({ length: n }, (_, i) => {
    const t = mid ? (i - mid) / mid : 0
    return { x: x0 + i * step, y: zone.y + zone.h - ch - 4 + t * t * ch * 0.06, r: t * Math.min(5, n * 0.6) }
  })
  return { x0, step, pos }
}

function rowSlots(n: number, zone: Zone, cw: number, ch: number): P[] {
  const gap = cw * 0.1
  const total = n * cw + (n - 1) * gap
  const x0 = zone.x + (zone.w - total) / 2
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * (cw + gap), y: zone.y + (zone.h - ch) / 2, r: 0 }))
}

const tf = (p: P) => `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.r}deg)`

interface TableCardProps {
  fresh: boolean
  card: Card
  g: GameState
  p: P
  z: number
  delay: number
  selected: boolean
  dim: boolean
  dragging: boolean
  interactive: boolean
  onTap: () => void
  onLong: (el: HTMLElement) => void
  onDragStart: () => void
  onDragMove: (dx: number) => void
  onDragEnd: () => void
}

function TableCard(props: TableCardProps) {
  const { card, g, p, z, delay, selected, dim, dragging, interactive, fresh } = props
  const ref = useRef<HTMLDivElement>(null)
  const press = usePress(
    interactive
      ? {
          onTap: props.onTap,
          onLongPress: () => ref.current && props.onLong(ref.current),
          onDragStart: props.onDragStart,
          onDragMove: (dx) => props.onDragMove(dx),
          onDragEnd: props.onDragEnd,
        }
      : {},
  )
  return (
    <div
      ref={ref}
      className={`tcard${fresh ? ' is-fresh' : ''}${selected ? ' is-sel' : ''}${dragging ? ' is-drag' : ''}${dim ? ' is-dim' : ''}${interactive ? ' is-live' : ''}`}
      style={{ transform: tf(p), zIndex: z, transitionDelay: delay ? `${delay}ms` : undefined }}
      role={interactive ? 'button' : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-label={card.faceDown ? 'Face-down card' : cardName(card)}
      tabIndex={interactive ? 0 : -1}
      {...press}
    >
      <PlayingCard card={card} deck={g.deck} faceDown={card.faceDown} debuffed={cardDebuffed(g, card)} />
    </div>
  )
}

interface Ghost {
  id: string
  key: string
  card: Card
  from: P
  destroyed: boolean
  delay: number
}

function GhostCard({ ghost, to, deck }: { ghost: Ghost; to: P; deck: string }) {
  const [go, setGo] = useState(false)
  useEffect(() => {
    let r2 = 0
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setGo(true))
    })
    return () => {
      cancelAnimationFrame(r1)
      cancelAnimationFrame(r2)
    }
  }, [])
  const p = go ? (ghost.destroyed ? { ...ghost.from, r: -14 } : to) : ghost.from
  return (
    <div
      className={`tcard is-ghost${ghost.destroyed ? ' is-torn' : ''}${go ? ' go' : ''}`}
      style={{ transform: tf(p), transitionDelay: `${ghost.delay}ms`, zIndex: 60 }}
      aria-hidden="true"
    >
      <PlayingCard card={ghost.card} deck={deck} />
    </div>
  )
}

export function RoundStage() {
  const g = useStore((s) => s.game!)
  const setModal = useStore((s) => s.setModal)
  const setInspect = useStore((s) => s.setInspect)
  const scoringIds = useFx((s) => s.scoringIds)
  const r = g.round!
  const scoring = g.phase === 'scoring'
  const live = g.phase === 'round'

  const stage = useRef<HTMLDivElement>(null)
  const playZone = useRef<HTMLDivElement>(null)
  const handZone = useRef<HTMLDivElement>(null)
  const deckEl = useRef<HTMLButtonElement>(null)
  const geo = useGeo(stage, playZone, handZone, deckEl)

  const [drag, setDrag] = useState<{ id: string; from: number; dx: number } | null>(null)
  const [deal, setDeal] = useState<{ ready: Set<string>; delays: Record<string, number> }>(() => ({ ready: new Set(), delays: {} }))
  const ready = deal.ready
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const prev = useRef<{ pos: Map<string, P>; cards: Record<string, Card> } | null>(null)

  const handIds = r.hand
  const playedIds = r.played
  const liveIds = [...handIds, ...playedIds]
  const pos = new Map<string, P>()
  let dragTarget = -1

  if (geo) {
    const fan = fanSlots(handIds.length, geo.hand, geo.cw, geo.ch)
    let order = handIds
    if (drag && fan.pos[drag.from]) {
      const x = fan.pos[drag.from].x + drag.dx
      dragTarget = Math.max(0, Math.min(handIds.length - 1, Math.round((x - fan.x0) / (fan.step || 1))))
      order = handIds.filter((id) => id !== drag.id)
      order.splice(dragTarget, 0, drag.id)
    }
    order.forEach((id, i) => {
      const base = fan.pos[i]
      if (drag?.id === id) pos.set(id, { x: fan.pos[drag.from].x + drag.dx, y: base.y - geo.ch * 0.12, r: 0 })
      else pos.set(id, { x: base.x, y: base.y - (r.selected.includes(id) ? geo.ch * 0.2 : 0), r: base.r })
    })
    const row = rowSlots(playedIds.length, geo.play, geo.cw, geo.ch)
    playedIds.forEach((id, i) => {
      const lift = scoring && scoringIds.includes(id) ? geo.ch * 0.1 : 0
      pos.set(id, { ...row[i], y: row[i].y - lift })
    })
  }

  const fresh = geo ? liveIds.filter((id) => !ready.has(id)) : []
  const freshKey = fresh.join(',')
  useEffect(() => {
    if (!freshKey) return
    const ids = freshKey.split(',')
    const speed = useStore.getState().settings.speed
    sfx('deal')
    let r2 = 0
    let clear = 0
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        setDeal((d) => {
          const nextReady = new Set(d.ready)
          const delays = { ...d.delays }
          ids.forEach((id, i) => {
            nextReady.add(id)
            delays[id] = (i * 55) / speed
          })
          return { ready: nextReady, delays }
        })
        clear = window.setTimeout(
          () =>
            setDeal((d) => {
              const delays = { ...d.delays }
              for (const id of ids) delete delays[id]
              return { ready: d.ready, delays }
            }),
          (ids.length * 55 + 450) / speed,
        )
      })
    })
    return () => {
      cancelAnimationFrame(r1)
      cancelAnimationFrame(r2)
      window.clearTimeout(clear)
    }
  }, [freshKey])

  useLayoutEffect(() => {
    const p = prev.current
    if (p && geo) {
      const liveSet = new Set(liveIds)
      const gone = [...p.pos.keys()].filter((id) => !liveSet.has(id))
      if (gone.length) {
        const stamp = Date.now()
        setGhosts((gs) => [
          ...gs,
          ...gone.map((id, i) => ({ id, key: `${id}-${stamp}`, card: p.cards[id], from: p.pos.get(id)!, destroyed: !g.cards[id], delay: i * 45 })),
        ])
        window.setTimeout(() => setGhosts((gs) => gs.filter((x) => !gone.includes(x.id))), 800)
      }
    }
    const cards: Record<string, Card> = {}
    for (const id of liveIds) cards[id] = g.cards[id]
    prev.current = { pos: new Map(pos), cards }
  })

  const boss = roundBoss(g)
  const sel = r.selected.length
  const canPlay = live && sel > 0 && r.handsLeft > 0
  const canDiscard = live && sel > 0 && r.discardsLeft > 0
  const deckP: P | null = geo ? { x: geo.deck.x, y: geo.deck.y, r: 0 } : null
  const discardTo: P | null = geo ? { x: geo.w + geo.cw * 0.6, y: geo.play.y, r: 24 } : null

  return (
    <div
      className={`round${scoring ? ' is-scoring' : ''}`}
      ref={stage}
      onPointerDown={scoring ? () => useFx.getState().set({ skip: true }) : undefined}
    >
      <div className="round-panel">
        <ScorePanel />
      </div>
      <div className="round-boss">
        {boss && (
          <div className="boss-note" style={{ '--accent': boss.color } as React.CSSProperties}>
            <strong>{boss.name}</strong>
            <span>
              <RichText text={boss.text} />
            </span>
          </div>
        )}
      </div>
      <div className="zone round-play" ref={playZone} />
      <div className="zone round-hand" ref={handZone} />
      <div className="round-deck">
        <button className="deck-pile" ref={deckEl} onClick={() => setModal('deck')} aria-label={`Deck: ${r.draw.length} cards left. Tap to view`}>
          <CardBack deck={g.deck} />
        </button>
        <span className="deck-count">
          {r.draw.length}/{deckSize(g)}
        </span>
      </div>

      <button
        className="btn btn-discard round-discard"
        disabled={!canDiscard}
        onClick={() => {
          sfx('discard')
          act(E.discard)
        }}
      >
        <span className="btn-label">Discard</span>
        <span className="btn-sub">{r.discardsLeft} left</span>
      </button>
      <div className="sort round-sort" role="group" aria-label="Sort hand">
        <span className="sort-label">Sort</span>
        <button aria-pressed={g.sort === 'rank'} onClick={() => act((d) => E.setSort(d, 'rank'))}>
          Rank
        </button>
        <button aria-pressed={g.sort === 'suit'} onClick={() => act((d) => E.setSort(d, 'suit'))}>
          Suit
        </button>
      </div>
      <button
        className="btn btn-play round-playbtn"
        disabled={!canPlay}
        onClick={() => {
          sfx('play')
          act(E.playHand)
        }}
      >
        <span className="btn-label">Play hand</span>
        <span className="btn-sub">{r.handsLeft} left</span>
      </button>

      {geo &&
        liveIds.map((id, i) => {
          const card = g.cards[id]
          const target = pos.get(id)
          if (!card || !target) return null
          const inHand = i < handIds.length
          const isFresh = !ready.has(id)
          const p = isFresh && deckP ? deckP : target
          const handOrderIdx = inHand ? handIds.indexOf(id) : 0
          return (
            <TableCard
              key={id}
              fresh={isFresh}
              card={card}
              g={g}
              p={p}
              z={drag?.id === id ? 90 : inHand ? 10 + handOrderIdx : 40 + i}
              delay={deal.delays[id] ?? 0}
              selected={r.selected.includes(id)}
              dim={scoring && !inHand && !scoringIds.includes(id)}
              dragging={drag?.id === id}
              interactive={live && inHand}
              onTap={() => {
                const was = r.selected.includes(id)
                if (!was && r.selected.length >= 5) return
                sfx(was ? 'deselect' : 'select')
                act((d) => E.toggleSelect(d, id))
              }}
              onLong={(el) => setInspect({ kind: 'card', id, rect: rectOf(el) })}
              onDragStart={() => setDrag({ id, from: handIds.indexOf(id), dx: 0 })}
              onDragMove={(dx) => setDrag((d) => (d ? { ...d, dx } : d))}
              onDragEnd={() => {
                const from = handIds.indexOf(id)
                if (dragTarget >= 0 && dragTarget !== from) act((d) => E.moveHandCard(d, from, dragTarget))
                setDrag(null)
              }}
            />
          )
        })}
      {geo && discardTo && ghosts.map((gh) => <GhostCard key={gh.key} ghost={gh} to={discardTo} deck={g.deck} />)}
    </div>
  )
}

