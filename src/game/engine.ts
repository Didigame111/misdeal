import { anteBase, BOSSES, BOSS_MAP, isDebuffed, isShowdown, roundBoss, TAGS, TAG_MAP } from './blinds'
import { makeCard, RANKS, SUIT_ORDER, SUITS } from './cards'
import { canUseCons, consDef } from './consumables'
import { difficultyMods, tidy } from './difficulty'
import { HAND_ORDER } from './hands'
import { JOKER_MAP, sellValue } from './jokers'
import { DECK_MAP, PACKS, VOUCHERS, VOUCHER_MAP, VOUCHER_PRICE } from './meta'
import {
  addCons,
  canAddJoker,
  deckSize,
  destroyCard,
  makeJoker,
  newId,
  randomCard,
  randomJokerKey,
  randomPlateKey,
  randomStampKey,
  rollEdition,
} from './ops'
import { chance, hashStr, makeSeed, pick, randInt, shuffle, weighted } from './rng'
import { computeScore, heldRepeats } from './scoring'
import type {
  BlindInfo,
  Card,
  CashLine,
  GameState,
  HandType,
  PackChoice,
  PackKey,
  PackOffer,
  ShopItem,
  SortMode,
  Suit,
} from './types'

export const SAVE_VERSION = 1
export const WIN_ANTE = 8

// ——— Run setup ———

export function newGame(deckKey = 'plain', seed = makeSeed(), difficulty = 0): GameState {
  const levels = Object.fromEntries(HAND_ORDER.map((h) => [h, { level: 1, played: 0 }])) as GameState['levels']
  const g: GameState = {
    v: SAVE_VERSION,
    seed,
    rng: hashStr(seed),
    nextId: 0,
    deck: DECK_MAP[deckKey] ? deckKey : 'plain',
    phase: 'blinds',
    ante: 1,
    blindIdx: 0,
    blinds: [],
    money: 4,
    jokers: [],
    jokerSlots: 5,
    cons: [],
    consSlots: 2,
    cards: {},
    startDeckSize: 52,
    round: null,
    levels,
    vouchers: [],
    anteVoucher: null,
    tags: [],
    shop: null,
    pack: null,
    cashout: null,
    score: null,
    baseHands: 4,
    baseDiscards: 3,
    baseHandSize: 8,
    stampsUsed: 0,
    lastCons: null,
    bossesSeen: [],
    shopsVisited: 0,
    sort: 'rank',
    endless: false,
    difficulty,
    stats: { bestHand: 0, handsPlayed: 0, cardsDiscarded: 0, rerolls: 0 },
    notices: [],
  }
  const deck = DECK_MAP[g.deck]
  const suits: Suit[] = deck.cards === 'duotone' ? ['S', 'H', 'S', 'H'] : SUITS
  for (const suit of suits) {
    for (const rank of RANKS) {
      if (deck.cards === 'pageless' && rank >= 11 && rank <= 13) continue
      const card = makeCard(newId(g, 'c'), suit, rank)
      g.cards[card.id] = card
    }
  }
  deck.setup?.(g)
  g.startDeckSize = deckSize(g)
  setupAnte(g)
  return g
}

function pickBoss(g: GameState): string {
  const showdown = isShowdown(g.ante)
  const eligible = BOSSES.filter((b) => (showdown ? b.showdown : !b.showdown && b.minAnte <= g.ante))
  let fresh = eligible.filter((b) => !g.bossesSeen.includes(b.key))
  if (!fresh.length) {
    g.bossesSeen = g.bossesSeen.filter((k) => !eligible.some((b) => b.key === k))
    fresh = eligible
  }
  const boss = pick(g, fresh).key
  g.bossesSeen.push(boss)
  return boss
}

function pickTag(g: GameState, avoid?: string): string {
  return pick(
    g,
    TAGS.filter((t) => t.key !== avoid),
  ).key
}

function pickVoucher(g: GameState): string | null {
  const pool = VOUCHERS.filter((v) => !g.vouchers.includes(v.key))
  return pool.length ? pick(g, pool).key : null
}

function bossTarget(g: GameState, boss: string): number {
  const mods = difficultyMods(g.difficulty)
  return tidy(anteBase(g.ante) * BOSS_MAP[boss].scoreMult * mods.targetMult * mods.bossMult)
}

