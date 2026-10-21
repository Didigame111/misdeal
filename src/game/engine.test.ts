import { describe, expect, it } from 'vitest'
import { anteBase } from './blinds'
import { makeCard } from './cards'
import * as E from './engine'
import { evaluate } from './hands'
import { makeJoker } from './ops'
import { computeScore } from './scoring'
import type { Card, GameState, Rank, Suit } from './types'

let n = 0
const c = (spec: string, extra: Partial<Card> = {}): Card => {
  const suit = spec.slice(-1) as Suit
  const r = spec.slice(0, -1)
  const rank = ({ J: 11, Q: 12, K: 13, A: 14 } as Record<string, number>)[r] ?? Number(r)
  return makeCard(`t${n++}`, suit, rank as Rank, extra)
}
const hand = (...specs: string[]) => specs.map((s) => c(s))

describe('evaluate', () => {
  it('finds the basic hands', () => {
    expect(evaluate(hand('AS')).type).toBe('high')
    expect(evaluate(hand('9S', '9H', '2C')).type).toBe('pair')
    expect(evaluate(hand('9S', '9H', '2C', '2D')).type).toBe('twopair')
    expect(evaluate(hand('9S', '9H', '9C')).type).toBe('three')
    expect(evaluate(hand('5S', '6H', '7C', '8D', '9S')).type).toBe('straight')
    expect(evaluate(hand('AS', '2H', '3C', '4D', '5S')).type).toBe('straight')
    expect(evaluate(hand('10S', 'JH', 'QC', 'KD', 'AS')).type).toBe('straight')
    expect(evaluate(hand('2S', '7S', '9S', 'JS', 'KS')).type).toBe('flush')
    expect(evaluate(hand('9S', '9H', '9C', '4D', '4S')).type).toBe('full')
    expect(evaluate(hand('9S', '9H', '9C', '9D', '4S')).type).toBe('four')
    expect(evaluate(hand('5S', '6S', '7S', '8S', '9S')).type).toBe('sflush')
  })

  it('does not wrap straights around the ace', () => {
    expect(evaluate(hand('QS', 'KH', 'AC', '2D', '3S')).type).toBe('high')
  })

  it('only scores the cards that make the hand', () => {
    const cards = hand('9S', '9H', '2C', 'KD')
    const ev = evaluate(cards)
    expect(ev.scoring.map((x) => x.id)).toEqual([cards[0].id, cards[1].id])
    expect(evaluate(hand('3S', 'KD', '7H')).scoring.map((x) => x.rank)).toEqual([13])
  })

  it('handles secret hands', () => {
    expect(evaluate(hand('9S', '9H', '9C', '9D', '9S')).type).toBe('five')
    expect(evaluate(hand('9S', '9S', '9S', '4S', '4S')).type).toBe('fhouse')
    expect(evaluate(hand('9S', '9S', '9S', '9S', '9S')).type).toBe('ffive')
  })

  it('applies rule-bending options', () => {
    expect(evaluate(hand('2S', '7S', '9S', 'JS', 'KH'), { fourFingers: true }).type).toBe('flush')
    expect(evaluate(hand('5S', '6H', '7C', '8D', 'KH'), { fourFingers: true }).type).toBe('straight')
    expect(evaluate(hand('3S', '5H', '7C', '9D', 'JH'), { shortcut: true }).type).toBe('straight')
    expect(evaluate(hand('2H', '7D', '9H', 'JD', 'KH'), { smeared: true }).type).toBe('flush')
    expect(evaluate(hand('9S', '9H', '2C'), { splash: true }).scoring).toHaveLength(3)
  })

  it('treats rainbow cards as every suit and blank cards as always scoring', () => {
    const cards = [c('2S'), c('7S'), c('9S'), c('JS'), c('KH', { enh: 'rainbow' })]
    expect(evaluate(cards).type).toBe('flush')
    const withBlank = [c('9S'), c('9H'), c('2C', { enh: 'blank' })]
    const ev = evaluate(withBlank)
    expect(ev.type).toBe('pair')
    expect(ev.scoring).toHaveLength(3)
  })
})

/** A game sitting in a round with a chosen hand and played cards. */
function setup(playedSpecs: string[], heldSpecs: string[] = [], tweak?: (g: GameState) => void) {
  const g = E.newGame('plain', 'TESTSEED')
  E.selectBlind(g)
  const played = playedSpecs.map((s) => c(s))
  const held = heldSpecs.map((s) => c(s))
  for (const card of [...played, ...held]) g.cards[card.id] = card
  g.round!.hand = held.map((x) => x.id)
  g.round!.handsLeft = 3
  tweak?.(g)
  return { g, res: () => computeScore(g, played.map((x) => x.id), held.map((x) => x.id)) }
}

