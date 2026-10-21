import { EDITION_INFO } from './cards'
import { HAND_ORDER, HANDS } from './hands'
import { emptySlots, JOKER_MAP, sellValue } from './jokers'
import { addCons, addJoker, destroyCard, levelUp, makeJoker, randomJokerKey, randomPlateKey } from './ops'
import { chance, pick } from './rng'
import type { Card, Edition, Enhancement, GameState, HandType, Rank, Seal, Suit } from './types'

export interface UseCtx {
  g: GameState
  /** Selected cards, in hand order. */
  selected: Card[]
  /** Free consumable slots once this one is gone. */
  room: number
}

export interface ConsDef {
  key: string
  name: string
  kind: 'plate' | 'stamp'
  text: (g: GameState) => string
  hand?: HandType
  /** How many selected cards the stamp needs. */
  min: number
  max: number
  canUse?: (u: UseCtx) => boolean
  use: (u: UseCtx) => void
}

function plate(hand: HandType): ConsDef {
  const h = HANDS[hand]
  return {
    key: `plate_${hand}`,
    name: h.plate,
    kind: 'plate',
    hand,
    min: 0,
    max: 0,
    text: (g) => `Level up ${h.name}: +${h.lvMult} Mult and +${h.lvChips} Chips (now level ${g.levels[hand].level})`,
    use: ({ g }) => levelUp(g, hand),
  }
}

const ENH_LABEL: Record<Enhancement, string> = {
  embossed: 'Embossed (+30 Chips)',
  fluoro: 'Fluoro (+4 Mult)',
  rainbow: 'Rainbow (counts as every suit)',
  tissue: 'Tissue (×2 Mult, may tear)',
  stock: 'Card Stock (×1.5 Mult while held)',
  blank: 'Blank (+50 Chips, no rank or suit)',
  gilded: 'Gilded ($3 if held at end of round)',
  scratch: 'Scratch-off (chance of +20 Mult or $20)',
}

function enhStamp(key: string, name: string, enh: Enhancement, max: number): ConsDef {
  return {
    key,
    name,
    kind: 'stamp',
    min: 1,
    max,
    text: () => `Turn ${max === 1 ? '1 selected card' : `up to ${max} selected cards`} ${ENH_LABEL[enh]}`,
    use: ({ selected }) => {
      for (const c of selected) c.enh = enh
    },
  }
}

const SUIT_TEXT: Record<Suit, string> = { H: '♥ Hearts', D: '♦ Diamonds', S: '♠ Spades', C: '♣ Clubs' }

function suitStamp(key: string, name: string, suit: Suit): ConsDef {
  return {
    key,
    name,
    kind: 'stamp',
    min: 1,
    max: 3,
    text: () => `Change up to 3 selected cards to ${SUIT_TEXT[suit]}`,
    use: ({ selected }) => {
      for (const c of selected) {
        c.suit = suit
        if (c.enh === 'blank') c.enh = undefined
      }
    },
  }
}

const SEALS: Seal[] = ['coin', 'echo', 'plate', 'stamp']