export function setupAnte(g: GameState) {
  for (const id in g.cards) g.cards[id].usedThisAnte = false
  g.blindIdx = 0
  const base = anteBase(g.ante)
  const mods = difficultyMods(g.difficulty)
  const boss = pickBoss(g)
  const smallTag = pickTag(g)
  g.blinds = [
    { kind: 'small', target: tidy(base * mods.targetMult), reward: mods.smallReward ? 3 : 0, tag: smallTag, status: 'upcoming' },
    { kind: 'big', target: tidy(base * 1.5 * mods.targetMult), reward: 4, tag: pickTag(g, smallTag), status: 'upcoming' },
    {
      kind: 'boss',
      boss,
      target: bossTarget(g, boss),
      reward: isShowdown(g.ante) ? 8 : 5,
      status: 'upcoming',
    },
  ]
  g.anteVoucher = pickVoucher(g)
}

export function blindName(b: BlindInfo): string {
  if (b.kind === 'small') return 'Small Blind'
  if (b.kind === 'big') return 'Big Blind'
  return BOSS_MAP[b.boss!]?.name ?? 'Boss Blind'
}

// ——— Blind select ———

export function selectBlind(g: GameState) {
  if (g.phase !== 'blinds') return
  const b = g.blinds[g.blindIdx]
  b.status = 'current'
  const boss = b.kind === 'boss' ? BOSS_MAP[b.boss!] : null
  let handSize = g.baseHandSize + (boss?.handSize ?? 0)
  const big = g.tags.indexOf('bighand')
  if (big >= 0) {
    handSize += 3
    g.tags.splice(big, 1)
  }
  for (const id in g.cards) g.cards[id].faceDown = false
  g.round = {
    target: b.target,
    score: 0,
    handsLeft: Math.max(1, g.baseHands + (boss?.hands ?? 0)),
    discardsLeft: boss?.noDiscards ? 0 : Math.max(0, g.baseDiscards + (boss?.discards ?? 0) + difficultyMods(g.difficulty).discards),
    handSize: Math.max(1, handSize),
    hand: [],
    draw: shuffle(g, Object.keys(g.cards)),
    discard: [],
    played: [],
    selected: [],
    handsPlayed: 0,
    discardsUsed: 0,
    typesPlayed: [],
  }
  g.phase = 'round'
  drawCards(g)
  settleHand(g)
}

export function skipBlind(g: GameState) {
  if (g.phase !== 'blinds') return
  const b = g.blinds[g.blindIdx]
  if (b.kind === 'boss') return
  b.status = 'skipped'
  g.blindIdx += 1
  if (b.tag) applyTag(g, b.tag)
}

function applyTag(g: GameState, key: string) {
  const tag = TAG_MAP[key]
  if (!tag) return
  if (tag.when !== 'instant') {
    g.tags.push(key)
    g.notices.push(`${tag.name}: ${tag.text.charAt(0).toLowerCase()}${tag.text.slice(1)}`)
    return
  }
  switch (key) {
    case 'payday':
      g.money += 10
      g.notices.push('Payday: +$10')
      break
    case 'jokerbundle':
      openPack(g, 'jokerMega', 'blinds')
      break
    case 'platebundle':
      openPack(g, 'plateMega', 'blinds')
      break
    case 'stampbundle':
      openPack(g, 'stampMega', 'blinds')
      break
    case 'bossswap': {
      const b = g.blinds[2]
      b.boss = pickBoss(g)
      b.target = bossTarget(g, b.boss)
      g.notices.push(`The boss is now ${BOSS_MAP[b.boss].name}`)
      break
    }
  }
}

// ——— Hand management ———

function sortIds(g: GameState, ids: string[], mode: SortMode) {
  const key = (c: Card) => (c.faceDown ? -1000 : c.enh === 'blank' ? -500 : c.rank)
  ids.sort((a, b) => {
    const ca = g.cards[a]
    const cb = g.cards[b]
    if (mode === 'suit' && !ca.faceDown && !cb.faceDown && ca.enh !== 'blank' && cb.enh !== 'blank') {
      const d = SUIT_ORDER[ca.suit] - SUIT_ORDER[cb.suit]
      if (d) return d
    }
    return key(cb) - key(ca) || SUIT_ORDER[ca.suit] - SUIT_ORDER[cb.suit]
  })
}

