import { EDITION_INFO, makeCard, RANKS, SUITS } from './cards'
import { PLATES, STAMPS } from './consumables'
import { HANDS } from './hands'
import { effectiveJokerSlots, JOKERS, JOKER_MAP, type Rarity } from './jokers'
import { pick, rand, weighted } from './rng'
import type { Card, Edition, Enhancement, GameState, HandType, JokerInst, Rank, Seal, Suit } from './types'

export function newId(g: GameState, prefix: string): string {
  g.nextId += 1
  return `${prefix}${g.nextId}`
}

export function levelUp(g: GameState, hand: HandType, n = 1) {
  g.levels[hand].level += n
}

export function makeJoker(g: GameState, key: string, ed?: Edition): JokerInst {
  const def = JOKER_MAP[key]
  return {
    id: newId(g, 'j'),
    key,
    ed,
    cost: def.cost + (ed ? EDITION_INFO[ed].cost : 0),
    extraSell: 0,
    s: { ...(def.init ?? {}) },
  }
}

export function rollEdition(g: GameState, rate = 1): Edition | undefined {
  const r = rand(g)
  if (r < 0.003 * rate) return 'ghost'
  if (r < 0.006 * rate) return 'prism'
  if (r < 0.02 * rate) return 'holo'
  if (r < 0.04 * rate) return 'glossy'
  return undefined
}

export function rollRarity(g: GameState): Rarity {
  return weighted<Rarity>(g, [
    [1, 70],
    [2, 25],
    [3, 5],
  ])
}

/** Keys of jokers already owned or on offer, so they don't show up twice. */
export function takenJokerKeys(g: GameState): Set<string> {
  const keys = new Set(g.jokers.map((j) => j.key))
  for (const it of g.shop?.items ?? []) if (it.kind === 'joker') keys.add(it.joker.key)
  for (const c of g.pack?.choices ?? []) if (c.kind === 'joker') keys.add(c.joker.key)
  return keys
}

export function randomJokerKey(g: GameState, rarity?: Rarity, exclude: Set<string> = takenJokerKeys(g)): string {
  const r = rarity ?? rollRarity(g)
  let pool = JOKERS.filter((j) => j.rarity === r && !exclude.has(j.key))
  if (!pool.length) pool = JOKERS.filter((j) => !exclude.has(j.key))
  if (!pool.length) pool = JOKERS
  return pick(g, pool).key
}

export function unlockedHands(g: GameState): HandType[] {
  return (Object.keys(HANDS) as HandType[]).filter((h) => !HANDS[h].secret || g.levels[h].played > 0)
}

export function randomPlateKey(g: GameState): string {
  const hands = new Set(unlockedHands(g))
  return pick(g, PLATES.filter((p) => hands.has(p.hand!))).key
}

export function randomStampKey(g: GameState, exclude: Set<string> = new Set()): string {
  const pool = STAMPS.filter((s) => !exclude.has(s.key))
  return pick(g, pool.length ? pool : STAMPS).key
}

export function addCons(g: GameState, key: string): boolean {
  if (g.cons.length >= g.consSlots) return false
  g.cons.push({ id: newId(g, 'k'), key })
  return true
}

export function canAddJoker(g: GameState, j: JokerInst): boolean {
  return g.jokers.length < effectiveJokerSlots(g) + (j.ed === 'ghost' ? 1 : 0)
}

export function addJoker(g: GameState, j: JokerInst): boolean {
  if (!canAddJoker(g, j)) return false
  g.jokers.push(j)
  return true
}

const without = (arr: string[], id: string) => {
  const i = arr.indexOf(id)
  if (i >= 0) arr.splice(i, 1)
}

/** Remove a card from the run entirely. */
export function destroyCard(g: GameState, id: string) {
  delete g.cards[id]
  const r = g.round
  if (r) {
    without(r.hand, id)
    without(r.draw, id)
    without(r.discard, id)
    without(r.played, id)
    without(r.selected, id)
  }
  if (g.pack) {
    without(g.pack.hand, id)
    without(g.pack.selected, id)
  }
}

const ENHS: Enhancement[] = ['embossed', 'fluoro', 'rainbow', 'tissue', 'stock', 'blank', 'gilded', 'scratch']
const SEALS: Seal[] = ['coin', 'echo', 'plate', 'stamp']

/** A random playing card for packs and the shop. */
export function randomCard(g: GameState, opts: { enh: number; ed: number; seal: number }): Card {
  const suit = pick<Suit>(g, SUITS)
  const rank = pick<Rank>(g, RANKS)
  const card = makeCard(newId(g, 'c'), suit, rank)
  if (rand(g) < opts.enh) card.enh = pick(g, ENHS)
  if (rand(g) < opts.ed) card.ed = pick<Edition>(g, ['glossy', 'glossy', 'holo', 'prism'])
  if (rand(g) < opts.seal) card.seal = pick(g, SEALS)
  return card
}

export function deckSize(g: GameState): number {
  return Object.keys(g.cards).length
}
