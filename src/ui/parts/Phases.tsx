import { useState, type ReactNode } from 'react'
import { BOSS_MAP, TAG_MAP } from '../../game/blinds'
import * as E from '../../game/engine'
import { PACKS, VOUCHER_MAP, VOUCHER_PRICE } from '../../game/meta'
import type { BlindInfo, PackChoice } from '../../game/types'
import { act, useStore } from '../../store'
import { PackArt, TagArt, VoucherArt } from '../art/ItemArt'
import { sfx } from '../audio'
import { fmt } from '../format'
import { rectOf, usePress, useSize } from '../hooks'
import { BlindChip, blindColor } from './Hud'
import { ConsCard, JokerCard, PlayingCard } from './Items'
import { RichText } from './RichText'
import { fanSlots } from './RoundStage'

// ——— Blind select ———

function BlindCard({ b, current }: { b: BlindInfo; current: boolean }) {
  const boss = b.boss ? BOSS_MAP[b.boss] : null
  const done = b.status === 'beaten' ? 'Beaten' : b.status === 'skipped' ? 'Skipped' : null
  const tag = b.tag && b.kind !== 'boss' ? TAG_MAP[b.tag] : null
  return (
    <section
      className={`blind-card${current ? ' is-current' : ''}${done ? ' is-done' : ''}`}
      style={{ '--accent': blindColor(b) } as React.CSSProperties}
      aria-current={current ? 'step' : undefined}
    >
      <header className="blind-head">
        <BlindChip blind={b} size="lg" />
        <h2>{E.blindName(b)}</h2>
      </header>
      <div className="blind-goal">
        <span>Score at least</span>
        <strong>{fmt(b.target)}</strong>
        <span className="blind-reward">Reward ${b.reward}</span>
      </div>
      {boss && (
        <p className="blind-rule">
          <RichText text={boss.text} />
        </p>
      )}
      <div className="blind-foot">
        {current && (
          <button
            className="btn btn-play"
            onClick={() => {
              sfx('play')
              act(E.selectBlind)
            }}
          >
            <span className="btn-label">Play</span>
          </button>
        )}
        {!current && !done && <span className="blind-later">Up next</span>}
        {tag && (
          <div className="blind-skip">
            <div className="tag-badge">
              <TagArt tkey={tag.key} />
            </div>
            <div className="blind-skip-text">
              <strong>{tag.name}</strong>
              <span>{tag.text}</span>
            </div>
            {current && (
              <button
                className="btn btn-small"
                onClick={() => {
                  sfx('button')
                  act(E.skipBlind)
                }}
              >
                Skip for tag
              </button>
            )}
          </div>
        )}
      </div>
      {done && <span className="blind-stamp">{done}</span>}
    </section>
  )
}

export function BlindSelect() {
  const g = useStore((s) => s.game!)
  return (
    <div className="blinds">
      {g.blinds.map((b, i) => (
        <BlindCard key={i} b={b} current={i === g.blindIdx} />
      ))}
    </div>
  )
}

// ——— Cash out ———

export function CashOut() {
  const g = useStore((s) => s.game!)
  const lines = g.cashout ?? []
  const total = lines.reduce((s, l) => s + l.amount, 0)
  const b = g.blinds[g.blindIdx]
  return (
    <div className="cashout">
      <div className="receipt">
        <h2>{E.blindName(b)} beaten</h2>
        <p className="receipt-sub">
          You scored {fmt(g.round?.score ?? 0)} of {fmt(b.target)}
        </p>
        <ul>
          {lines.map((l, i) => (
            <li key={i} style={{ animationDelay: `${i * 90}ms` }}>
              <span>{l.label}</span>
              <span className="leader" aria-hidden="true" />
              <b>+${l.amount}</b>
            </li>
          ))}
        </ul>
        <div className="receipt-total">
          <span>Total</span>
          <b>${total}</b>
        </div>
        <button
          className="btn btn-play btn-wide"
          disabled={g.phase !== 'cashout'}
          onClick={() => {
            sfx('money')
            act(E.cashOut)
          }}
        >
          <span className="btn-label">Cash out ${total}</span>
        </button>
      </div>
    </div>
  )
}

// ——— Shop ———

function ShopSlot({ price, short, children, onTap, label }: { price: number; short: boolean; children: ReactNode; onTap: (el: HTMLElement) => void; label: string }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const press = usePress({ onTap: () => el && onTap(el) })
  return (
    <div className="shop-slot" ref={setEl} role="button" tabIndex={0} aria-label={`${label}, $${price}`} {...press}>
      <span className={`price${short ? ' is-short' : ''}`}>{price === 0 ? 'Free' : `$${price}`}</span>
      {children}
    </div>
  )
}