export function sortHand(g: GameState) {
  if (g.round) sortIds(g, g.round.hand, g.sort)
  if (g.pack) sortIds(g, g.pack.hand, g.sort)
}

export function setSort(g: GameState, mode: SortMode) {
  g.sort = mode
  sortHand(g)
}

function drawCards(g: GameState) {
  const r = g.round!
  const boss = roundBoss(g)
  while (r.hand.length < r.handSize && r.draw.length) {
    const id = r.draw.pop()!
    const c = g.cards[id]
    c.faceDown = !!boss?.rules.faceDown && chance(g, boss.rules.faceDown)
    r.hand.push(id)
  }
  sortHand(g)
}

export function toggleSelect(g: GameState, id: string) {
  const list = g.phase === 'round' ? g.round?.selected : g.phase === 'pack' ? g.pack?.selected : null
  if (!list) return
  const i = list.indexOf(id)
  if (i >= 0) list.splice(i, 1)
  else if (list.length < 5) list.push(id)
}

export function clearSelection(g: GameState) {
  if (g.round) g.round.selected = []
  if (g.pack) g.pack.selected = []
}

function move<T>(arr: T[], from: number, to: number) {
  if (from < 0 || from >= arr.length || to < 0 || to >= arr.length || from === to) return
  const [x] = arr.splice(from, 1)
  arr.splice(to, 0, x)
}

export function moveHandCard(g: GameState, from: number, to: number) {
  if (g.phase === 'round' && g.round) move(g.round.hand, from, to)
  else if (g.phase === 'pack' && g.pack) move(g.pack.hand, from, to)
}

export function moveJoker(g: GameState, from: number, to: number) {
  if (g.phase === 'scoring') return
  move(g.jokers, from, to)
}

export function moveCons(g: GameState, from: number, to: number) {
  move(g.cons, from, to)
}

export function selectedInOrder(g: GameState): string[] {
  if (g.phase === 'pack' && g.pack) return g.pack.hand.filter((id) => g.pack!.selected.includes(id))
  const r = g.round
  return r ? r.hand.filter((id) => r.selected.includes(id)) : []
}

// ——— Playing ———

export function playHand(g: GameState) {
  if (g.phase !== 'round' || !g.round) return
  const r = g.round
  const sel = selectedInOrder(g)
  if (!sel.length || sel.length > 5 || r.handsLeft <= 0) return
  r.played = sel
  r.hand = r.hand.filter((id) => !sel.includes(id))
  r.selected = []
  r.handsLeft -= 1
  r.handsPlayed += 1
  for (const id of sel) g.cards[id].faceDown = false
  const boss = roundBoss(g)
  if (boss?.rules.taxPerCard) g.money = Math.max(0, g.money - boss.rules.taxPerCard * sel.length)
  g.score = computeScore(g, r.played, r.hand)
  g.stats.handsPlayed += 1
  g.phase = 'scoring'
}

function removeDeadJokers(g: GameState) {
  const dead = g.jokers.filter((j) => j.s.dead)
  if (!dead.length) return
  for (const j of dead) g.notices.push(`${JOKER_MAP[j.key].name} is used up`)
  g.jokers = g.jokers.filter((j) => !j.s.dead)
}

export function finishScoring(g: GameState) {
  if (g.phase !== 'scoring' || !g.score || !g.round) return
  const res = g.score
  const r = g.round
  r.score += res.total
  g.stats.bestHand = Math.max(g.stats.bestHand, res.total)
  for (const id of r.played) if (g.cards[id]) g.cards[id].usedThisAnte = true
  if (res.destroyed.length) {
    g.notices.push(res.destroyed.length === 1 ? 'A Tissue card tore' : `${res.destroyed.length} Tissue cards tore`)
    for (const id of res.destroyed) destroyCard(g, id)
  }
  r.discard.push(...r.played)
  r.played = []
  g.score = null
  removeDeadJokers(g)
  updateMostPlayed(g)

  if (r.score >= r.target) {
    winRound(g)
    return
  }
  if (r.handsLeft <= 0) {
    g.phase = 'over'
    return
  }
  const boss = roundBoss(g)
  if (boss?.rules.jam) {
    const jammed: string[] = []
    const pool = [...r.hand]
    for (let k = 0; k < boss.rules.jam && pool.length; k++) jammed.push(...pool.splice(randInt(g, pool.length), 1))
    discardCards(g, jammed, false)
  }
  drawCards(g)
  g.phase = 'round'
  settleHand(g)
}

