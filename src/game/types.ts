export type Suit = 'S' | 'H' | 'C' | 'D'
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14

export type Enhancement =
  | 'embossed'
  | 'fluoro'
  | 'rainbow'
  | 'tissue'
  | 'stock'
  | 'blank'
  | 'gilded'
  | 'scratch'

export type Edition = 'glossy' | 'holo' | 'prism' | 'ghost'
export type Seal = 'coin' | 'echo' | 'plate' | 'stamp'

export type HandType =
  | 'high'
  | 'pair'
  | 'twopair'
  | 'three'
  | 'straight'
  | 'flush'
  | 'full'
  | 'four'
  | 'sflush'
  | 'five'
  | 'fhouse'
  | 'ffive'

export interface Card {
  id: string
  suit: Suit
  rank: Rank
  enh?: Enhancement
  ed?: Edition
  seal?: Seal
  /** Permanent extra chips added to this card. */
  bonus: number
  faceDown?: boolean
  usedThisAnte?: boolean
}

export interface JokerInst {
  id: string
  key: string
  ed?: Edition
  /** Base price paid (before discounts), used for the sell value. */
  cost: number
  extraSell: number
  /** Per-instance counters for scaling jokers. */
  s: Record<string, number>
}

export interface ConsInst {
  id: string
  key: string
}

export type ShopItem =
  | { id: string; kind: 'joker'; joker: JokerInst; price: number }
  | { id: string; kind: 'cons'; cons: ConsInst; price: number }
  | { id: string; kind: 'card'; card: Card; price: number }

export type PackKey =
  | 'joker'
  | 'jokerJumbo'
  | 'jokerMega'
  | 'plate'
  | 'plateJumbo'
  | 'plateMega'
  | 'stamp'
  | 'stampJumbo'
  | 'stampMega'
  | 'print'
  | 'printJumbo'
  | 'printMega'

export interface PackOffer {
  id: string
  pack: PackKey
  price: number
}

export interface ShopState {
  items: ShopItem[]
  packs: PackOffer[]
  rerollCost: number
}

export type PackChoice =
  | { id: string; kind: 'joker'; joker: JokerInst }
  | { id: string; kind: 'cons'; cons: ConsInst }
  | { id: string; kind: 'card'; card: Card }

export interface PackState {
  pack: PackKey
  choices: PackChoice[]
  picksLeft: number
  returnTo: 'shop' | 'blinds'
  /** Cards dealt from the deck so stamps can target them. */
  hand: string[]
  selected: string[]
}

export type BlindKind = 'small' | 'big' | 'boss'

export interface BlindInfo {
  kind: BlindKind
  boss?: string
  target: number
  reward: number
  tag?: string
  status: 'upcoming' | 'current' | 'skipped' | 'beaten'
}

export interface RoundState {
  target: number
  score: number
  handsLeft: number
  discardsLeft: number
  handSize: number
  hand: string[]
  draw: string[]
  discard: string[]
  played: string[]
  selected: string[]
  handsPlayed: number
  discardsUsed: number
  typesPlayed: HandType[]
  lastHand?: HandType
}

export type Phase =
  | 'blinds'
  | 'round'
  | 'scoring'
  | 'cashout'
  | 'shop'
  | 'pack'
  | 'over'
  | 'won'

export type Tone = 'chips' | 'mult' | 'xmult' | 'money' | 'info' | 'bad'

export interface ScoreEvent {
  t: 'base' | 'card' | 'held' | 'joker' | 'note'
  /** Card id or joker id the event belongs to. */
  target?: string
  /** A playing card involved in a joker's effect. */
  sub?: string
  chips: number
  mult: number
  label?: string
  tone?: Tone
  money?: number
}

export interface ScoreResult {
  hand: HandType
  level: number
  events: ScoreEvent[]
  chips: number
  mult: number
  total: number
  money: number
  scoringIds: string[]
  destroyed: string[]
  blocked?: string
}

export interface CashLine {
  label: string
  amount: number
}

export interface RunStats {
  bestHand: number
  handsPlayed: number
  cardsDiscarded: number
  rerolls: number
  mostPlayed?: HandType
}

export type SortMode = 'rank' | 'suit'

export interface GameState {
  v: number
  seed: string
  rng: number
  nextId: number
  deck: string
  phase: Phase
  ante: number
  blindIdx: number
  blinds: BlindInfo[]
  money: number
  jokers: JokerInst[]
  jokerSlots: number
  cons: ConsInst[]
  consSlots: number
  cards: Record<string, Card>
  startDeckSize: number
  round: RoundState | null
  levels: Record<HandType, { level: number; played: number }>
  vouchers: string[]
  anteVoucher: string | null
  /** Tags waiting to take effect (next shop, next round, next boss). */
  tags: string[]
  shop: ShopState | null
  pack: PackState | null
  cashout: CashLine[] | null
  score: ScoreResult | null
  baseHands: number
  baseDiscards: number
  baseHandSize: number
  stampsUsed: number
  lastCons: string | null
  bossesSeen: string[]
  shopsVisited: number
  sort: SortMode
  endless: boolean
  /** Index into DIFFICULTIES. Missing on saves from before difficulty levels existed (treated as Normal). */
  difficulty?: number
  stats: RunStats
  notices: string[]
}
