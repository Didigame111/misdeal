import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { isDebuffed, TAG_MAP } from '../../game/blinds'
import { cardName, EDITION_INFO, ENH_INFO, isFaceRank, rankChips, SEAL_INFO } from '../../game/cards'
import { consDef } from '../../game/consumables'
import * as E from '../../game/engine'
import { JOKER_MAP, RARITY_NAME, sellValue } from '../../game/jokers'
import { packText, PACKS, VOUCHER_MAP, VOUCHER_PRICE } from '../../game/meta'
import { canAddJoker } from '../../game/ops'
import type { Card, ConsInst, Edition, GameState, JokerInst } from '../../game/types'
import { act, useStore, type Inspect } from '../../store'
import { sfx } from '../audio'
import { RichText } from './RichText'

interface Action {
  label: string
  run: () => void
  disabled?: boolean
  tone?: 'primary' | 'sell' | 'plain'
}

interface Content {
  title: string
  kicker?: string
  body: ReactNode
  note?: string
  actions: Action[]
}

function edLine(ed?: Edition) {
  if (!ed) return null
  return (
    <p className="insp-ed">
      <b>{EDITION_INFO[ed].name}:</b> <RichText text={EDITION_INFO[ed].desc} />
    </p>
  )
}

function jokerBody(j: JokerInst, g: GameState) {
  const def = JOKER_MAP[j.key]
  return (
    <>
      <p>
        <RichText text={def.text(j, g)} />
      </p>
      {edLine(j.ed)}
    </>
  )
}

function consBody(c: ConsInst, g: GameState) {
  return (
    <p>
      <RichText text={consDef(c.key).text(g)} />
    </p>
  )
}