/**
 * A round can't continue with an empty hand. Refill it, and if the deck is spent too,
 * the round is lost instead of leaving the player with nothing to tap.
 */
function settleHand(g: GameState) {
  const r = g.round
  if (!r || g.phase !== 'round' || r.hand.length) return
  drawCards(g)
  if (!r.hand.length) g.phase = 'over'
}

/** Moves cards from the hand to the discard pile, firing seals. Only player discards count for Jokers. */
function discardCards(g: GameState, ids: string[], byPlayer: boolean) {
  const r = g.round!
  r.hand = r.hand.filter((id) => !ids.includes(id))
  r.discard.push(...ids)
  const cards = ids.map((id) => g.cards[id]).filter(Boolean)
  for (const c of cards) {
    if (c.seal === 'stamp' && !isDebuffed(g, c) && addCons(g, randomStampKey(g))) g.notices.push('Stamp seal: you got a Stamp')
    c.faceDown = false
  }
  if (byPlayer) for (const j of g.jokers) JOKER_MAP[j.key].onDiscard?.(g, j, cards)
}

function updateMostPlayed(g: GameState) {
  let best: HandType | undefined
  for (const h of HAND_ORDER) if (!best || g.levels[h].played > g.levels[best].played) best = h
  if (best && g.levels[best].played > 0) g.stats.mostPlayed = best
}

export function discard(g: GameState) {
  if (g.phase !== 'round' || !g.round) return
  const r = g.round
  const sel = selectedInOrder(g)
  if (!sel.length || r.discardsLeft <= 0) return
  r.selected = []
  r.discardsLeft -= 1
  r.discardsUsed += 1
  g.stats.cardsDiscarded += sel.length
  discardCards(g, sel, true)
  drawCards(g)
  settleHand(g)
}

function winRound(g: GameState) {
  const r = g.round!
  const b = g.blinds[g.blindIdx]
  b.status = 'beaten'
  const mint = g.deck === 'mint'
  const lines: CashLine[] = b.reward > 0 ? [{ label: blindName(b), amount: b.reward }] : []
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

  if (r.handsLeft > 0) lines.push({ label: `${plural(r.handsLeft, 'hand')} left`, amount: r.handsLeft * (mint ? 2 : 1) })
  if (mint && r.discardsLeft > 0) lines.push({ label: `${plural(r.discardsLeft, 'discard')} left`, amount: r.discardsLeft })

  const held = r.hand.map((id) => g.cards[id]).filter(Boolean)
  let gildedCards = 0
  let gildedPays = 0
  held.forEach((c, i) => {
    if (isDebuffed(g, c)) return
    const reps = heldRepeats(g, c, i)
    if (c.enh === 'gilded') {
      gildedCards += 1
      gildedPays += reps
    }
    if (c.seal === 'plate' && r.lastHand) {
      for (let k = 0; k < reps; k++) if (addCons(g, `plate_${r.lastHand}`)) g.notices.push('Plate seal: you got a Plate')
    }
  })
  if (gildedPays) lines.push({ label: `${plural(gildedCards, 'Gilded card')} in hand`, amount: 3 * gildedPays })

  for (const j of g.jokers) {
    const m = JOKER_MAP[j.key].roundEnd?.(g, j)
    if (m) lines.push({ label: JOKER_MAP[j.key].name, amount: m })
  }
  removeDeadJokers(g)

  if (b.kind === 'boss') {
    for (const j of g.jokers) JOKER_MAP[j.key].onBoss?.(g, j)
    const inv = g.tags.indexOf('investment')
    if (inv >= 0) {
      g.tags.splice(inv, 1)
      lines.push({ label: 'Investment', amount: 25 })
    }
  }

  if (!mint) {
    const cap = g.vouchers.includes('savings') ? 10 : 5
    const interest = Math.min(cap, Math.floor(Math.max(0, g.money) / 5))
    if (interest > 0) {
      lines.push({ label: `Interest ($1 per $5, up to $${cap})`, amount: interest })
      const compounds = g.jokers.filter((j) => j.key === 'compound').length
      if (compounds) lines.push({ label: 'Compound', amount: interest * compounds })
    }
  }

  g.cashout = lines
  g.phase = b.kind === 'boss' && g.ante === WIN_ANTE && !g.endless ? 'won' : 'cashout'
}

