import { isDebuffed, roundBoss } from './blinds'
import { rankChips } from './cards'
import { evaluate, handValues, HANDS, type EvalOpts } from './hands'
import { hasFlag, JOKER_MAP, type JokerDef } from './jokers'
import { chance } from './rng'
import type { Card, GameState, HandType, JokerInst, ScoreEvent, ScoreResult } from './types'

export interface Ctx {
  g: GameState
  hand: HandType
  played: Card[]
  scoring: Card[]
  held: Card[]
  contains: Record<HandType, boolean>
  /** True on the last hand of the round. */
  final: boolean
  opts: EvalOpts
  events: ScoreEvent[]
  chips: number
  mult: number
  money: number
}

export interface Effect {
  chips?: number
  mult?: number
  xmult?: number
  money?: number
  msg?: string
}

export function evalOpts(g: GameState): EvalOpts {
  return {
    fourFingers: hasFlag(g, 'fourFingers'),
    shortcut: hasFlag(g, 'shortcut'),
    smeared: hasFlag(g, 'smeared'),
    splash: hasFlag(g, 'splash'),
  }
}

export const fmtMult = (x: number) => String(Math.round(x * 100) / 100)

function apply(ctx: Ctx, t: ScoreEvent['t'], target: string, eff: Effect, sub?: string) {
  const ev = (label: string, tone: ScoreEvent['tone'], money?: number) =>
    ctx.events.push({ t, target, sub, chips: ctx.chips, mult: ctx.mult, label, tone, money })
  if (eff.msg) ev(eff.msg, 'info')
  if (eff.chips) {
    ctx.chips += eff.chips
    ev(`+${eff.chips}`, 'chips')
  }
  if (eff.mult) {
    ctx.mult += eff.mult
    ev(`+${eff.mult} Mult`, 'mult')
  }
  if (eff.xmult && eff.xmult !== 1) {
    ctx.mult *= eff.xmult
    ev(`×${fmtMult(eff.xmult)} Mult`, 'xmult')
  }
  if (eff.money) {
    ctx.money += eff.money
    ctx.g.money += eff.money
    ev(`+$${eff.money}`, 'money', eff.money)
  }
}

/** The definition a joker slot acts as, following Copycat chains to the right. */
export function effectiveJoker(g: GameState, i: number, depth = 0): { def: JokerDef; inst: JokerInst } | null {
  const inst = g.jokers[i]
  if (!inst || depth > g.jokers.length) return null
  const def = JOKER_MAP[inst.key]
  if (def.key !== 'copycat') return { def, inst }
  const target = effectiveJoker(g, i + 1, depth + 1)
  if (!target || target.def.noCopy) return null
  return target
}

function forJokers(g: GameState, fn: (def: JokerDef, inst: JokerInst, slot: JokerInst, index: number) => void) {
  g.jokers.forEach((slot, i) => {
    const e = effectiveJoker(g, i)
    if (e) fn(e.def, e.inst, slot, i)
  })
}

function scoreCard(ctx: Ctx, card: Card) {
  const { g } = ctx
  const chips = card.enh === 'blank' ? 50 : rankChips(card.rank) + card.bonus + (card.enh === 'embossed' ? 30 : 0)
  apply(ctx, 'card', card.id, { chips })
  if (card.enh === 'fluoro') apply(ctx, 'card', card.id, { mult: 4 })
  if (card.enh === 'scratch') {
    let paid = 0
    if (chance(g, 5)) {
      apply(ctx, 'card', card.id, { mult: 20 })
      paid++
    }
    if (chance(g, 15)) {
      apply(ctx, 'card', card.id, { money: 20 })
      paid++
    }
    for (let k = 0; k < paid; k++) for (const j of g.jokers) JOKER_MAP[j.key].onScratch?.(g, j)
  }
  if (card.enh === 'tissue') apply(ctx, 'card', card.id, { xmult: 2 })
  if (card.ed === 'glossy') apply(ctx, 'card', card.id, { chips: 50 })
  if (card.ed === 'holo') apply(ctx, 'card', card.id, { mult: 10 })
  if (card.ed === 'prism') apply(ctx, 'card', card.id, { xmult: 1.5 })
  if (card.seal === 'coin') apply(ctx, 'card', card.id, { money: 3 })
  forJokers(g, (def, inst, slot) => {
    const eff = def.onScored?.(ctx, inst, card)
    if (eff) apply(ctx, 'joker', slot.id, eff, card.id)
  })
}

function scoreHeld(ctx: Ctx, card: Card) {
  if (card.enh === 'stock') apply(ctx, 'held', card.id, { xmult: 1.5 })
  forJokers(ctx.g, (def, inst, slot) => {
    const eff = def.onHeld?.(ctx, inst, card)
    if (eff) apply(ctx, 'joker', slot.id, eff, card.id)
  })
}

function retriggers(ctx: Ctx, card: Card, zone: 'played' | 'held', index: number): number {
  let n = card.seal === 'echo' ? 1 : 0
  forJokers(ctx.g, (def, inst) => {
    n += def.retrigger?.(ctx, inst, card, zone, index) ?? 0
  })
  return n
}

/**
 * Scores a played hand. Mutates `g` (money, joker counters, hand stats, rng) and
 * returns a timeline of events for the UI to play back.
 */
