import { isFaceRank, rankChips } from './cards'
import { hasSuit, HANDS } from './hands'
import { chance, randInt } from './rng'
import type { Card, GameState, HandType, JokerInst, Suit } from './types'
import type { Ctx, Effect } from './scoring'

export type Rarity = 1 | 2 | 3

export interface JokerFlags {
  fourFingers?: boolean
  shortcut?: boolean
  smeared?: boolean
  allFace?: boolean
  splash?: boolean
}

export interface JokerDef {
  key: string
  name: string
  rarity: Rarity
  cost: number
  text: (j: JokerInst, g: GameState) => string
  /** Short live value printed on the card, e.g. "+7". */
  badge?: (j: JokerInst, g: GameState) => string | null
  init?: Record<string, number>
  /** Once per hand, before cards score. Used for scaling. Not copied by Copycat. */
  before?: (ctx: Ctx, j: JokerInst) => Effect | void
  onScored?: (ctx: Ctx, j: JokerInst, card: Card) => Effect | void
  onHeld?: (ctx: Ctx, j: JokerInst, card: Card) => Effect | void
  main?: (ctx: Ctx, j: JokerInst) => Effect | void
  /** Reacts to another Joker being scored. */
  onOther?: (ctx: Ctx, j: JokerInst, other: JokerInst) => Effect | void
  retrigger?: (ctx: Ctx, j: JokerInst, card: Card, zone: 'played' | 'held', index: number) => number
  after?: (ctx: Ctx, j: JokerInst) => void
  onDiscard?: (g: GameState, j: JokerInst, cards: Card[]) => void
  /** Money earned at the end of the round. */
  roundEnd?: (g: GameState, j: JokerInst) => number | void
  onBoss?: (g: GameState, j: JokerInst) => void
  onReroll?: (g: GameState, j: JokerInst) => void
  onScratch?: (g: GameState, j: JokerInst) => void
  onTear?: (g: GameState, j: JokerInst) => void
  flags?: JokerFlags
  noCopy?: boolean
}

export const RARITY_NAME: Record<Rarity, string> = { 1: 'Common', 2: 'Uncommon', 3: 'Rare' }

const isBlank = (c: Card) => c.enh === 'blank'

export function hasFlag(g: GameState, flag: keyof JokerFlags): boolean {
  return g.jokers.some((j) => JOKER_MAP[j.key]?.flags?.[flag])
}

export function isFace(g: GameState, c: Card): boolean {
  if (isBlank(c)) return false
  return isFaceRank(c.rank) || hasFlag(g, 'allFace')
}

const rankIn = (c: Card, ranks: number[]) => !isBlank(c) && ranks.includes(c.rank)

function suitJoker(key: string, name: string, suit: Suit, glyph: string): JokerDef {
  return {
    key,
    name,
    rarity: 1,
    cost: 5,
    text: () => `Played ${glyph} cards give +3 Mult when scored`,
    onScored: (ctx, _j, c) => (hasSuit(c, suit, ctx.opts.smeared) ? { mult: 3 } : undefined),
  }
}

function handMult(key: string, name: string, type: HandType, mult: number, cost = 4): JokerDef {
  return {
    key,
    name,
    rarity: 1,
    cost,
    text: () => `+${mult} Mult if played hand contains a ${HANDS[type].name.toLowerCase()}`,
    main: (ctx) => (ctx.contains[type] ? { mult } : undefined),
  }
}

function handChips(key: string, name: string, type: HandType, chips: number): JokerDef {
  return {
    key,
    name,
    rarity: 1,
    cost: 4,
    text: () => `+${chips} Chips if played hand contains a ${HANDS[type].name.toLowerCase()}`,
    main: (ctx) => (ctx.contains[type] ? { chips } : undefined),
  }
}

function handX(key: string, name: string, type: HandType, x: number): JokerDef {
  return {
    key,
    name,
    rarity: 3,
    cost: 8,
    text: () => `×${x} Mult if played hand contains a ${HANDS[type].name.toLowerCase()}`,
    main: (ctx) => (ctx.contains[type] ? { xmult: x } : undefined),
  }
}