export function continueEndless(g: GameState) {
  if (g.phase !== 'won') return
  g.endless = true
  g.phase = 'cashout'
}

export function cashOut(g: GameState) {
  if (g.phase !== 'cashout' || !g.cashout) return
  g.money += g.cashout.reduce((s, l) => s + l.amount, 0)
  g.cashout = null
  g.round = null
  for (const id in g.cards) g.cards[id].faceDown = false
  genShop(g)
  g.shopsVisited += 1
  g.phase = 'shop'
}

// ——— Shop ———

export function priceOf(g: GameState, raw: number): number {
  const base = raw + difficultyMods(g.difficulty).shopPlus
  return g.vouchers.includes('member') ? Math.max(1, Math.round(base * 0.75)) : base
}

const cardBase = (card: Card) => 1 + (card.enh ? 1 : 0) + (card.ed ? 2 : 0) + (card.seal ? 1 : 0)

/** Undiscounted price of a shop item. */
function basePrice(it: ShopItem): number {
  if (it.kind === 'joker') return it.joker.cost
  if (it.kind === 'card') return cardBase(it.card)
  return 3
}

const baseReroll = (g: GameState) => (g.vouchers.includes('bulkreroll') ? 3 : 5)
const shopSlots = (g: GameState) => 2 + (g.vouchers.includes('overstock') ? 1 : 0)

function genShopItem(g: GameState, taken: Set<string>): ShopItem {
  const kind = weighted(g, [
    ['joker', 20],
    ['plate', g.vouchers.includes('platerack') ? 8 : 4],
    ['stamp', g.vouchers.includes('stamprack') ? 8 : 4],
    ['card', g.vouchers.includes('printer') ? 4 : 0],
  ] as const)
  const id = newId(g, 's')
  if (kind === 'joker') {
    const key = randomJokerKey(g, undefined, taken)
    taken.add(key)
    const joker = makeJoker(g, key, rollEdition(g))
    return { id, kind: 'joker', joker, price: priceOf(g, joker.cost) }
  }
  if (kind === 'card') {
    const card = randomCard(g, { enh: 0.4, ed: 0.1, seal: 0.1 })
    return { id, kind: 'card', card, price: priceOf(g, cardBase(card)) }
  }
  const key = kind === 'plate' ? randomPlateKey(g) : randomStampKey(g)
  return { id, kind: 'cons', cons: { id: newId(g, 'k'), key }, price: priceOf(g, 3) }
}

function genItems(g: GameState): ShopItem[] {
  const taken = new Set(g.jokers.map((j) => j.key))
  const items: ShopItem[] = []
  for (let i = 0; i < shopSlots(g); i++) items.push(genShopItem(g, taken))
  return items
}

function genPack(g: GameState, force?: PackKey): PackOffer {
  const key = force ?? weighted(g, Object.entries(PACKS).map(([k, p]) => [k as PackKey, p.weight] as const))
  return { id: newId(g, 'p'), pack: key, price: priceOf(g, PACKS[key].price) }
}

function genShop(g: GameState) {
  const items = genItems(g)
  const packs = [genPack(g, g.shopsVisited === 0 ? 'joker' : undefined), genPack(g)]
  let rerollCost = baseReroll(g)
  const shopTags = g.tags.filter((t) => TAG_MAP[t]?.when === 'shop')
  g.tags = g.tags.filter((t) => TAG_MAP[t]?.when !== 'shop')
  const taken = new Set([...g.jokers.map((j) => j.key), ...items.flatMap((i) => (i.kind === 'joker' ? [i.joker.key] : []))])
  const freeJoker = (rarity: 1 | 2 | 3 | undefined, ed?: 'prism') => {
    const key = randomJokerKey(g, rarity, taken)
    taken.add(key)
    items.push({ id: newId(g, 's'), kind: 'joker', joker: makeJoker(g, key, ed), price: 0 })
  }
  for (const t of shopTags) {
    if (t === 'rarefind') freeJoker(3)
    if (t === 'luckyfind') freeJoker(2)
    if (t === 'prismtag') freeJoker(undefined, 'prism')
    if (t === 'coupon') {
      for (const it of items) it.price = 0
      for (const p of packs) p.price = 0
    }
    if (t === 'freeroll') rerollCost = 0
  }
  g.shop = { items, packs, rerollCost }
}

