import type { GameState, PackKey } from './types'

// ——— Decks ———

export interface DeckDef {
  key: string
  name: string
  text: string
  /** Two ink colours used for the card back. */
  inks: [string, string]
  cards: 'standard' | 'duotone' | 'pageless'
  setup?: (g: GameState) => void
}

export const DECKS: DeckDef[] = [
  { key: 'plain', name: 'Plain Deck', text: 'A regular 52-card deck. No bonus.', inks: ['#3255a4', '#ff48b0'], cards: 'standard' },
  {
    key: 'crimson',
    name: 'Crimson Deck',
    text: '+1 discard every round',
    inks: ['#e83a5b', '#ffb511'],
    cards: 'standard',
    setup: (g) => {
      g.baseDiscards += 1
    },
  },
  {
    key: 'cobalt',
    name: 'Cobalt Deck',
    text: '+1 hand every round',
    inks: ['#3255a4', '#5ec8e5'],
    cards: 'standard',
    setup: (g) => {
      g.baseHands += 1
    },
  },
  {
    key: 'saffron',
    name: 'Saffron Deck',
    text: 'Start the run with $14 instead of $4',
    inks: ['#ffb511', '#ff6c2f'],
    cards: 'standard',
    setup: (g) => {
      g.money += 10
    },
  },
  {
    key: 'duotone',
    name: 'Duotone Deck',
    text: 'Only ♥ and ♠: 26 of each',
    inks: ['#e83a5b', '#2a2f6b'],
    cards: 'duotone',
  },
  {
    key: 'pageless',
    name: 'Pageless Deck',
    text: 'No face cards. 40 cards in the deck',
    inks: ['#00835c', '#ffe800'],
    cards: 'pageless',
  },
  {
    key: 'inky',
    name: 'Inky Deck',
    text: '+1 Joker slot, but −1 hand every round',
    inks: ['#2a2f6b', '#765ba7'],
    cards: 'standard',
    setup: (g) => {
      g.jokerSlots += 1
      g.baseHands -= 1
    },
  },
  {
    key: 'mint',
    name: 'Mint Deck',
    text: 'No interest. Earn $2 per hand left and $1 per discard left instead',
    inks: ['#00a95c', '#5ec8e5'],
    cards: 'standard',
  },
]

export const DECK_MAP: Record<string, DeckDef> = Object.fromEntries(DECKS.map((d) => [d.key, d]))

// ——— Vouchers ———

export interface VoucherDef {
  key: string
  name: string
  text: string
  apply?: (g: GameState) => void
}

export const VOUCHERS: VoucherDef[] = [
  { key: 'overtime', name: 'Overtime', text: '+1 hand every round', apply: (g) => void (g.baseHands += 1) },
  { key: 'recycling', name: 'Recycling Bin', text: '+1 discard every round', apply: (g) => void (g.baseDiscards += 1) },
  { key: 'widegrip', name: 'Wide Grip', text: '+1 hand size', apply: (g) => void (g.baseHandSize += 1) },
  { key: 'bigframe', name: 'Bigger Frame', text: '+1 Joker slot', apply: (g) => void (g.jokerSlots += 1) },
  { key: 'pocket', name: 'Extra Pocket', text: '+1 consumable slot', apply: (g) => void (g.consSlots += 1) },
  { key: 'member', name: 'Member Discount', text: 'Cards, packs and vouchers in the shop are 25% off' },
  { key: 'bulkreroll', name: 'Bulk Reroll', text: 'Rerolls cost $2 less' },
  { key: 'savings', name: 'Savings Account', text: 'Interest can reach $10 per round instead of $5' },
  { key: 'overstock', name: 'Overstock', text: '+1 card slot in the shop' },
  { key: 'platerack', name: 'Plate Rack', text: 'Plates show up twice as often in the shop' },
  { key: 'stamprack', name: 'Stamp Rack', text: 'Stamps show up twice as often in the shop' },
  { key: 'printer', name: 'In-House Printer', text: 'Playing cards can show up in the shop' },
]

export const VOUCHER_MAP: Record<string, VoucherDef> = Object.fromEntries(VOUCHERS.map((v) => [v.key, v]))
export const VOUCHER_PRICE = 10

// ——— Packs ———

export type PackKind = 'joker' | 'plate' | 'stamp' | 'print'

export interface PackDef {
  name: string
  kind: PackKind
  size: number
  picks: number
  price: number
  weight: number
}

export const PACKS: Record<PackKey, PackDef> = {
  joker: { name: 'Joker Pack', kind: 'joker', size: 2, picks: 1, price: 4, weight: 1.2 },
  jokerJumbo: { name: 'Jumbo Joker Pack', kind: 'joker', size: 4, picks: 1, price: 6, weight: 0.6 },
  jokerMega: { name: 'Mega Joker Pack', kind: 'joker', size: 4, picks: 2, price: 8, weight: 0.15 },
  plate: { name: 'Plate Pack', kind: 'plate', size: 3, picks: 1, price: 4, weight: 4 },
  plateJumbo: { name: 'Jumbo Plate Pack', kind: 'plate', size: 5, picks: 1, price: 6, weight: 2 },
  plateMega: { name: 'Mega Plate Pack', kind: 'plate', size: 5, picks: 2, price: 8, weight: 0.5 },
  stamp: { name: 'Stamp Pack', kind: 'stamp', size: 3, picks: 1, price: 4, weight: 4 },
  stampJumbo: { name: 'Jumbo Stamp Pack', kind: 'stamp', size: 5, picks: 1, price: 6, weight: 2 },
  stampMega: { name: 'Mega Stamp Pack', kind: 'stamp', size: 5, picks: 2, price: 8, weight: 0.5 },
  print: { name: 'Print Pack', kind: 'print', size: 3, picks: 1, price: 4, weight: 4 },
  printJumbo: { name: 'Jumbo Print Pack', kind: 'print', size: 5, picks: 1, price: 6, weight: 2 },
  printMega: { name: 'Mega Print Pack', kind: 'print', size: 5, picks: 2, price: 8, weight: 0.5 },
}

export const PACK_TEXT: Record<PackKind, string> = {
  joker: 'Joker cards',
  plate: 'Plates that level up poker hands',
  stamp: 'Stamps you can use on cards from your deck',
  print: 'Playing cards to add to your deck',
}

export function packText(key: PackKey): string {
  const p = PACKS[key]
  const pick = p.picks === 1 ? 'Choose 1' : `Choose ${p.picks}`
  return `${pick} of up to ${p.size} ${PACK_TEXT[p.kind].charAt(0).toLowerCase()}${PACK_TEXT[p.kind].slice(1)}`
}