const fmtX = (x: number) => `×${Math.round(x * 100) / 100}`

export const JOKERS: JokerDef[] = [
  // ——— Common ———
  {
    key: 'smiley',
    name: 'Smiley',
    rarity: 1,
    cost: 2,
    text: () => '+4 Mult',
    main: () => ({ mult: 4 }),
  },
  suitJoker('redpen', 'Red Pen', 'H', '♥'),
  suitJoker('peel', 'Orange Peel', 'D', '♦'),
  suitJoker('spadework', 'Spadework', 'S', '♠'),
  suitJoker('clover', 'Four-Leaf', 'C', '♣'),
  handMult('doubletake', 'Double Take', 'pair', 8, 3),
  handMult('twostep', 'Two-Step', 'twopair', 10),
  handMult('hattrick', 'Hat Trick', 'three', 12),
  handMult('ladder', 'Step Ladder', 'straight', 12),
  handMult('swatch', 'Swatch Book', 'flush', 10),
  handChips('paperstack', 'Paper Stack', 'pair', 50),
  handChips('rails', 'Guard Rails', 'straight', 100),
  handChips('palette', 'Palette', 'flush', 80),
  {
    key: 'halfsheet',
    name: 'Half Sheet',
    rarity: 1,
    cost: 5,
    text: () => '+20 Mult if played hand has 3 or fewer cards',
    main: (ctx) => (ctx.played.length <= 3 ? { mult: 20 } : undefined),
  },
  {
    key: 'facevalue',
    name: 'Face Value',
    rarity: 1,
    cost: 4,
    text: () => 'Played face cards give +30 Chips when scored',
    onScored: (ctx, _j, c) => (isFace(ctx.g, c) ? { chips: 30 } : undefined),
  },
  {
    key: 'portrait',
    name: 'Portrait',
    rarity: 1,
    cost: 4,
    text: () => 'Played face cards give +5 Mult when scored',
    onScored: (ctx, _j, c) => (isFace(ctx.g, c) ? { mult: 5 } : undefined),
  },
  {
    key: 'evenkeel',
    name: 'Even Keel',
    rarity: 1,
    cost: 4,
    text: () => 'Played 10, 8, 6, 4 and 2 give +4 Mult when scored',
    onScored: (_ctx, _j, c) => (rankIn(c, [2, 4, 6, 8, 10]) ? { mult: 4 } : undefined),
  },
  {
    key: 'oddball',
    name: 'Oddball',
    rarity: 1,
    cost: 4,
    text: () => 'Played A, 9, 7, 5 and 3 give +31 Chips when scored',
    onScored: (_ctx, _j, c) => (rankIn(c, [3, 5, 7, 9, 14]) ? { chips: 31 } : undefined),
  },
  {
    key: 'aceup',
    name: 'Ace Up',
    rarity: 1,
    cost: 4,
    text: () => 'Played Aces give +20 Chips and +4 Mult when scored',
    onScored: (_ctx, _j, c) => (rankIn(c, [14]) ? { chips: 20, mult: 4 } : undefined),
  },
  {
    key: 'spare',
    name: 'Spare Sheets',
    rarity: 1,
    cost: 5,
    text: () => '+30 Chips for each discard you have left',
    main: (ctx) => {
      const d = ctx.g.round?.discardsLeft ?? 0
      return d > 0 ? { chips: 30 * d } : undefined
    },
  },
  {
    key: 'zerowaste',
    name: 'Zero Waste',
    rarity: 1,
    cost: 5,
    text: () => '+15 Mult when you have 0 discards left',
    main: (ctx) => (ctx.g.round?.discardsLeft === 0 ? { mult: 15 } : undefined),
  },
  {
    key: 'inkblot',
    name: 'Ink Blot',
    rarity: 1,
    cost: 4,
    text: () => 'Gives a random +0 to +20 Mult',
    main: (ctx) => {
      const m = randInt(ctx.g, 21)
      return m > 0 ? { mult: m } : { msg: '+0' }
    },
  },
  {
    key: 'piggy',
    name: 'Piggy Bank',
    rarity: 1,
    cost: 6,
    text: () => 'Earn $4 at the end of each round',
    roundEnd: () => 4,
    noCopy: true,
  },
  {
    key: 'nestegg',
    name: 'Nest Egg',
    rarity: 1,
    cost: 4,
    text: (j) => `Gains $3 of sell value at the end of each round (sells for $${sellValue(j)})`,
    roundEnd: (_g, j) => {
      j.extraSell += 3
    },
    noCopy: true,
  },
  {
    key: 'icepop',
    name: 'Ice Pop',
    rarity: 1,
    cost: 5,
    init: { chips: 100 },
    text: (j) => `+${j.s.chips} Chips. Loses 5 Chips every hand played`,
    badge: (j) => `+${j.s.chips}`,
    main: (_ctx, j) => ({ chips: j.s.chips }),
    after: (_ctx, j) => {
      j.s.chips -= 5
      if (j.s.chips <= 0) j.s.dead = 1
    },
  },
  {
    key: 'soda',
    name: 'Fizzy Soda',
    rarity: 1,
    cost: 5,
    init: { mult: 20 },
    text: (j) => `+${j.s.mult} Mult. Loses 4 Mult at the end of each round`,
    badge: (j) => `+${j.s.mult}`,
    main: (_ctx, j) => ({ mult: j.s.mult }),
    roundEnd: (_g, j) => {
      j.s.mult -= 4
      if (j.s.mult <= 0) j.s.dead = 1
    },
  },
  {
    key: 'crown',
    name: 'Paper Crown',
    rarity: 1,
    cost: 5,
    text: () => '+15 Mult. 1 in 6 chance to tear at the end of each round',
    main: () => ({ mult: 15 }),
    roundEnd: (g, j) => {
      if (chance(g, 6)) j.s.dead = 1
    },
  },
  {
    key: 'crowd',
    name: 'Crowd',
    rarity: 1,
    cost: 4,
    text: (_j, g) => `+3 Mult for each Joker you have (currently +${3 * g.jokers.length} Mult)`,
    main: (ctx) => ({ mult: 3 * ctx.g.jokers.length }),
  },
  {
    key: 'deepstack',
    name: 'Deep Stack',
    rarity: 1,
    cost: 5,
    text: () => '+2 Chips for each card left in your draw pile',
    main: (ctx) => {
      const n = ctx.g.round?.draw.length ?? 0
      return n > 0 ? { chips: 2 * n } : undefined
    },
  },
  {
    key: 'momentum',
    name: 'Momentum',
    rarity: 1,
    cost: 5,
    init: { mult: 0 },
    text: (j) => `Gains +1 Mult per hand played and loses 1 Mult per discard (currently +${j.s.mult} Mult)`,
    badge: (j) => `+${j.s.mult}`,
    before: (_ctx, j) => {
      j.s.mult += 1
    },
    onDiscard: (_g, j) => {
      j.s.mult = Math.max(0, j.s.mult - 1)
    },
    main: (_ctx, j) => (j.s.mult > 0 ? { mult: j.s.mult } : undefined),
  },
  {
    key: 'tipjar',
    name: 'Tip Jar',
    rarity: 1,
    cost: 4,
    text: () => 'Played face cards have a 1 in 2 chance to give $2 when scored',
    onScored: (ctx, _j, c) => (isFace(ctx.g, c) && chance(ctx.g, 2) ? { money: 2 } : undefined),
  },
  {
    key: 'patience',
    name: 'Patience',
    rarity: 1,
    cost: 4,
    text: () => 'Earn $2 per discard left at the end of the round if you used no discards',
    roundEnd: (g) => {
      const r = g.round
      if (r && r.discardsUsed === 0 && r.discardsLeft > 0) return 2 * r.discardsLeft
    },
    noCopy: true,
  },
  {
    key: 'lowball',
    name: 'Low Ball',
    rarity: 1,
    cost: 5,
    text: () => 'Adds double the value of the lowest card held in hand to Mult',
    onHeld: (ctx, _j, c) => {
      const ranked = ctx.held.filter((h) => !isBlank(h) && !h.faceDown)
      if (!ranked.length || isBlank(c)) return
      let low = ranked[0]
      for (const h of ranked) if (rankChips(h.rank) < rankChips(low.rank)) low = h
      return low.id === c.id ? { mult: 2 * rankChips(c.rank) } : undefined
    },
  },

  // ——— Uncommon ———
  {
    key: 'lastcall',
    name: 'Last Call',
    rarity: 2,
    cost: 7,
    text: () => '×3 Mult on the final hand of the round',
    main: (ctx) => (ctx.final ? { xmult: 3 } : undefined),
  },
  {
    key: 'emptyframe',
    name: 'Empty Frame',
    rarity: 2,
    cost: 8,
    text: (_j, g) => `×1 Mult for each empty Joker slot, counting this one (currently ${fmtX(emptySlots(g) + 1)})`,
    main: (ctx) => {
      const x = emptySlots(ctx.g) + 1
      return x > 1 ? { xmult: x } : undefined
    },
  },
  {
    key: 'blackout',
    name: 'Blackout',
    rarity: 2,
    cost: 8,
    text: () => '×3 Mult if every card held in hand is ♠ or ♣',
    main: (ctx) =>
      ctx.held.every((c) => hasSuit(c, 'S', ctx.opts.smeared) || hasSuit(c, 'C', ctx.opts.smeared))
        ? { xmult: 3 }
        : undefined,
  },
  {
    key: 'encore',
    name: 'Encore',
    rarity: 2,
    cost: 6,
    text: () => 'Retrigger every played face card',
    retrigger: (ctx, _j, c, zone) => (zone === 'played' && isFace(ctx.g, c) ? 1 : 0),
  },
  {
    key: 'secondpress',
    name: 'Second Pressing',
    rarity: 2,
    cost: 5,
    text: () => 'Retrigger the first scoring card 2 more times',
    retrigger: (_ctx, _j, _c, zone, index) => (zone === 'played' && index === 0 ? 2 : 0),
  },
  {
    key: 'flipbook',
    name: 'Flip Book',
    rarity: 2,
    cost: 6,
    text: () => 'Retrigger every played 2, 3, 4 and 5',
    retrigger: (_ctx, _j, c, zone) => (zone === 'played' && rankIn(c, [2, 3, 4, 5]) ? 1 : 0),
  },
  {
    key: 'shadow',
    name: 'Shadow Puppet',
    rarity: 2,
    cost: 5,
    text: () => 'Retrigger the abilities of every card held in hand',
    retrigger: (_ctx, _j, _c, zone) => (zone === 'held' ? 1 : 0),
  },
  {
    key: 'pressrun',
    name: 'Press Run',
    rarity: 2,
    cost: 6,
    text: () => '1 in 4 chance to level up the poker hand you play',
    before: (ctx) => {
      if (chance(ctx.g, 4)) {
        ctx.g.levels[ctx.hand].level += 1
        return { msg: 'Level up!' }
      }
    },
  },
  {
    key: 'stampcollector',
    name: 'Stamp Collector',
    rarity: 2,
    cost: 6,
    text: (_j, g) => `+2 Mult for each Stamp used this run (currently +${2 * g.stampsUsed} Mult)`,
    main: (ctx) => (ctx.g.stampsUsed > 0 ? { mult: 2 * ctx.g.stampsUsed } : undefined),
  },
  {
    key: 'greatest',
    name: 'Greatest Hits',
    rarity: 2,
    cost: 6,
    text: () => 'Adds the number of times you have played this poker hand this run to Mult',
    main: (ctx) => ({ mult: ctx.g.levels[ctx.hand].played }),
  },
  {
    key: 'plainspeak',
    name: 'Plain Speaking',
    rarity: 2,
    cost: 6,
    init: { mult: 0 },
    text: (j) =>
      `Gains +1 Mult for each hand in a row played without a scoring face card (currently +${j.s.mult} Mult)`,
    badge: (j) => `+${j.s.mult}`,
    before: (ctx, j) => {
      if (ctx.scoring.some((c) => isFace(ctx.g, c))) {
        const had = j.s.mult > 0
        j.s.mult = 0
        return had ? { msg: 'Reset' } : undefined
      }
      j.s.mult += 1
    },
    main: (_ctx, j) => (j.s.mult > 0 ? { mult: j.s.mult } : undefined),
  },
  {
    key: 'marathon',
    name: 'Marathon',
    rarity: 2,
    cost: 6,
    init: { chips: 0 },
    text: (j) => `Gains +15 Chips when played hand contains a straight (currently +${j.s.chips} Chips)`,
    badge: (j) => `+${j.s.chips}`,
    before: (ctx, j) => {
      if (ctx.contains.straight) {
        j.s.chips += 15
        return { msg: 'Upgrade!' }
      }
    },
    main: (_ctx, j) => (j.s.chips > 0 ? { chips: j.s.chips } : undefined),
  },
  {
    key: 'rerun',
    name: 'Rerun',
    rarity: 2,
    cost: 6,
    init: { mult: 0 },
    text: (j) => `Gains +2 Mult each time you reroll the shop (currently +${j.s.mult} Mult)`,
    badge: (j) => `+${j.s.mult}`,
    onReroll: (_g, j) => {
      j.s.mult += 2
    },
    main: (_ctx, j) => (j.s.mult > 0 ? { mult: j.s.mult } : undefined),
  },
  {
    key: 'fourcorners',
    name: 'Four Corners',
    rarity: 2,
    cost: 7,
    text: () => 'Flushes and straights can be made with 4 cards',
    flags: { fourFingers: true },
  },
  {
    key: 'skipline',
    name: 'Skip Line',
    rarity: 2,
    cost: 7,
    text: () => 'Straights can skip one rank between cards (like 10 8 7 5 4)',
    flags: { shortcut: true },
  },
  {
    key: 'smudged',
    name: 'Smudged Ink',
    rarity: 2,
    cost: 7,
    text: () => '♥ and ♦ count as the same suit, and so do ♠ and ♣',
    flags: { smeared: true },
  },
  {
    key: 'everyface',
    name: 'Every Face',
    rarity: 2,
    cost: 6,
    text: () => 'Every card counts as a face card',
    flags: { allFace: true },
  },
  {
    key: 'fullspread',
    name: 'Full Spread',
    rarity: 2,
    cost: 5,
    text: () => 'Every played card counts in scoring',
    flags: { splash: true },
  },
  {
    key: 'bull',
    name: 'Bull Market',
    rarity: 2,
    cost: 6,
    text: (_j, g) => `+2 Chips for each $1 you have (currently +${2 * Math.max(0, g.money)} Chips)`,
    main: (ctx) => (ctx.g.money > 0 ? { chips: 2 * ctx.g.money } : undefined),
  },
  {
    key: 'wallet',
    name: 'Wallet Chain',
    rarity: 2,
    cost: 7,
    text: (_j, g) => `+2 Mult for every $5 you have (currently +${2 * Math.floor(Math.max(0, g.money) / 5)} Mult)`,
    main: (ctx) => {
      const m = 2 * Math.floor(ctx.g.money / 5)
      return m > 0 ? { mult: m } : undefined
    },
  },
  {
    key: 'compound',
    name: 'Compound',
    rarity: 2,
    cost: 5,
    text: () => 'Earn an extra $1 of interest for every $5 you have at the end of the round',
    noCopy: true,
  },
  {
    key: 'heavystock',
    name: 'Heavy Stock',
    rarity: 2,
    cost: 7,
    text: (_j, g) => `×0.25 Mult for each Card Stock card in your deck (currently ${fmtX(1 + 0.25 * countEnh(g, 'stock'))})`,
    main: (ctx) => {
      const n = countEnh(ctx.g, 'stock')
      return n > 0 ? { xmult: 1 + 0.25 * n } : undefined
    },
  },
  {
    key: 'thinstack',
    name: 'Thin Stack',
    rarity: 2,
    cost: 6,
    text: (_j, g) => `+4 Mult for each card your deck is below its starting size (currently +${4 * cardsMissing(g)} Mult)`,
    main: (ctx) => {
      const n = cardsMissing(ctx.g)
      return n > 0 ? { mult: 4 * n } : undefined
    },
  },
  {
    key: 'highsociety',
    name: 'High Society',
    rarity: 2,
    cost: 7,
    text: () => 'Each Queen held in hand gives +13 Mult',
    onHeld: (_ctx, _j, c) => (rankIn(c, [12]) ? { mult: 13 } : undefined),
  },

  // ——— Rare ———
  {
    key: 'copycat',
    name: 'Copycat',
    rarity: 3,
    cost: 10,
    text: () => 'Copies the ability of the Joker to its right',
  },
  {
    key: 'royal',
    name: 'Royal Treatment',
    rarity: 3,
    cost: 8,
    text: () => 'Played Kings and Queens give ×1.5 Mult when scored',
    onScored: (_ctx, _j, c) => (rankIn(c, [12, 13]) ? { xmult: 1.5 } : undefined),
  },
  {
    key: 'court',
    name: 'Court Holder',
    rarity: 3,
    cost: 8,
    text: () => 'Each King held in hand gives ×1.5 Mult',
    onHeld: (_ctx, _j, c) => (rankIn(c, [13]) ? { xmult: 1.5 } : undefined),
  },
  {
    key: 'trophy',
    name: 'Trophy Case',
    rarity: 3,
    cost: 8,
    init: { x: 1 },
    text: (j) => `Gains ×0.5 Mult each time you defeat a Boss Blind (currently ${fmtX(j.s.x)} Mult)`,
    badge: (j) => fmtX(j.s.x),
    onBoss: (_g, j) => {
      j.s.x += 0.5
    },
    main: (_ctx, j) => (j.s.x > 1 ? { xmult: j.s.x } : undefined),
  },
  handX('twinpeaks', 'Twin Peaks', 'pair', 2),
  handX('trio', 'Trio', 'three', 3),
  handX('coloring', 'Coloring Book', 'flush', 2),
  {
    key: 'tradingcard',
    name: 'Trading Card',
    rarity: 3,
    cost: 8,
    text: () => 'Each Uncommon Joker gives ×1.5 Mult',
    onOther: (_ctx, _j, other) => (JOKER_MAP[other.key]?.rarity === 2 ? { xmult: 1.5 } : undefined),
  },
  {
    key: 'jackpot',
    name: 'Jackpot',
    rarity: 3,
    cost: 8,
    init: { x: 1 },
    text: (j) => `Gains ×0.25 Mult each time a Scratch-off card pays out (currently ${fmtX(j.s.x)} Mult)`,
    badge: (j) => fmtX(j.s.x),
    onScratch: (_g, j) => {
      j.s.x += 0.25
    },
    main: (_ctx, j) => (j.s.x > 1 ? { xmult: j.s.x } : undefined),
  },
  {
    key: 'glassact',
    name: 'Glass Act',
    rarity: 3,
    cost: 8,
    init: { x: 1 },
    text: (j) => `Gains ×0.75 Mult each time a Tissue card tears (currently ${fmtX(j.s.x)} Mult)`,
    badge: (j) => fmtX(j.s.x),
    onTear: (_g, j) => {
      j.s.x += 0.75
    },
    main: (_ctx, j) => (j.s.x > 1 ? { xmult: j.s.x } : undefined),
  },
]

export const JOKER_MAP: Record<string, JokerDef> = Object.fromEntries(JOKERS.map((j) => [j.key, j]))

export function jokerDef(key: string): JokerDef {
  return JOKER_MAP[key]
}

export function sellValue(j: JokerInst): number {
  return Math.max(1, Math.floor(j.cost / 2)) + j.extraSell
}

export function effectiveJokerSlots(g: GameState): number {
  return g.jokerSlots + g.jokers.filter((j) => j.ed === 'ghost').length
}

export function emptySlots(g: GameState): number {
  return Math.max(0, effectiveJokerSlots(g) - g.jokers.length)
}

export function countEnh(g: GameState, enh: Card['enh']): number {
  let n = 0
  for (const id in g.cards) if (g.cards[id].enh === enh) n++
  return n
}

export function cardsMissing(g: GameState): number {
  return Math.max(0, g.startDeckSize - Object.keys(g.cards).length)
}
