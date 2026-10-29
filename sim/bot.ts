/**
 * An honest bot for balance testing. It plays with the real engine, never peeks at the deck,
 * and scores candidate plays on a throwaway copy whose RNG differs from the real one,
 * so lucky rolls can't be foreseen.
 */
import { canUseCons, consDef } from '../src/game/consumables'
import * as E from '../src/game/engine'
import { HAND_ORDER } from '../src/game/hands'
import { effectiveJokerSlots, JOKER_MAP } from '../src/game/jokers'
import { PACKS } from '../src/game/meta'
import { canAddJoker, makeJoker } from '../src/game/ops'
import { computeScore, previewHand } from '../src/game/scoring'

// The engine's "use a consumable" action (named so it isn't mistaken for a React hook).
const spend = E.useCons
import type { Card, GameState, HandType, JokerInst } from '../src/game/types'

function lightClone(g: GameState): GameState {
  const r = g.round!
  return {
    ...g,
    rng: (g.rng ^ 0x9e3779b9) >>> 0,
    jokers: g.jokers.map((j) => ({ ...j, s: { ...j.s } })),
    levels: Object.fromEntries(Object.entries(g.levels).map(([k, v]) => [k, { ...v }])) as GameState['levels'],
    round: { ...r, typesPlayed: [...r.typesPlayed] },
    stats: { ...g.stats },
    notices: [],
  }
}

/** Expected score of playing these cards now. */
export function estimate(g: GameState, ids: string[]): number {
  const c = lightClone(g)
  const r = c.round!
  r.hand = r.hand.filter((id) => !ids.includes(id))
  r.handsLeft -= 1
  return computeScore(c, ids, r.hand).total
}

function combos(ids: string[], max = 5): string[][] {
  const out: string[][] = []
  const pick = (start: number, cur: string[]) => {
    if (cur.length) out.push([...cur])
    if (cur.length === max) return
    for (let i = start; i < ids.length; i++) {
      cur.push(ids[i])
      pick(i + 1, cur)
      cur.pop()
    }
  }
  pick(0, [])
  return out
}

export function bestPlay(g: GameState): { ids: string[]; score: number } {
  const hand = g.round!.hand
  let best = { ids: [hand[0]], score: -1 }
  for (const ids of combos(hand)) {
    const score = estimate(g, ids)
    if (score > best.score || (score === best.score && ids.length > best.ids.length)) best = { ids, score }
  }
  return best
}

const cardChips = (c: Card) => (c.enh === 'blank' ? 0 : c.rank === 14 ? 11 : Math.min(10, c.rank))

/** Cards to throw away when fishing for a better hand: keep only what scores, pairs, and 4-card draws. */
function discardPick(g: GameState, best: string[]): string[] {
  const r = g.round!
  const cards = r.hand.map((id) => g.cards[id])
  const scoring = new Set(previewHand(g, best)?.scoringIds ?? [])
  const bySuit = new Map<string, Card[]>()
  const byRank = new Map<number, number>()
  for (const c of cards) {
    bySuit.set(c.suit, [...(bySuit.get(c.suit) ?? []), c])
    byRank.set(c.rank, (byRank.get(c.rank) ?? 0) + 1)
  }
  const keep = new Set<string>(scoring)
  for (const c of cards) if ((byRank.get(c.rank) ?? 0) >= 2 || c.enh === 'stock' || c.enh === 'gilded') keep.add(c.id)
  for (const group of bySuit.values()) if (group.length >= 4) for (const c of group) keep.add(c.id)
  // Four ranks within a five-rank window is a straight draw.
  const ranks = [...new Set(cards.map((c) => c.rank))].sort((a, b) => a - b)
  for (const lo of ranks) {
    const window = ranks.filter((x) => x >= lo && x < lo + 5)
    if (window.length >= 4) for (const c of cards) if (window.includes(c.rank)) keep.add(c.id)
  }
  const toss = cards.filter((c) => !keep.has(c.id)).sort((a, b) => cardChips(a) - cardChips(b))
  return toss.slice(0, 5).map((c) => c.id)
}

function topHands(g: GameState, n = 2): HandType[] {
  return [...HAND_ORDER].sort((a, b) => g.levels[b].played - g.levels[a].played).slice(0, n)
}

