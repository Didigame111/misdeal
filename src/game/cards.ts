import type { Card, Edition, Enhancement, Rank, Seal, Suit } from './types'

export const SUITS: Suit[] = ['S', 'H', 'C', 'D']
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

export const SUIT_NAME: Record<Suit, string> = { S: 'Spades', H: 'Hearts', C: 'Clubs', D: 'Diamonds' }
export const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', C: '♣', D: '♦' }

export function rankLabel(r: Rank): string {
  if (r === 11) return 'J'
  if (r === 12) return 'Q'
  if (r === 13) return 'K'
  if (r === 14) return 'A'
  return String(r)
}

export function rankName(r: Rank): string {
  if (r === 11) return 'Jack'
  if (r === 12) return 'Queen'
  if (r === 13) return 'King'
  if (r === 14) return 'Ace'
  return String(r)
}

/** Chips a card adds when it scores. */
export function rankChips(r: Rank): number {
  if (r === 14) return 11
  if (r >= 11) return 10
  return r
}

export const isFaceRank = (r: Rank) => r >= 11 && r <= 13

export function cardName(c: Card): string {
  if (c.enh === 'blank') return 'Blank card'
  return `${rankName(c.rank)} of ${SUIT_NAME[c.suit]}`
}

export const ENH_INFO: Record<Enhancement, { name: string; desc: string }> = {
  embossed: { name: 'Embossed', desc: '+30 Chips' },
  fluoro: { name: 'Fluoro', desc: '+4 Mult' },
  rainbow: { name: 'Rainbow', desc: "Counts as every suit, and suit bosses can't debuff it" },
  tissue: { name: 'Tissue', desc: '×2 Mult. 1 in 4 chance to tear after scoring' },
  stock: { name: 'Card Stock', desc: '×1.5 Mult while this card stays in your hand' },
  blank: { name: 'Blank', desc: '+50 Chips. No rank or suit. Always scores' },
  gilded: { name: 'Gilded', desc: '$3 if this card is in your hand at the end of the round' },
  scratch: { name: 'Scratch-off', desc: '1 in 5 chance for +20 Mult. 1 in 15 chance to win $20' },
}

export const EDITION_INFO: Record<Edition, { name: string; desc: string; cost: number }> = {
  glossy: { name: 'Glossy', desc: '+50 Chips', cost: 2 },
  holo: { name: 'Holo', desc: '+10 Mult', cost: 3 },
  prism: { name: 'Prism', desc: '×1.5 Mult', cost: 5 },
  ghost: { name: 'Ghost', desc: '+1 Joker slot', cost: 5 },
}

export const SEAL_INFO: Record<Seal, { name: string; desc: string }> = {
  coin: { name: 'Coin seal', desc: 'Earn $3 when this card scores' },
  echo: { name: 'Echo seal', desc: 'Retrigger this card once' },
  plate: { name: 'Plate seal', desc: 'Creates the Plate for your last hand if held at the end of the round' },
  stamp: { name: 'Stamp seal', desc: 'Creates a Stamp when discarded' },
}

export function makeCard(id: string, suit: Suit, rank: Rank, extra: Partial<Card> = {}): Card {
  return { id, suit, rank, bonus: 0, ...extra }
}

/** Order used when sorting by suit. */
export const SUIT_ORDER: Record<Suit, number> = { S: 0, H: 1, C: 2, D: 3 }
