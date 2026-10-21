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

/** A round holding exactly these cards, with an empty draw pile. */
function table(playedSpecs: string[], heldSpecs: string[] = [], jokers: string[] = [], boss?: string) {
  const g = E.newGame('plain', 'QA-FIX')
  if (boss) g.blinds[0] = { ...g.blinds[0], kind: 'boss', boss }
  E.selectBlind(g)
  g.cards = {}
  const add = (s: string) => {
    const card = c(s)
    g.cards[card.id] = card
    return card
  }
  const p = playedSpecs.map(add)
  const h = heldSpecs.map(add)
  Object.assign(g.round!, { hand: [...p, ...h].map((x) => x.id), draw: [], discard: [], played: [], selected: [], target: 1e12 })
  g.jokers = jokers.map((k) => makeJoker(g, k))
  const play = () => {
    g.round!.selected = p.map((x) => x.id)
    E.playHand(g)
    return g.score!
  }
  return { g, p, h, play }
}

describe('QA round 1 regressions', () => {
  it('ends the round instead of stalling when the last cards are discarded', () => {
    const { g, p } = table(['2S'])
    g.round!.selected = [p[0].id]
    E.discard(g)
    expect(g.phase).toBe('over')
  })

  it('makes Duplicate an exact copy', () => {
    const { g, p } = table(['2S', '14H'])
    Object.assign(p[0], { enh: 'tissue', ed: 'prism', seal: 'echo' })
    g.round!.selected = p.map((x) => x.id)
    g.cons.push({ id: 'k-dup', key: 'duplicate' })
    E.useCons(g, 'k-dup')
    expect(g.cards[p[0].id]).toEqual({ ...p[1], id: p[0].id, faceDown: false })
  })

  it('lets Copycat repeat Press Run but not scaling counters', () => {
    const { g, play } = table(['2S'], [], ['copycat', 'pressrun'])
    g.rng = 0
    expect(play().level).toBe(2)
    const m = table(['2S'], [], ['copycat', 'momentum'])
    m.play()
    expect(m.g.jokers[1].s.mult).toBe(1)
  })

  it('retriggers held end-of-round abilities and skips debuffed seals', () => {
    const a = table(['2S'], ['3H'], ['shadow'])
    a.h[0].enh = 'gilded'
    a.g.round!.target = 1
    a.play()
    E.finishScoring(a.g)
    expect(a.g.cashout!.find((x) => x.label.includes('Gilded'))!.amount).toBe(6)

    const b = table(['2S'], ['3H'], [], 'smudge')
    b.h[0].seal = 'plate'
    b.g.round!.target = 1
    b.play()
    E.finishScoring(b.g)
    expect(b.g.cons).toHaveLength(0)
  })

  it('fires Stamp seals on cards The Paper Jam discards', () => {
    const { g, h, play } = table(['2S'], ['3H', '4C', '5D'], [], 'paperjam')
    for (const x of h) x.seal = 'stamp'
    play()
    E.finishScoring(g)
    expect(g.cons).toHaveLength(2)
  })

  it('lets Low Ball see face-down cards and keeps four of a kind out of Two-Step', () => {
    const lb = table(['2S'], ['3H', '9S'], ['lowball'], 'blindspot')
    lb.h[0].faceDown = true
    expect(lb.play().mult).toBe(7)
    const ts = table(['2S', '2H', '2C', '2D', '9S'], [], ['twostep'])
    expect(ts.play().mult).toBe(7)
  })

  it('still counts a boss-blocked hand for Momentum and Ice Pop', () => {
    const { g, play } = table(['2S'], [], ['momentum', 'icepop'], 'fullsheet')
    expect(play().blocked).toBeTruthy()
    expect(g.jokers.map((j) => j.s)).toEqual([{ mult: 1 }, { chips: 95 }])
  })

  it('applies shop vouchers to the stock already on the shelf', () => {
    const g = E.newGame('plain', 'QA-SHOP')
    E.selectBlind(g)
    g.round!.target = 1
    g.round!.selected = g.round!.hand.slice(0, 5)
    E.playHand(g)
    E.finishScoring(g)
    E.cashOut(g)
    g.money = 100
    g.anteVoucher = 'member'
    const packBase = g.shop!.packs[0].price
    E.buyVoucher(g)
    expect(g.shop!.packs[0].price).toBe(Math.max(1, Math.round(packBase * 0.75)))
    g.anteVoucher = 'bulkreroll'
    const reroll = g.shop!.rerollCost
    E.buyVoucher(g)
    expect(g.shop!.rerollCost).toBe(Math.max(0, reroll - 2))
  })
})