export function reroll(g: GameState) {
  if (g.phase !== 'shop' || !g.shop) return
  const s = g.shop
  if (g.money < s.rerollCost) return
  g.money -= s.rerollCost
  s.rerollCost += 1
  s.items = genItems(g)
  g.stats.rerolls += 1
  for (const j of g.jokers) JOKER_MAP[j.key].onReroll?.(g, j)
}

export function buyItem(g: GameState, itemId: string, useNow = false) {
  if (g.phase !== 'shop' || !g.shop) return
  const s = g.shop
  const idx = s.items.findIndex((i) => i.id === itemId)
  const item = s.items[idx]
  if (!item || g.money < item.price) return
  if (item.kind === 'joker') {
    if (!canAddJoker(g, item.joker)) {
      g.notices.push('No room for another Joker. Sell one first')
      return
    }
    g.jokers.push(item.joker)
  } else if (item.kind === 'cons') {
    const def = consDef(item.cons.key)
    if (useNow) {
      const room = g.consSlots - g.cons.length
      if (!canUseCons(def, { g, selected: [], room })) return
      g.money -= item.price
      s.items.splice(idx, 1)
      runCons(g, item.cons.key, [], room)
      return
    }
    if (g.cons.length >= g.consSlots) {
      g.notices.push('No room for another consumable')
      return
    }
    g.cons.push(item.cons)
  } else {
    g.cards[item.card.id] = item.card
  }
  g.money -= item.price
  s.items.splice(idx, 1)
}

export function buyPack(g: GameState, offerId: string) {
  if (g.phase !== 'shop' || !g.shop) return
  const idx = g.shop.packs.findIndex((p) => p.id === offerId)
  const offer = g.shop.packs[idx]
  if (!offer || g.money < offer.price) return
  g.money -= offer.price
  g.shop.packs.splice(idx, 1)
  openPack(g, offer.pack, 'shop')
}

export function buyVoucher(g: GameState) {
  if (g.phase !== 'shop' || !g.anteVoucher) return
  const price = priceOf(g, VOUCHER_PRICE)
  if (g.money < price) return
  g.money -= price
  const v = VOUCHER_MAP[g.anteVoucher]
  g.vouchers.push(v.key)
  g.anteVoucher = null
  v.apply?.(g)
  if (v.key === 'member' && g.shop) {
    for (const it of g.shop.items) if (it.price > 0) it.price = priceOf(g, basePrice(it))
    for (const p of g.shop.packs) if (p.price > 0) p.price = priceOf(g, PACKS[p.pack].price)
  }
  if (v.key === 'bulkreroll' && g.shop) g.shop.rerollCost = Math.max(0, g.shop.rerollCost - 2)
  if (v.key === 'overstock' && g.shop) {
    const taken = new Set([...g.jokers.map((j) => j.key), ...g.shop.items.flatMap((i) => (i.kind === 'joker' ? [i.joker.key] : []))])
    g.shop.items.push(genShopItem(g, taken))
  }
}

export function sellJoker(g: GameState, id: string) {
  if (g.phase === 'scoring') return
  const idx = g.jokers.findIndex((j) => j.id === id)
  if (idx < 0) return
  g.money += sellValue(g.jokers[idx])
  g.jokers.splice(idx, 1)
}

export const CONS_SELL = 1

export function sellCons(g: GameState, id: string) {
  if (g.phase === 'scoring') return
  const idx = g.cons.findIndex((c) => c.id === id)
  if (idx < 0) return
  g.money += CONS_SELL
  g.cons.splice(idx, 1)
}

// ——— Consumables ———

function runCons(g: GameState, key: string, selectedIds: string[], room: number) {
  const def = consDef(key)
  const selected = selectedIds.map((id) => g.cards[id])
  def.use({ g, selected, room })
  if (def.kind === 'stamp') g.stampsUsed += 1
  if (def.key !== 'reprint') g.lastCons = def.key
}

export function consUsable(g: GameState, consId: string): boolean {
  if (!['round', 'shop', 'blinds', 'pack'].includes(g.phase)) return false
  const inst = g.cons.find((c) => c.id === consId)
  if (!inst) return false
  const selected = selectedInOrder(g).map((id) => g.cards[id])
  return canUseCons(consDef(inst.key), { g, selected, room: g.consSlots - g.cons.length + 1 })
}