function cardBody(c: Card, g: GameState | null) {
  const chips = c.enh === 'blank' ? 50 : rankChips(c.rank) + c.bonus + (c.enh === 'embossed' ? 30 : 0)
  return (
    <>
      <p>
        <RichText text={`+${chips} Chips when scored`} />
      </p>
      {c.enh && (
        <p>
          <b>{ENH_INFO[c.enh].name}:</b> <RichText text={ENH_INFO[c.enh].desc} />
        </p>
      )}
      {edLine(c.ed)}
      {c.seal && (
        <p>
          <b>{SEAL_INFO[c.seal].name}:</b> {SEAL_INFO[c.seal].desc}
        </p>
      )}
      {g && isDebuffed(g, c) && <p className="insp-bad">Debuffed by the boss: this card won't score.</p>}
    </>
  )
}

const stampNeeds = (min: number, max: number) =>
  min === max ? `Select ${min} card${min === 1 ? '' : 's'} first.` : `Select ${min} to ${max} cards first.`

function describe(ins: Inspect, g: GameState, close: () => void): Content | null {
  const run = (fn: (d: GameState) => void, sound: Parameters<typeof sfx>[0] = 'buy') => () => {
    sfx(sound)
    act(fn)
    close()
  }
  const busy = g.phase === 'scoring'
  switch (ins.kind) {
    case 'joker': {
      const j = g.jokers.find((x) => x.id === ins.id)
      if (!j) return null
      const def = JOKER_MAP[j.key]
      return {
        title: def.name,
        kicker: `${RARITY_NAME[def.rarity]} Joker`,
        body: jokerBody(j, g),
        note: g.jokers.length > 1 ? 'Jokers score left to right. Drag to reorder.' : undefined,
        actions: [{ label: `Sell for $${sellValue(j)}`, tone: 'sell', disabled: busy, run: run((d) => E.sellJoker(d, j.id), 'money') }],
      }
    }
    case 'cons': {
      const c = g.cons.find((x) => x.id === ins.id)
      if (!c) return null
      const def = consDef(c.key)
      const usable = E.consUsable(g, c.id)
      const needsCards = def.min > 0
      const noHand = needsCards && g.phase !== 'round' && g.phase !== 'pack'
      return {
        title: def.name,
        kicker: def.kind === 'plate' ? 'Plate' : 'Stamp',
        body: consBody(c, g),
        note: !usable ? (noHand ? 'Use this during a round, with cards selected in your hand.' : needsCards ? stampNeeds(def.min, def.max) : undefined) : undefined,
        actions: [
          { label: 'Use', tone: 'primary', disabled: !usable, run: run((d) => E.useCons(d, c.id), 'xmult') },
          { label: `Sell for $${E.CONS_SELL}`, tone: 'sell', disabled: busy, run: run((d) => E.sellCons(d, c.id), 'money') },
        ],
      }
    }
    case 'card': {
      const c = g.cards[ins.id]
      if (!c) return null
      return {
        title: c.faceDown ? 'Face-down card' : cardName(c),
        kicker: c.faceDown ? undefined : isFaceRank(c.rank) && c.enh !== 'blank' ? 'Face card' : 'Playing card',
        body: c.faceDown ? <p>The boss flipped this card. You'll see it once you play it.</p> : cardBody(c, g),
        actions: [],
      }
    }
    case 'shop': {
      const it = g.shop?.items.find((x) => x.id === ins.id)
      if (!it) return null
      const short = g.money < it.price
      const buy = (useNow = false): Action => ({
        label: useNow ? 'Buy and use' : `Buy for ${it.price ? `$${it.price}` : 'free'}`,
        tone: useNow ? 'plain' : 'primary',
        disabled: short,
        run: run((d) => E.buyItem(d, it.id, useNow)),
      })
      if (it.kind === 'joker') {
        const def = JOKER_MAP[it.joker.key]
        const room = canAddJoker(g, it.joker)
        return {
          title: def.name,
          kicker: `${RARITY_NAME[def.rarity]} Joker`,
          body: jokerBody(it.joker, g),
          note: !room ? 'Your Joker slots are full. Sell one first.' : short ? `You need $${it.price - g.money} more.` : undefined,
          actions: [{ ...buy(), disabled: short || !room }],
        }
      }
      if (it.kind === 'cons') {
        const def = consDef(it.cons.key)
        const room = g.cons.length < g.consSlots
        const canNow = E.buyAndUseAllowed(g, it)
        return {
          title: def.name,
          kicker: def.kind === 'plate' ? 'Plate' : 'Stamp',
          body: consBody(it.cons, g),
          note: !room && !canNow ? 'Your consumable slots are full.' : short ? `You need $${it.price - g.money} more.` : undefined,
          actions: [{ ...buy(), disabled: short || !room }, ...(canNow ? [buy(true)] : [])],
        }
      }
      return {
        title: cardName(it.card),
        kicker: 'Playing card',
        body: (
          <>
            {cardBody(it.card, null)}
            <p className="insp-dim">Buying adds it to your deck.</p>
          </>
        ),
        actions: [buy()],
      }
    }
    case 'packOffer': {
      const p = g.shop?.packs.find((x) => x.id === ins.id)
      if (!p) return null
      return {
        title: PACKS[p.pack].name,
        kicker: 'Booster pack',
        body: <p>{packText(p.pack)}.</p>,
        note: g.money < p.price ? `You need $${p.price - g.money} more.` : undefined,
        actions: [{ label: `Open for ${p.price ? `$${p.price}` : 'free'}`, tone: 'primary', disabled: g.money < p.price, run: run((d) => E.buyPack(d, p.id)) }],
      }
    }
    case 'voucher': {
      if (!g.anteVoucher) return null
      const v = VOUCHER_MAP[g.anteVoucher]
      const price = E.priceOf(g, VOUCHER_PRICE)
      return {
        title: v.name,
        kicker: 'Voucher, lasts the whole run',
        body: <p>{v.text}.</p>,
        note: g.money < price ? `You need $${price - g.money} more.` : undefined,
        actions: [{ label: `Buy for $${price}`, tone: 'primary', disabled: g.money < price, run: run(E.buyVoucher) }],
      }
    }
    case 'choice': {
      const c = g.pack?.choices.find((x) => x.id === ins.id)
      if (!c) return null
      const ok = E.packChoiceUsable(g, c.id)
      const pick = (label: string): Action => ({ label, tone: 'primary', disabled: !ok, run: run((d) => E.packPick(d, c.id), 'xmult') })
      if (c.kind === 'joker') {
        const def = JOKER_MAP[c.joker.key]
        return {
          title: def.name,
          kicker: `${RARITY_NAME[def.rarity]} Joker`,
          body: jokerBody(c.joker, g),
          note: ok ? undefined : 'Your Joker slots are full. Sell one first.',
          actions: [pick('Take')],
        }
      }
      if (c.kind === 'card') {
        return { title: cardName(c.card), kicker: 'Playing card', body: cardBody(c.card, null), actions: [pick('Add to deck')] }
      }
      const def = consDef(c.cons.key)
      return {
        title: def.name,
        kicker: def.kind === 'plate' ? 'Plate' : 'Stamp',
        body: consBody(c.cons, g),
        note: ok ? undefined : def.min > 0 ? stampNeeds(def.min, def.max) : "This can't be used right now.",
        actions: [pick('Use')],
      }
    }
    case 'tag': {
      const t = TAG_MAP[ins.key]
      return t ? { title: t.name, kicker: 'Tag', body: <p>{t.text}.</p>, actions: [] } : null
    }
  }
}

/** Popover with details and actions for whatever was tapped. */
export function Inspector() {
  const inspect = useStore((s) => s.inspect)
  const g = useStore((s) => s.game)
  const setInspect = useStore((s) => s.setInspect)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null)
  const close = () => setInspect(null)

  useEffect(() => {
    if (!inspect) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setInspect(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setInspect(null)
    const onResize = () => setInspect(null)
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [inspect, setInspect])

  const content = inspect && g ? describe(inspect, g, close) : null

  useLayoutEffect(() => {
    if (!inspect || !ref.current) {
      setPos(null)
      return
    }
    const { rect } = inspect
    const w = ref.current.offsetWidth
    const h = ref.current.offsetHeight
    const below = rect.y + rect.h / 2 < window.innerHeight * 0.42
    let top = below ? rect.y + rect.h + 10 : rect.y - h - 10
    top = Math.max(8, Math.min(window.innerHeight - h - 8, top))
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, rect.x + rect.w / 2 - w / 2))
    setPos({ left, top, below })
  }, [inspect, content?.title, content?.note])

  if (!inspect || !content) return null
  return (
    <div
      ref={ref}
      className="inspector"
      role="dialog"
      aria-label={content.title}
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }}
    >
      {content.kicker && <div className="insp-kicker">{content.kicker}</div>}
      <h3 className="insp-title">{content.title}</h3>
      <div className="insp-body">{content.body}</div>
      {content.note && <p className="insp-note">{content.note}</p>}
      {content.actions.length > 0 && (
        <div className="insp-actions">
          {content.actions.map((a) => (
            <button key={a.label} className={`btn btn-small tone-${a.tone ?? 'plain'}`} disabled={a.disabled} onClick={a.run}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