/** Picks target cards for a stamp from the given hand. */
function stampTargets(g: GameState, key: string, hand: string[]): string[] | null {
  const def = consDef(key)
  if (def.max === 0) return []
  const cards = hand.map((id) => g.cards[id]).filter((c) => c && !c.faceDown)
  const high = [...cards].sort((a, b) => cardChips(b) - cardChips(a))
  const low = [...cards].sort((a, b) => cardChips(a) - cardChips(b))
  const suitFor: Record<string, Card['suit']> = { redink: 'H', orangeink: 'D', blueink: 'S', greenink: 'C' }
  if (suitFor[key]) return cards.filter((c) => c.suit !== suitFor[key]).slice(0, def.max).map((c) => c.id)
  if (key === 'shred' || key === 'blankout') return low.slice(0, def.max).map((c) => c.id)
  if (key === 'duplicate') return low.length >= 2 ? [low[0].id, high[0].id] : null
  return high.slice(0, def.max).map((c) => c.id)
}

function applyStamps(g: GameState, hand: string[], select: (ids: string[]) => void) {
  for (const cons of [...g.cons]) {
    const def = consDef(cons.key)
    if (def.kind !== 'stamp') continue
    const targets = stampTargets(g, cons.key, hand)
    if (!targets || targets.length < def.min) continue
    select(targets)
    if (E.consUsable(g, cons.id)) spend(g, cons.id)
    else select([])
  }
}

function applyPlates(g: GameState) {
  for (const cons of [...g.cons]) {
    const def = consDef(cons.key)
    if (def.kind === 'plate' || def.max === 0) {
      if (E.consUsable(g, cons.id)) spend(g, cons.id)
    }
  }
}

/** Measured worth of each Joker (avg antes gained), loaded from a previous `jokers` experiment if present. */
let measured: Record<string, number> = {}
export function setJokerValues(v: Record<string, number>) {
  measured = v
}
let pinned: string | null = null

const jokerValue = (j: JokerInst) =>
  (measured[j.key] !== undefined ? measured[j.key] * 40 : (JOKER_MAP[j.key]?.rarity ?? 1) * 10 + j.cost) + (j.ed ? 4 : 0)

function shopTurn(g: GameState) {
  const s = g.shop!
  applyPlates(g)
  if (g.anteVoucher && g.money >= E.priceOf(g, 10) + 6) E.buyVoucher(g)
  for (const it of [...s.items]) {
    if (!g.shop!.items.includes(it) || g.money < it.price) continue
    if (it.kind === 'joker') {
      if (canAddJoker(g, it.joker)) E.buyItem(g, it.id)
      else {
        const weakest = [...g.jokers].filter((j) => j.id !== pinned).sort((a, b) => jokerValue(a) - jokerValue(b))[0]
        if (weakest && jokerValue(it.joker) > jokerValue(weakest) + 3) {
          E.sellJoker(g, weakest.id)
          E.buyItem(g, it.id)
        }
      }
    } else if (it.kind === 'cons') {
      const def = consDef(it.cons.key)
      const wanted = def.kind === 'plate' ? topHands(g).includes(def.hand!) || g.stats.handsPlayed < 4 : true
      if (!wanted) continue
      if (E.buyAndUseAllowed(g, it) && def.max === 0) E.buyItem(g, it.id, true)
      else if (g.cons.length < g.consSlots) E.buyItem(g, it.id)
    }
  }
  for (const p of [...g.shop!.packs]) {
    if (g.money < p.price) continue
    const kind = PACKS[p.pack].kind
    if (kind === 'joker' && g.jokers.length >= effectiveJokerSlots(g)) continue
    if (kind === 'print') continue
    E.buyPack(g, p.id)
    packTurn(g)
    if (g.phase !== 'shop') return
  }
  if (g.money >= 25 && g.jokers.length < effectiveJokerSlots(g) && g.shop!.rerollCost <= 7) {
    E.reroll(g)
    if (g.shop!.items.some((i) => i.kind === 'joker' && g.money >= i.price)) shopTurn(g)
  }
}