export function computeScore(g: GameState, playedIds: string[], heldIds: string[]): ScoreResult {
  const r = g.round!
  const played = playedIds.map((id) => g.cards[id])
  const held = heldIds.map((id) => g.cards[id]).filter(Boolean)
  const opts = evalOpts(g)
  const ev = evaluate(played, opts)
  const boss = roundBoss(g)
  const ctx: Ctx = {
    g,
    hand: ev.type,
    played,
    scoring: ev.scoring,
    held,
    contains: ev.contains,
    final: r.handsLeft === 0,
    opts,
    events: [],
    chips: 0,
    mult: 0,
    money: 0,
  }

  g.levels[ev.type].played += 1
  let blocked: string | undefined
  if (boss?.rules.mustPlay5 && played.length < 5) blocked = 'Needs 5 cards'
  else if (boss?.rules.oneType && r.typesPlayed.length && r.typesPlayed[0] !== ev.type)
    blocked = `Only ${HANDS[r.typesPlayed[0]].name}`
  else if (boss?.rules.noRepeat && r.typesPlayed.includes(ev.type)) blocked = 'Already played'
  r.typesPlayed.push(ev.type)
  r.lastHand = ev.type

  const setBase = () => {
    const base = handValues(ev.type, g.levels[ev.type].level)
    ctx.chips = base.chips
    ctx.mult = base.mult
    if (boss?.rules.halfBase) {
      ctx.chips = Math.floor(ctx.chips / 2)
      ctx.mult = Math.max(1, Math.floor(ctx.mult / 2))
    }
  }
  setBase()

  const finish = (): ScoreResult => ({
    hand: ev.type,
    level: g.levels[ev.type].level,
    events: ctx.events,
    chips: ctx.chips,
    mult: ctx.mult,
    total: blocked ? 0 : Math.floor(ctx.chips * ctx.mult),
    money: ctx.money,
    scoringIds: ev.scoring.map((c) => c.id),
    destroyed,
    blocked,
  })
  const destroyed: string[] = []

  if (blocked) {
    ctx.events.push({ t: 'base', chips: ctx.chips, mult: ctx.mult, label: HANDS[ev.type].name })
    ctx.events.push({ t: 'note', chips: 0, mult: 0, label: blocked, tone: 'bad' })
    ctx.chips = 0
    ctx.mult = 0
    return finish()
  }

  for (const j of g.jokers) {
    const eff = JOKER_MAP[j.key].before?.(ctx, j)
    if (eff) apply(ctx, 'joker', j.id, eff)
  }
  setBase()
  ctx.events.push({ t: 'base', chips: ctx.chips, mult: ctx.mult, label: HANDS[ev.type].name })

  ev.scoring.forEach((card, index) => {
    if (isDebuffed(g, card)) {
      ctx.events.push({ t: 'note', target: card.id, chips: ctx.chips, mult: ctx.mult, label: 'Debuffed', tone: 'bad' })
      return
    }
    const reps = 1 + retriggers(ctx, card, 'played', index)
    for (let k = 0; k < reps; k++) {
      if (k > 0) ctx.events.push({ t: 'note', target: card.id, chips: ctx.chips, mult: ctx.mult, label: 'Again!', tone: 'info' })
      scoreCard(ctx, card)
    }
  })

  held.forEach((card, index) => {
    if (isDebuffed(g, card)) return
    const reps = 1 + retriggers(ctx, card, 'held', index)
    for (let k = 0; k < reps; k++) {
      const before = ctx.events.length
      scoreHeld(ctx, card)
      if (k > 0 && ctx.events.length > before)
        ctx.events.splice(before, 0, { t: 'note', target: card.id, chips: ctx.chips, mult: ctx.mult, label: 'Again!', tone: 'info' })
    }
  })

  g.jokers.forEach((slot, i) => {
    if (slot.ed === 'glossy') apply(ctx, 'joker', slot.id, { chips: 50 })
    if (slot.ed === 'holo') apply(ctx, 'joker', slot.id, { mult: 10 })
    const e = effectiveJoker(g, i)
    const eff = e?.def.main?.(ctx, e.inst)
    if (eff) apply(ctx, 'joker', slot.id, eff)
    forJokers(g, (def, inst) => {
      const o = def.onOther?.(ctx, inst, slot)
      if (o) apply(ctx, 'joker', slot.id, o)
    })
    if (slot.ed === 'prism') apply(ctx, 'joker', slot.id, { xmult: 1.5 })
  })

  for (const card of ev.scoring) {
    if (card.enh === 'tissue' && !isDebuffed(g, card) && chance(g, 4)) destroyed.push(card.id)
  }
  for (const j of g.jokers) JOKER_MAP[j.key].after?.(ctx, j)
  for (let k = 0; k < destroyed.length; k++) for (const j of g.jokers) JOKER_MAP[j.key].onTear?.(g, j)

  return finish()
}

/** Hand type and base values for the cards currently selected (for the preview panel). */
export function previewHand(g: GameState, ids: string[]) {
  if (!ids.length) return null
  const cards = ids.map((id) => g.cards[id]).filter(Boolean)
  const ev = evaluate(cards, evalOpts(g))
  const lvl = g.levels[ev.type].level
  const base = handValues(ev.type, lvl)
  const boss = roundBoss(g)
  if (boss?.rules.halfBase) {
    base.chips = Math.floor(base.chips / 2)
    base.mult = Math.max(1, Math.floor(base.mult / 2))
  }
  return { type: ev.type, level: lvl, ...base, scoringIds: ev.scoring.map((c) => c.id) }
}