export const STAMPS: ConsDef[] = [
  enhStamp('emboss', 'Emboss', 'embossed', 2),
  enhStamp('fluoroink', 'Fluoro Ink', 'fluoro', 2),
  enhStamp('rainbowroll', 'Rainbow Roll', 'rainbow', 1),
  enhStamp('tissuepaper', 'Tissue Paper', 'tissue', 1),
  enhStamp('cardstock', 'Card Stock', 'stock', 1),
  enhStamp('blankout', 'Blank Out', 'blank', 1),
  enhStamp('goldleaf', 'Gold Leaf', 'gilded', 1),
  enhStamp('scratchcard', 'Scratch Card', 'scratch', 2),
  suitStamp('redink', 'Red Ink', 'H'),
  suitStamp('orangeink', 'Orange Ink', 'D'),
  suitStamp('blueink', 'Navy Ink', 'S'),
  suitStamp('greenink', 'Green Ink', 'C'),
  {
    key: 'bump',
    name: 'Bump Up',
    kind: 'stamp',
    min: 1,
    max: 2,
    text: () => 'Raise the rank of up to 2 selected cards by 1 (Aces wrap to 2)',
    use: ({ selected }) => {
      for (const c of selected) {
        if (c.enh === 'blank') continue
        c.rank = (c.rank === 14 ? 2 : c.rank + 1) as Rank
      }
    },
  },
  {
    key: 'shred',
    name: 'Shred',
    kind: 'stamp',
    min: 1,
    max: 2,
    text: () => 'Destroy up to 2 selected cards',
    use: ({ g, selected }) => {
      for (const c of selected) destroyCard(g, c.id)
    },
  },
  {
    key: 'duplicate',
    name: 'Duplicate',
    kind: 'stamp',
    min: 2,
    max: 2,
    text: () => 'Select 2 cards. The left card becomes a copy of the right card',
    use: ({ selected }) => {
      const [left, right] = selected
      const { id } = left
      Object.assign(left, { ...right, id, faceDown: false })
    },
  },
  {
    key: 'waxseal',
    name: 'Wax Seal',
    kind: 'stamp',
    min: 1,
    max: 1,
    text: () => 'Add a random seal to 1 selected card',
    use: ({ g, selected }) => {
      for (const c of selected) c.seal = pick(g, SEALS.filter((s) => s !== c.seal))
    },
  },
  {
    key: 'pettycash',
    name: 'Petty Cash',
    kind: 'stamp',
    min: 0,
    max: 0,
    text: () => 'Double your money (up to +$20)',
    use: ({ g }) => {
      g.money += Math.min(20, Math.max(0, g.money))
    },
  },
  {
    key: 'appraisal',
    name: 'Appraisal',
    kind: 'stamp',
    min: 0,
    max: 0,
    text: (g) => {
      const v = Math.min(50, g.jokers.reduce((s, j) => s + sellValue(j), 0))
      return `Gain the total sell value of your Jokers, up to $50 (currently $${v})`
    },
    use: ({ g }) => {
      g.money += Math.min(50, g.jokers.reduce((s, j) => s + sellValue(j), 0))
    },
  },
  {
    key: 'reprint',
    name: 'Reprint',
    kind: 'stamp',
    min: 0,
    max: 0,
    text: (g) => {
      const last = g.lastCons && g.lastCons !== 'reprint' ? CONS_MAP[g.lastCons]?.name : null
      return `Create a copy of the last Plate or Stamp you used this run${last ? ` (${last})` : ' (none yet)'}`
    },
    canUse: ({ g, room }) => !!g.lastCons && g.lastCons !== 'reprint' && room > 0,
    use: ({ g }) => {
      if (g.lastCons) addCons(g, g.lastCons)
    },
  },
  {
    key: 'commission',
    name: 'Commission',
    kind: 'stamp',
    min: 0,
    max: 0,
    text: () => 'Create up to 2 random Plates (if you have room)',
    canUse: ({ room }) => room > 0,
    use: ({ g }) => {
      for (let i = 0; i < 2; i++) addCons(g, randomPlateKey(g))
    },
  },
  {
    key: 'luckyspin',
    name: 'Lucky Spin',
    kind: 'stamp',
    min: 0,
    max: 0,
    text: () => '1 in 4 chance to make a random Joker Glossy, Holo or Prism',
    canUse: ({ g }) => g.jokers.some((j) => !j.ed),
    use: ({ g }) => {
      if (!chance(g, 4)) {
        g.notices.push('Lucky Spin missed')
        return
      }
      const j = pick(g, g.jokers.filter((x) => !x.ed))
      const ed = pick<Edition>(g, ['glossy', 'glossy', 'holo', 'holo', 'prism'])
      j.ed = ed
      j.cost += EDITION_INFO[ed].cost
      g.notices.push(`${JOKER_MAP[j.key].name} is now ${EDITION_INFO[ed].name}`)
    },
  },
  {
    key: 'hire',
    name: 'Hire Help',
    kind: 'stamp',
    min: 0,
    max: 0,
    text: () => 'Create a random Joker (if you have room)',
    canUse: ({ g }) => emptySlots(g) > 0,
    use: ({ g }) => {
      addJoker(g, makeJoker(g, randomJokerKey(g)))
    },
  },
]

export const PLATES: ConsDef[] = HAND_ORDER.map(plate)

export const CONS_MAP: Record<string, ConsDef> = Object.fromEntries(
  [...PLATES, ...STAMPS].map((c) => [c.key, c]),
)

export function consDef(key: string): ConsDef {
  return CONS_MAP[key]
}

/** Can this consumable be used with these selected cards right now? */
export function canUseCons(def: ConsDef, u: UseCtx): boolean {
  if (u.selected.length < def.min || u.selected.length > def.max) return false
  return def.canUse ? def.canUse(u) : true
}