export function Shop() {
  const g = useStore((s) => s.game!)
  const setInspect = useStore((s) => s.setInspect)
  const s = g.shop!
  const vprice = E.priceOf(g, VOUCHER_PRICE)
  return (
    <div className="shop">
      <div className="shop-side">
        <button
          className="btn btn-play"
          onClick={() => {
            sfx('button')
            act(E.nextRound)
          }}
        >
          <span className="btn-label">Next round</span>
        </button>
        <button
          className="btn btn-reroll"
          disabled={g.money < s.rerollCost}
          onClick={() => {
            sfx('button')
            act(E.reroll)
          }}
        >
          <span className="btn-label">Reroll</span>
          <span className="btn-sub">{s.rerollCost === 0 ? 'Free' : `$${s.rerollCost}`}</span>
        </button>
      </div>
      <div className="shop-shelf shop-items">
        {s.items.map((it) => (
          <ShopSlot
            key={it.id}
            price={it.price}
            short={g.money < it.price}
            label={it.kind === 'joker' ? 'Joker' : it.kind === 'cons' ? 'Consumable' : 'Playing card'}
            onTap={(el) => setInspect({ kind: 'shop', id: it.id, rect: rectOf(el) })}
          >
            {it.kind === 'joker' ? <JokerCard joker={it.joker} g={g} /> : it.kind === 'cons' ? <ConsCard cons={it.cons} /> : <PlayingCard card={it.card} />}
          </ShopSlot>
        ))}
        {!s.items.length && <p className="shop-empty">Sold out. Reroll for more.</p>}
      </div>
      <div className="shop-shelf shop-voucher">
        {g.anteVoucher ? (
          <ShopSlot price={vprice} short={g.money < vprice} label="Voucher" onTap={(el) => setInspect({ kind: 'voucher', rect: rectOf(el) })}>
            <div className="card">
              <VoucherArt vkey={g.anteVoucher} name={VOUCHER_MAP[g.anteVoucher].name} />
            </div>
          </ShopSlot>
        ) : (
          <p className="shop-empty">New voucher next ante</p>
        )}
      </div>
      <div className="shop-shelf shop-packs">
        {s.packs.map((p) => (
          <ShopSlot
            key={p.id}
            price={p.price}
            short={g.money < p.price}
            label={PACKS[p.pack].name}
            onTap={(el) => setInspect({ kind: 'packOffer', id: p.id, rect: rectOf(el) })}
          >
            <div className="card card-pack">
              <PackArt pack={p.pack} />
            </div>
          </ShopSlot>
        ))}
        {!s.packs.length && <p className="shop-empty">No packs left</p>}
      </div>
    </div>
  )
}

// ——— Packs ———

function ChoiceSlot({ choice, onTap }: { choice: PackChoice; onTap: (el: HTMLElement) => void }) {
  const g = useStore((s) => s.game!)
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const press = usePress({ onTap: () => el && onTap(el) })
  return (
    <div className="choice" ref={setEl} role="button" tabIndex={0} {...press}>
      {choice.kind === 'joker' ? <JokerCard joker={choice.joker} g={g} /> : choice.kind === 'cons' ? <ConsCard cons={choice.cons} /> : <PlayingCard card={choice.card} />}
    </div>
  )
}

function PackHand() {
  const g = useStore((s) => s.game!)
  const setInspect = useStore((s) => s.setInspect)
  const pk = g.pack!
  const [ref, size] = useSize<HTMLDivElement>()
  const [probe, card] = useSize<HTMLDivElement>()
  const zone = { x: 0, y: 0, w: size.w, h: size.h }
  const fan = fanSlots(pk.hand.length, zone, card.w || 80, card.h || 112)
  return (
    <div className="pack-hand" ref={ref}>
      <div className="card-probe" ref={probe} aria-hidden="true" />
      {pk.hand.map((id, i) => {
        const c = g.cards[id]
        const p = fan.pos[i]
        if (!c || !p) return null
        const sel = pk.selected.includes(id)
        return (
          <PackHandCard
            key={id}
            selected={sel}
            transform={`translate3d(${p.x}px, ${p.y - (sel ? (card.h || 112) * 0.2 : 0)}px, 0) rotate(${p.r}deg)`}
            z={i + 1}
            label={c.id}
            onTap={() => {
              sfx(sel ? 'deselect' : 'select')
              act((d) => E.toggleSelect(d, id))
            }}
            onLong={(el) => setInspect({ kind: 'card', id, rect: rectOf(el) })}
          >
            <PlayingCard card={c} />
          </PackHandCard>
        )
      })}
    </div>
  )
}

function PackHandCard({ selected, transform, z, children, onTap, onLong }: { selected: boolean; transform: string; z: number; label: string; children: ReactNode; onTap: () => void; onLong: (el: HTMLElement) => void }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const press = usePress({ onTap, onLongPress: () => el && onLong(el) })
  return (
    <div ref={setEl} className={`tcard is-live${selected ? ' is-sel' : ''}`} style={{ transform, zIndex: z }} role="button" aria-pressed={selected} tabIndex={0} {...press}>
      {children}
    </div>
  )
}

export function PackStage() {
  const g = useStore((s) => s.game!)
  const setInspect = useStore((s) => s.setInspect)
  const pk = g.pack!
  const def = PACKS[pk.pack]
  const hint =
    def.kind === 'stamp'
      ? 'Select cards from the hand below, then tap a stamp to use it.'
      : def.kind === 'plate'
        ? 'Tap a plate to level up that poker hand.'
        : def.kind === 'joker'
          ? 'Tap a Joker to take it.'
          : 'Tap a card to add it to your deck.'
  return (
    <div className={`packstage pack-${def.kind}`}>
      <header className="pack-head">
        <div>
          <h2>{def.name}</h2>
          <p>
            {pk.picksLeft === 1 ? 'Choose 1.' : `Choose ${pk.picksLeft}.`} {hint}
          </p>
        </div>
        <button
          className="btn btn-small"
          onClick={() => {
            sfx('button')
            act(E.skipPack)
          }}
        >
          Skip
        </button>
      </header>
      <div className="pack-choices">
        {pk.choices.map((c) => (
          <ChoiceSlot key={c.id} choice={c} onTap={(el) => setInspect({ kind: 'choice', id: c.id, rect: rectOf(el) })} />
        ))}
      </div>
      {def.kind === 'stamp' && <PackHand />}
    </div>
  )
}
