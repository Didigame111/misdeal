import { isFace } from './jokers'
import { hasSuit } from './hands'
import type { Card, GameState, Suit } from './types'

export interface BossRules {
  mustPlay5?: boolean
  oneType?: boolean
  noRepeat?: boolean
  halfBase?: boolean
  faceDown?: number
  taxPerCard?: number
  jam?: number
}

export interface BossDef {
  key: string
  name: string
  text: string
  color: string
  minAnte: number
  showdown?: boolean
  scoreMult: number
  debuff?: (g: GameState, c: Card) => boolean
  handSize?: number
  hands?: number
  discards?: number
  noDiscards?: boolean
  rules: BossRules
}

const suitDebuff = (suit: Suit) => (_g: GameState, c: Card) => c.enh !== 'rainbow' && hasSuit(c, suit)

export const BOSSES: BossDef[] = [
  { key: 'smudge', name: 'The Smudge', text: 'Every ♥ card is debuffed', color: '#e83a5b', minAnte: 1, scoreMult: 2, debuff: suitDebuff('H'), rules: {} },
  { key: 'blot', name: 'The Blot', text: 'Every ♦ card is debuffed', color: '#ff6c2f', minAnte: 1, scoreMult: 2, debuff: suitDebuff('D'), rules: {} },
  { key: 'soot', name: 'The Soot', text: 'Every ♣ card is debuffed', color: '#00835c', minAnte: 1, scoreMult: 2, debuff: suitDebuff('C'), rules: {} },
  { key: 'shade', name: 'The Shade', text: 'Every ♠ card is debuffed', color: '#2a2f6b', minAnte: 1, scoreMult: 2, debuff: suitDebuff('S'), rules: {} },
  { key: 'shredder', name: 'The Shredder', text: 'Every face card is debuffed', color: '#765ba7', minAnte: 2, scoreMult: 2, debuff: (g, c) => isFace(g, c), rules: {} },
  { key: 'crimp', name: 'The Crimp', text: '−1 hand size', color: '#914e72', minAnte: 1, scoreMult: 2, handSize: -1, rules: {} },
  { key: 'fullsheet', name: 'The Full Sheet', text: 'You must play exactly 5 cards', color: '#3255a4', minAnte: 1, scoreMult: 2, rules: { mustPlay5: true } },
  { key: 'proof', name: 'The Proof', text: 'Only one poker hand type can score this round', color: '#00838a', minAnte: 2, scoreMult: 2, rules: { oneType: true } },
  { key: 'fade', name: 'The Fade', text: 'Base Chips and Mult are halved (rounded down)', color: '#5ec8e5', minAnte: 2, scoreMult: 2, rules: { halfBase: true } },
  { key: 'gutter', name: 'The Gutter', text: 'You get no discards this round', color: '#2a2f6b', minAnte: 2, scoreMult: 2, noDiscards: true, rules: {} },
  { key: 'blindspot', name: 'The Blind Spot', text: '1 in 7 cards are drawn face down', color: '#765ba7', minAnte: 2, scoreMult: 2, rules: { faceDown: 7 } },
  { key: 'ream', name: 'The Ream', text: 'A huge score is required', color: '#914e72', minAnte: 2, scoreMult: 4, rules: {} },
  { key: 'invoice', name: 'The Invoice', text: 'Lose $1 for every card you play', color: '#ffb511', minAnte: 1, scoreMult: 2, rules: { taxPerCard: 1 } },
  { key: 'replay', name: 'The Replay', text: "You can't score the same poker hand twice this round", color: '#ff48b0', minAnte: 2, scoreMult: 2, rules: { noRepeat: true } },
  { key: 'deadline', name: 'The Deadline', text: '−1 hand this round', color: '#e83a5b', minAnte: 1, scoreMult: 2, hands: -1, rules: {} },
  { key: 'paperjam', name: 'The Paper Jam', text: 'After every hand, 2 random cards in your hand are discarded', color: '#ff6c2f', minAnte: 1, scoreMult: 2, rules: { jam: 2 } },
  {
    key: 'presscheck',
    name: 'Press Check',
    text: 'Cards you already played this ante are debuffed',
    color: '#ff48b0',
    minAnte: 8,
    showdown: true,
    scoreMult: 2,
    debuff: (_g, c) => !!c.usedThisAnte,
    rules: {},
  },
  {
    key: 'finaldraft',
    name: 'Final Draft',
    text: '−1 hand size and −1 discard',
    color: '#3255a4',
    minAnte: 8,
    showdown: true,
    scoreMult: 2,
    handSize: -1,
    discards: -1,
    rules: {},
  },
]

export const BOSS_MAP: Record<string, BossDef> = Object.fromEntries(BOSSES.map((b) => [b.key, b]))

const ANTE_BASE = [100, 300, 800, 2000, 5000, 11000, 20000, 35000, 50000]

function round2(v: number): number {
  if (v < 100) return Math.round(v)
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1)
  return Math.round(v / p) * p
}

export function anteBase(ante: number): number {
  if (ante < 1) return ANTE_BASE[0]
  if (ante <= 8) return ANTE_BASE[ante]
  const k = ante - 8
  return round2(50000 * Math.pow(1.6 + 0.25 * k, k))
}

export const isShowdown = (ante: number) => ante % 8 === 0

/** The boss blind in effect right now, if the current round is a boss round. */
export function roundBoss(g: GameState): BossDef | null {
  if (!g.round) return null
  const b = g.blinds[g.blindIdx]
  return b?.kind === 'boss' && b.boss ? BOSS_MAP[b.boss] : null
}

export function isDebuffed(g: GameState, c: Card): boolean {
  const boss = roundBoss(g)
  return !!boss?.debuff?.(g, c)
}

// ——— Tags (rewards for skipping a blind) ———

export interface TagDef {
  key: string
  name: string
  text: string
  /** When the tag pays off. Instant tags resolve as soon as you skip. */
  when: 'instant' | 'shop' | 'round' | 'boss'
}

export const TAGS: TagDef[] = [
  { key: 'payday', name: 'Payday', text: 'Gain $10 right away', when: 'instant' },
  { key: 'rarefind', name: 'Rare Find', text: 'The next shop has a free Rare Joker', when: 'shop' },
  { key: 'luckyfind', name: 'Lucky Find', text: 'The next shop has a free Uncommon Joker', when: 'shop' },
  { key: 'prismtag', name: 'Prism Tag', text: 'The next shop has a free Prism Joker', when: 'shop' },
  { key: 'coupon', name: 'Coupon', text: 'Cards and packs in the next shop start free', when: 'shop' },
  { key: 'freeroll', name: 'Free Rerolls', text: 'Rerolls in the next shop start at $0', when: 'shop' },
  { key: 'jokerbundle', name: 'Joker Bundle', text: 'Open a free Mega Joker Pack', when: 'instant' },
  { key: 'platebundle', name: 'Plate Bundle', text: 'Open a free Mega Plate Pack', when: 'instant' },
  { key: 'stampbundle', name: 'Stamp Bundle', text: 'Open a free Mega Stamp Pack', when: 'instant' },
  { key: 'bighand', name: 'Big Hand', text: '+3 hand size next round', when: 'round' },
  { key: 'bossswap', name: 'Boss Swap', text: "Swap this ante's Boss Blind for a different one", when: 'instant' },
  { key: 'investment', name: 'Investment', text: 'Earn $25 after you defeat the next Boss Blind', when: 'boss' },
]

export const TAG_MAP: Record<string, TagDef> = Object.fromEntries(TAGS.map((t) => [t.key, t]))