describe('scoring', () => {
  it('scores a plain pair', () => {
    // Pair: 10 chips × 2 mult, plus two Kings at 10 chips each
    const { res } = setup(['KS', 'KH', '3C'])
    expect(res().total).toBe((10 + 20) * 2)
  })

  it('applies enhancements, editions and seals', () => {
    const { g, res } = setup(['KS', 'KH'])
    const [a, b] = Object.values(g.cards).slice(-2)
    a.enh = 'embossed'
    b.ed = 'holo'
    b.seal = 'coin'
    const before = g.money
    const r = res()
    // chips: 10 + 10 + 30 + 10 = 60; mult: 2 + 10 = 12
    expect(r.total).toBe(60 * 12)
    expect(g.money - before).toBe(3)
  })

  it('retriggers echo seals', () => {
    const { g, res } = setup(['AS'])
    Object.values(g.cards).at(-1)!.seal = 'echo'
    // High card 5 + 11 + 11 = 27 × 1
    expect(res().total).toBe(27)
  })

  it('runs jokers left to right, so order matters', () => {
    const { g, res } = setup(['KS', 'KH'], [], (g) => {
      g.jokers.push(makeJoker(g, 'twinpeaks'), makeJoker(g, 'smiley'))
    })
    // (10+20) chips; mult (2 × 2) + 4 = 8
    expect(res().total).toBe(30 * 8)
    g.jokers.reverse()
    // mult (2 + 4) × 2 = 12
    expect(res().total).toBe(30 * 12)
  })

  it('lets Copycat copy the joker to its right', () => {
    const { res } = setup(['KS', 'KH'], [], (g) => {
      g.jokers.push(makeJoker(g, 'copycat'), makeJoker(g, 'smiley'))
    })
    expect(res().total).toBe(30 * (2 + 4 + 4))
  })

  it('applies held-in-hand effects', () => {
    const { g, res } = setup(['2S'], ['KD', 'QH'], (g) => {
      g.jokers.push(makeJoker(g, 'court'))
    })
    const held = g.round!.hand.map((id) => g.cards[id])
    held[1].enh = 'stock'
    // High card 5+2 = 7 chips; mult 1 × 1.5 (King) × 1.5 (stock queen) = 2.25
    expect(res().total).toBe(Math.floor(7 * 2.25))
  })

  it('debuffs cards under a suit boss', () => {
    const { g, res } = setup(['KH', 'KS'], [], (g) => {
      g.blinds[g.blindIdx] = { ...g.blinds[g.blindIdx], kind: 'boss', boss: 'smudge' }
    })
    expect(g.blinds[g.blindIdx].boss).toBe('smudge')
    expect(res().total).toBe((10 + 10) * 2)
  })

  it('blocks short hands under The Full Sheet', () => {
    const { res } = setup(['KH', 'KS'], [], (g) => {
      g.blinds[g.blindIdx] = { ...g.blinds[g.blindIdx], kind: 'boss', boss: 'fullsheet' }
    })
    const r = res()
    expect(r.total).toBe(0)
    expect(r.blocked).toBeTruthy()
  })

  it('uses hand levels', () => {
    const { g, res } = setup(['KS', 'KH'])
    g.levels.pair.level = 3
    // Pair lv3: 10 + 2×15 = 40 chips, 2 + 2 = 4 mult; + 20 chips from kings
    expect(res().total).toBe(60 * 4)
  })
})

describe('run flow', () => {
  it('scales blind targets', () => {
    expect(anteBase(1)).toBe(300)
    expect(anteBase(8)).toBe(50000)
    expect(anteBase(9)).toBeGreaterThan(50000)
  })

  it('is deterministic for a seed', () => {
    const a = E.newGame('plain', 'SAME')
    const b = E.newGame('plain', 'SAME')
    E.selectBlind(a)
    E.selectBlind(b)
    expect(a.round!.hand).toEqual(b.round!.hand)
    expect(a.blinds.map((x) => x.boss)).toEqual(b.blinds.map((x) => x.boss))
  })

  it('plays through blinds, cash out and shop without getting stuck', () => {
    const g = E.newGame('plain', 'FLOW')
    g.money = 1000
    for (let guard = 0; guard < 4000 && g.phase !== 'over' && g.phase !== 'won'; guard++) {
      switch (g.phase) {
        case 'blinds':
          E.selectBlind(g)
          break
        case 'round': {
          const r = g.round!
          // cheat: make the target reachable so the loop exercises every phase
          r.target = Math.min(r.target, 1)
          r.selected = r.hand.slice(0, 5)
          E.playHand(g)
          break
        }
        case 'scoring':
          E.finishScoring(g)
          break
        case 'cashout':
          E.cashOut(g)
          break
        case 'shop': {
          const s = g.shop!
          if (s.items[0]) E.buyItem(g, s.items[0].id)
          if (g.anteVoucher) E.buyVoucher(g)
          if (s.packs[0]) E.buyPack(g, s.packs[0].id)
          else E.nextRound(g)
          break
        }
        case 'pack': {
          const choice = g.pack!.choices.find((ch) => E.packChoiceUsable(g, ch.id))
          if (choice) E.packPick(g, choice.id)
          else E.skipPack(g)
          break
        }
      }
    }
    expect(g.phase).toBe('won')
    expect(g.ante).toBe(8)
    expect(Object.keys(g.cards).length).toBeGreaterThan(40)
  })

  it('discards and redraws', () => {
    const g = E.newGame('plain', 'DISC')
    E.selectBlind(g)
    const r = g.round!
    const first = r.hand.slice(0, 3)
    r.selected = [...first]
    E.discard(g)
    expect(r.hand).toHaveLength(8)
    expect(r.discardsLeft).toBe(2)
    for (const id of first) expect(r.hand).not.toContain(id)
  })

  it('skipping a blind grants its tag', () => {
    const g = E.newGame('plain', 'SKIP')
    const tag = g.blinds[0].tag!
    E.skipBlind(g)
    expect(g.blindIdx).toBe(1)
    const instant = ['payday', 'jokerbundle', 'platebundle', 'stampbundle', 'bossswap']
    if (!instant.includes(tag)) expect(g.tags).toContain(tag)
  })
})