export function useCons(g: GameState, consId: string) {
  if (!consUsable(g, consId)) return
  const idx = g.cons.findIndex((c) => c.id === consId)
  const [inst] = g.cons.splice(idx, 1)
  runCons(g, inst.key, selectedInOrder(g), g.consSlots - g.cons.length)
  clearSelection(g)
  // Shred can empty the hand mid-round.
  settleHand(g)
}

// ——— Packs ———

export function openPack(g: GameState, key: PackKey, returnTo: 'shop' | 'blinds') {
  const def = PACKS[key]
  const choices: PackChoice[] = []
  const taken = new Set([...g.jokers.map((j) => j.key), ...(g.shop?.items ?? []).flatMap((i) => (i.kind === 'joker' ? [i.joker.key] : []))])
  const usedCons = new Set<string>()
  for (let i = 0; i < def.size; i++) {
    const id = newId(g, 'o')
    if (def.kind === 'joker') {
      const k = randomJokerKey(g, undefined, taken)
      taken.add(k)
      choices.push({ id, kind: 'joker', joker: makeJoker(g, k, rollEdition(g, 2)) })
    } else if (def.kind === 'print') {
      choices.push({ id, kind: 'card', card: randomCard(g, { enh: 0.35, ed: 0.08, seal: 0.1 }) })
    } else {
      let k = def.kind === 'plate' ? randomPlateKey(g) : randomStampKey(g, usedCons)
      for (let tries = 0; usedCons.has(k) && tries < 8; tries++) k = def.kind === 'plate' ? randomPlateKey(g) : randomStampKey(g, usedCons)
      usedCons.add(k)
      choices.push({ id, kind: 'cons', cons: { id: newId(g, 'k'), key: k } })
    }
  }
  const hand = def.kind === 'stamp' ? shuffle(g, Object.keys(g.cards)).slice(0, g.baseHandSize) : []
  g.pack = { pack: key, choices, picksLeft: def.picks, returnTo, hand, selected: [] }
  sortHand(g)
  g.phase = 'pack'
}

export function packChoiceUsable(g: GameState, choiceId: string): boolean {
  const pk = g.pack
  const choice = pk?.choices.find((c) => c.id === choiceId)
  if (!pk || !choice) return false
  if (choice.kind === 'joker') return canAddJoker(g, choice.joker)
  if (choice.kind === 'card') return true
  const def = consDef(choice.cons.key)
  const selected = selectedInOrder(g).map((id) => g.cards[id])
  return canUseCons(def, { g, selected, room: g.consSlots - g.cons.length })
}

export function packPick(g: GameState, choiceId: string) {
  if (g.phase !== 'pack' || !g.pack) return
  const pk = g.pack
  const idx = pk.choices.findIndex((c) => c.id === choiceId)
  const choice = pk.choices[idx]
  if (!choice) return
  if (!packChoiceUsable(g, choiceId)) {
    if (choice.kind === 'joker') g.notices.push('No room for another Joker. Sell one first')
    return
  }
  if (choice.kind === 'joker') g.jokers.push(choice.joker)
  else if (choice.kind === 'card') g.cards[choice.card.id] = choice.card
  else {
    runCons(g, choice.cons.key, selectedInOrder(g), g.consSlots - g.cons.length)
    pk.selected = []
  }
  pk.choices.splice(idx, 1)
  pk.picksLeft -= 1
  if (pk.picksLeft <= 0 || !pk.choices.length) closePack(g)
}

export function skipPack(g: GameState) {
  if (g.phase !== 'pack') return
  closePack(g)
}

function closePack(g: GameState) {
  const to = g.pack?.returnTo ?? 'shop'
  g.pack = null
  g.phase = to
}

// ——— Between rounds ———

export function buyAndUseAllowed(g: GameState, item: ShopItem): boolean {
  if (item.kind !== 'cons') return false
  return canUseCons(consDef(item.cons.key), { g, selected: [], room: g.consSlots - g.cons.length })
}

export function nextRound(g: GameState) {
  if (g.phase !== 'shop') return
  g.shop = null
  if (g.blindIdx >= 2) {
    g.ante += 1
    setupAnte(g)
  } else {
    g.blindIdx += 1
  }
  g.phase = 'blinds'
}

export function currentBlind(g: GameState): BlindInfo | undefined {
  return g.blinds[g.blindIdx]
}