function packTurn(g: GameState) {
  for (let guard = 0; g.phase === 'pack' && guard < 10; guard++) {
    const pk = g.pack!
    const kind = PACKS[pk.pack].kind
    let pickId: string | null = null
    if (kind === 'joker') {
      const js = pk.choices.filter((c) => c.kind === 'joker' && canAddJoker(g, c.joker))
      js.sort((a, b) => (a.kind === 'joker' && b.kind === 'joker' ? jokerValue(b.joker) - jokerValue(a.joker) : 0))
      pickId = js[0]?.id ?? null
    } else if (kind === 'plate') {
      const tops = topHands(g, 3)
      const ranked = [...pk.choices].sort((a, b) => {
        const ha = a.kind === 'cons' ? consDef(a.cons.key).hand : undefined
        const hb = b.kind === 'cons' ? consDef(b.cons.key).hand : undefined
        return (ha && tops.includes(ha) ? 0 : 1) - (hb && tops.includes(hb) ? 0 : 1)
      })
      pickId = ranked[0]?.id ?? null
    } else if (kind === 'stamp') {
      for (const c of pk.choices) {
        if (c.kind !== 'cons') continue
        const targets = stampTargets(g, c.cons.key, pk.hand)
        if (!targets) continue
        pk.selected = targets
        if (E.packChoiceUsable(g, c.id)) {
          pickId = c.id
          break
        }
        pk.selected = []
      }
    }
    if (pickId) E.packPick(g, pickId)
    else E.skipPack(g)
  }
}

/** Set to a function to watch the bot think (see sim/trace.ts). */
export let log: ((line: string) => void) | null = null
export function setLog(fn: typeof log) {
  log = fn
}
const show = (g: GameState, ids: string[]) => ids.map((id) => `${g.cards[id]?.rank}${g.cards[id]?.suit}`).join(' ')

function roundTurn(g: GameState) {
  const r = g.round!
  applyStamps(g, r.hand, (ids) => (r.selected = ids))
  if (g.phase !== 'round') return
  const best = bestPlay(g)
  const needed = r.target - r.score
  log?.(`ante ${g.ante} ${g.blinds[g.blindIdx].kind} ${r.score}/${r.target} h${r.handsLeft} d${r.discardsLeft} draw${r.draw.length} | ${show(g, r.hand)} | best ${best.score}: ${show(g, best.ids)} | jokers ${g.jokers.map((j) => j.key).join(',')}`)
  if (best.score < needed && r.handsLeft > 1 && r.discardsLeft > 0 && best.score * r.handsLeft < needed * 1.15) {
    const toss = discardPick(g, best.ids)
    if (toss.length) {
      r.selected = toss
      E.discard(g)
      return
    }
  }
  r.selected = best.ids
  E.playHand(g)
  if (g.phase === 'scoring') E.finishScoring(g)
}

export interface RunResult {
  won: boolean
  /** Boss blinds this run reached. */
  bosses: string[]
  ante: number
  diedAt: string | null
  hands: number
  jokers: string[]
}

export interface RunOptions {
  seed: string
  deck?: string
  startJoker?: string
  difficulty?: number
  maxActions?: number
}

/** Plays one honest run to a win (ante 8 boss) or a loss. */
export function playRun(opts: RunOptions): RunResult {
  const g = E.newGame(opts.deck ?? 'plain', opts.seed)
  const gAny = g as GameState & { difficulty?: number }
  if (opts.difficulty != null && 'difficulty' in gAny) gAny.difficulty = opts.difficulty
  pinned = null
  if (opts.startJoker) {
    const j = makeJoker(g, opts.startJoker)
    g.jokers.push(j)
    pinned = j.id
  }
  const bosses: string[] = []
  const max = opts.maxActions ?? 6000
  let diedAt: string | null = null
  for (let i = 0; i < max; i++) {
    switch (g.phase) {
      case 'blinds':
        applyPlates(g)
        if (g.blinds[g.blindIdx].kind === 'boss') bosses.push(g.blinds[g.blindIdx].boss!)
        E.selectBlind(g)
        break
      case 'round':
        roundTurn(g)
        break
      case 'scoring':
        E.finishScoring(g)
        break
      case 'cashout':
        E.cashOut(g)
        break
      case 'shop':
        shopTurn(g)
        if (g.phase === 'shop') E.nextRound(g)
        break
      case 'pack':
        packTurn(g)
        break
      case 'won':
        return { won: true, bosses, ante: g.ante, diedAt: null, hands: g.stats.handsPlayed, jokers: g.jokers.map((j) => j.key) }
      case 'over': {
        const b = g.blinds[g.blindIdx]
        diedAt = b.kind === 'boss' ? b.boss! : b.kind
        return { won: false, bosses, ante: g.ante, diedAt, hands: g.stats.handsPlayed, jokers: g.jokers.map((j) => j.key) }
      }
    }
  }
  return { won: false, bosses, ante: g.ante, diedAt: 'timeout', hands: g.stats.handsPlayed, jokers: g.jokers.map((j) => j.key) }
}
