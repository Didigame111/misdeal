import type { Card, HandType, Rank, Suit } from './types'

export interface HandInfo {
  name: string
  chips: number
  mult: number
  /** Chips and Mult gained per level. */
  lvChips: number
  lvMult: number
  plate: string
  /** Hidden from the hand list until played once. */
  secret?: boolean
}

/** Ordered weakest to strongest. */
export const HAND_ORDER: HandType[] = [
  'high',
  'pair',
  'twopair',
  'three',
  'straight',
  'flush',
  'full',
  'four',
  'sflush',
  'five',
  'fhouse',
  'ffive',
]

export const HANDS: Record<HandType, HandInfo> = {
  high: { name: 'High card', chips: 5, mult: 1, lvChips: 10, lvMult: 1, plate: 'Single Sheet' },
  pair: { name: 'Pair', chips: 10, mult: 2, lvChips: 15, lvMult: 1, plate: 'Duplex' },
  twopair: { name: 'Two pair', chips: 20, mult: 2, lvChips: 20, lvMult: 1, plate: 'Quad Fold' },
  three: { name: 'Three of a kind', chips: 30, mult: 3, lvChips: 20, lvMult: 2, plate: 'Triptych' },
  straight: { name: 'Straight', chips: 30, mult: 4, lvChips: 30, lvMult: 3, plate: 'Ruler' },
  flush: { name: 'Flush', chips: 35, mult: 4, lvChips: 15, lvMult: 2, plate: 'Flood Fill' },
  full: { name: 'Full house', chips: 40, mult: 4, lvChips: 25, lvMult: 2, plate: 'Broadsheet' },
  four: { name: 'Four of a kind', chips: 60, mult: 7, lvChips: 30, lvMult: 3, plate: 'Quarto' },
  sflush: { name: 'Straight flush', chips: 100, mult: 8, lvChips: 40, lvMult: 4, plate: 'Gradient' },
  five: { name: 'Five of a kind', chips: 120, mult: 12, lvChips: 35, lvMult: 3, plate: 'Quintet', secret: true },
  fhouse: { name: 'Flush house', chips: 140, mult: 14, lvChips: 40, lvMult: 4, plate: 'Spread', secret: true },
  ffive: { name: 'Flush five', chips: 160, mult: 16, lvChips: 50, lvMult: 3, plate: 'Full Bleed', secret: true },
}

export function handValues(type: HandType, level: number) {
  const h = HANDS[type]
  return {
    chips: h.chips + h.lvChips * (level - 1),
    mult: h.mult + h.lvMult * (level - 1),
  }
}

export interface EvalOpts {
  /** Flushes and straights can be made with 4 cards. */
  fourFingers?: boolean
  /** Straights can skip one rank. */
  shortcut?: boolean
  /** Hearts/Diamonds and Spades/Clubs count as the same suit. */
  smeared?: boolean
  /** Every played card scores. */
  splash?: boolean
}

export interface HandEval {
  type: HandType
  /** Cards that score, in played order. */
  scoring: Card[]
  contains: Record<HandType, boolean>
}

export function cardSuits(c: Card, smeared = false): Suit[] {
  if (c.enh === 'blank') return []
  if (c.enh === 'rainbow') return ['S', 'H', 'C', 'D']
  if (!smeared) return [c.suit]
  return c.suit === 'H' || c.suit === 'D' ? ['H', 'D'] : ['S', 'C']
}

export function hasSuit(c: Card, suit: Suit, smeared = false): boolean {
  return cardSuits(c, smeared).includes(suit)
}

function findFlush(cards: Card[], need: number, smeared: boolean): Card[] | null {
  let best: Card[] | null = null
  for (const s of ['S', 'H', 'C', 'D'] as Suit[]) {
    const matching = cards.filter((c) => hasSuit(c, s, smeared))
    if (matching.length >= need && (!best || matching.length > best.length)) best = matching
  }
  return best
}

function findStraight(cards: Card[], need: number, shortcut: boolean): Card[] | null {
  const ranks = new Set<number>()
  for (const c of cards) {
    ranks.add(c.rank)
    if (c.rank === 14) ranks.add(1)
  }
  const sorted = [...ranks].sort((a, b) => a - b)
  const maxGap = shortcut ? 2 : 1
  let best: number[] = []
  let run: number[] = []
  for (const r of sorted) {
    if (run.length && r - run[run.length - 1] <= maxGap) run.push(r)
    else run = [r]
    if (run.length >= best.length) best = [...run]
  }
  if (best.length < need) return null
  const inRun = new Set(best.map((r) => (r === 1 ? 14 : r)))
  return cards.filter((c) => inRun.has(c.rank))
}

export function evaluate(played: Card[], opts: EvalOpts = {}): HandEval {
  const normal = played.filter((c) => c.enh !== 'blank')
  const need = opts.fourFingers ? 4 : 5

  const groups = new Map<Rank, Card[]>()
  for (const c of normal) {
    const g = groups.get(c.rank)
    if (g) g.push(c)
    else groups.set(c.rank, [c])
  }
  const byCount = [...groups.values()].sort((a, b) => b.length - a.length || b[0].rank - a[0].rank)
  const top = byCount[0]?.length ?? 0
  const second = byCount[1]?.length ?? 0
  const pairs = byCount.filter((g) => g.length >= 2)

  const flush = normal.length >= need ? findFlush(normal, need, !!opts.smeared) : null
  const straight = normal.length >= need ? findStraight(normal, need, !!opts.shortcut) : null

  const contains: Record<HandType, boolean> = {
    high: true,
    pair: top >= 2,
    twopair: pairs.length >= 2 || top >= 4,
    three: top >= 3,
    straight: !!straight,
    flush: !!flush,
    full: top >= 3 && second >= 2,
    four: top >= 4,
    sflush: !!straight && !!flush,
    five: top >= 5,
    fhouse: top >= 3 && second >= 2 && !!flush,
    ffive: top >= 5 && !!flush,
  }

  let type: HandType
  let scoring: Card[]
  if (contains.ffive) {
    type = 'ffive'
    scoring = byCount[0]
  } else if (contains.fhouse) {
    type = 'fhouse'
    scoring = [...byCount[0], ...byCount[1]]
  } else if (contains.five) {
    type = 'five'
    scoring = byCount[0]
  } else if (contains.sflush) {
    type = 'sflush'
    const set = new Set([...straight!, ...flush!])
    scoring = normal.filter((c) => set.has(c))
  } else if (contains.four) {
    type = 'four'
    scoring = byCount[0]
  } else if (contains.full) {
    type = 'full'
    scoring = [...byCount[0], ...byCount[1]]
  } else if (contains.flush) {
    type = 'flush'
    scoring = flush!
  } else if (contains.straight) {
    type = 'straight'
    scoring = straight!
  } else if (contains.three) {
    type = 'three'
    scoring = byCount[0]
  } else if (contains.twopair) {
    type = 'twopair'
    scoring = [...pairs[0], ...pairs[1]]
  } else if (contains.pair) {
    type = 'pair'
    scoring = byCount[0]
  } else {
    type = 'high'
    const highest = [...normal].sort((a, b) => b.rank - a.rank)[0]
    scoring = highest ? [highest] : []
  }

  const scoringSet = new Set(scoring)
  const ordered = played.filter((c) => opts.splash || c.enh === 'blank' || scoringSet.has(c))
  return { type, scoring: ordered, contains }
}
