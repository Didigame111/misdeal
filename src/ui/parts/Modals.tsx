import { useState, type ReactNode } from 'react'
import { BOSSES, BOSS_MAP, TAG_MAP } from '../../game/blinds'
import { SUIT_ORDER } from '../../game/cards'
import { PLATES, STAMPS } from '../../game/consumables'
import * as E from '../../game/engine'
import { HAND_ORDER, HANDS, handValues } from '../../game/hands'
import { JOKERS, RARITY_NAME } from '../../game/jokers'
import { DECKS, VOUCHER_MAP, VOUCHERS } from '../../game/meta'
import { deckSize } from '../../game/ops'
import type { Card, GameState, Suit } from '../../game/types'
import { useStore } from '../../store'
import { CardBack } from '../art/CardBack'
import { CardFace } from '../art/CardFace'
import { ConsArt, TagArt, VoucherArt } from '../art/ItemArt'
import { JokerArt } from '../art/JokerArt'
import { sfx } from '../audio'
import { fmt } from '../format'
import { RichText } from './RichText'

let sample: GameState | null = null
/** A fresh run, used to fill in live values in collection descriptions. */
const sampleGame = () => (sample ??= E.newGame('plain', 'COLLECTION'))

export function Sheet({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sheet${wide ? ' sheet-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

function RunInfo({ onClose }: { onClose: () => void }) {
  const g = useStore((s) => s.game!)
  const boss = g.blinds[2]?.boss ? BOSS_MAP[g.blinds[2].boss] : null
  return (
    <Sheet title="Run info" onClose={onClose} wide>
      <div className="info-grid">
        <section>
          <h3>Poker hands</h3>
          <table className="hands-table">
            <tbody>
              {[...HAND_ORDER].reverse().map((h) => {
                const lv = g.levels[h]
                if (HANDS[h].secret && lv.played === 0) return null
                const v = handValues(h, lv.level)
                return (
                  <tr key={h}>
                    <th scope="row">{HANDS[h].name}</th>
                    <td className="lv">lvl {lv.level}</td>
                    <td>
                      <span className="chip-ink">{fmt(v.chips)}</span> × <span className="mult-ink">{fmt(v.mult)}</span>
                    </td>
                    <td className="played">played {lv.played}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
        <section>
          <h3>This ante's boss</h3>
          {boss ? (
            <p>
              <b>{boss.name}.</b> <RichText text={boss.text} />
            </p>
          ) : (
            <p>None</p>
          )}
          <h3>Vouchers</h3>
          {g.vouchers.length ? (
            <ul className="plain-list">
              {g.vouchers.map((v) => (
                <li key={v}>
                  <b>{VOUCHER_MAP[v].name}.</b> {VOUCHER_MAP[v].text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="dim">None yet. One is for sale in the shop each ante.</p>
          )}
          {g.tags.length > 0 && (
            <>
              <h3>Tags waiting</h3>
              <ul className="plain-list">
                {g.tags.map((t, i) => (
                  <li key={i}>
                    <b>{TAG_MAP[t].name}.</b> {TAG_MAP[t].text}
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3>Run</h3>
          <p>
            {DECKS.find((d) => d.key === g.deck)?.name}, seed <b className="seed">{g.seed}</b>. Best hand {fmt(g.stats.bestHand)}.
          </p>
        </section>
      </div>
    </Sheet>
  )
}

function Options({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const setModal = useStore((s) => s.setModal)
  const toMenu = useStore((s) => s.toMenu)
  const abandon = useStore((s) => s.abandonRun)
  const inGame = useStore((s) => s.screen === 'game' && !!s.game)
  const [confirm, setConfirm] = useState(false)
  return (
    <Sheet title="Options" onClose={onClose}>
      <div className="opt-row">
        <span>Scoring speed</span>
        <div className="seg" role="group" aria-label="Scoring speed">
          {([1, 2, 4] as const).map((sp) => (
            <button key={sp} aria-pressed={settings.speed === sp} onClick={() => setSettings({ speed: sp })}>
              {sp}×
            </button>
          ))}
        </div>
      </div>
      <div className="opt-row">
        <span>Sound effects</span>
        <div className="seg" role="group" aria-label="Sound effects">
          <button aria-pressed={settings.sound} onClick={() => setSettings({ sound: true })}>
            On
          </button>
          <button aria-pressed={!settings.sound} onClick={() => setSettings({ sound: false })}>
            Off
          </button>
        </div>
      </div>
      <div className="opt-actions">
        <button className="btn btn-small" onClick={() => setModal('howto')}>
          How to play
        </button>
        {inGame && (
          <button className="btn btn-small" onClick={toMenu}>
            Main menu
          </button>
        )}
        {inGame &&
          (confirm ? (
            <button className="btn btn-small tone-sell" onClick={abandon}>
              Yes, end this run
            </button>
          ) : (
            <button className="btn btn-small" onClick={() => setConfirm(true)}>
              Abandon run
            </button>
          ))}
      </div>
      {inGame && <p className="dim small">Your run saves on this device after every move.</p>}
    </Sheet>
  )
}

function DeckView({ onClose }: { onClose: () => void }) {
  const g = useStore((s) => s.game!)
  const r = g.round
  const inDraw = new Set(r?.draw ?? [])
  const cards = Object.values(g.cards)
  const bySuit: Record<Suit, Card[]> = { S: [], H: [], D: [], C: [] }
  const blanks: Card[] = []
  for (const c of cards) {
    if (c.enh === 'blank') blanks.push(c)
    else bySuit[c.suit].push(c)
  }
  for (const s of Object.keys(bySuit) as Suit[]) bySuit[s].sort((a, b) => b.rank - a.rank)
  const suits = (Object.keys(bySuit) as Suit[]).sort((a, b) => SUIT_ORDER[a] - SUIT_ORDER[b])
  return (
    <Sheet title={r ? `Deck: ${r.draw.length} of ${deckSize(g)} left to draw` : `Deck: ${deckSize(g)} cards`} onClose={onClose} wide>
      {r && <p className="dim small">Faded cards are in your hand or already used this round.</p>}
      <div className="deck-grid">
        {[...suits.map((s) => bySuit[s]), blanks].map((row, i) =>
          row.length ? (
            <div className="deck-row" key={i}>
              {row.map((c) => (
                <div key={c.id} className={`deck-card${r && !inDraw.has(c.id) ? ' is-used' : ''}`}>
                  <CardFace card={c} />
                </div>
              ))}
            </div>
          ) : null,
        )}
      </div>
    </Sheet>
  )
}

export function HowTo({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="How to play" onClose={onClose}>
      <div className="howto">
        <p>
          Every round is a <b>blind</b>: reach its target score before you run out of hands. Each ante has a Small Blind, a Big Blind and a Boss Blind
          with a twist. Beat the boss of <b>ante 8</b> to win the run.
        </p>
        <p>
          Tap up to 5 cards and press <b>Play hand</b>. Only the cards that make the poker hand score, and each adds its chips. Your score for the hand
          is <span className="chip-ink">chips</span> × <span className="mult-ink">mult</span>.
        </p>
        <p>
          <b>Discard</b> swaps the selected cards for new ones. You only get a few each round.
        </p>
        <p>
          Win money and spend it in the <b>shop</b>. Jokers give bonuses every hand and work left to right, so their order matters. Plates level up a
          poker hand. Stamps change the cards in your deck. Vouchers last the whole run.
        </p>
        <p>
          You can skip a Small or Big Blind to take its <b>tag</b> instead. Holding money pays interest: $1 for every $5, up to $5 a round.
        </p>
        <h3>Handy moves</h3>
        <ul className="plain-list">
          <li>Press and hold any card to see what it does.</li>
          <li>Drag cards in your hand, and Jokers in their tray, to reorder them.</li>
          <li>Tap the table while a hand scores to skip ahead.</li>
          <li>Add the page to your Home Screen to play full screen and offline.</li>
        </ul>
      </div>
    </Sheet>
  )
}

function Collection({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'jokers' | 'items' | 'bosses'>('jokers')
  return (
    <Sheet title="Collection" onClose={onClose} wide>
      <div className="seg seg-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'jokers'} aria-pressed={tab === 'jokers'} onClick={() => setTab('jokers')}>
          Jokers
        </button>
        <button role="tab" aria-selected={tab === 'items'} aria-pressed={tab === 'items'} onClick={() => setTab('items')}>
          Plates, stamps, vouchers
        </button>
        <button role="tab" aria-selected={tab === 'bosses'} aria-pressed={tab === 'bosses'} onClick={() => setTab('bosses')}>
          Bosses and tags
        </button>
      </div>
      {tab === 'jokers' && (
        <div className="coll-grid">
          {JOKERS.map((j) => (
            <div className="coll-item" key={j.key}>
              <div className="coll-art">
                <JokerArt jkey={j.key} rarity={j.rarity} />
              </div>
              <div>
                <strong>{j.name}</strong>
                <span className="dim small">
                  {RARITY_NAME[j.rarity]}, ${j.cost}
                </span>
                <p>
                  <RichText text={j.text({ id: '', key: j.key, cost: j.cost, extraSell: 0, s: { ...(j.init ?? {}) } }, sampleGame())} />
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === 'items' && (
        <div className="coll-grid">
          {[...PLATES, ...STAMPS].map((c) => (
            <div className="coll-item" key={c.key}>
              <div className="coll-art">
                <ConsArt ckey={c.key} />
              </div>
              <div>
                <strong>{c.name}</strong>
                <span className="dim small">{c.kind === 'plate' ? 'Plate' : 'Stamp'}</span>
                <p>
                  <RichText text={c.text(sampleGame())} />
                </p>
              </div>
            </div>
          ))}
          {VOUCHERS.map((v) => (
            <div className="coll-item" key={v.key}>
              <div className="coll-art">
                <VoucherArt vkey={v.key} name={v.name} />
              </div>
              <div>
                <strong>{v.name}</strong>
                <span className="dim small">Voucher</span>
                <p>{v.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === 'bosses' && (
        <div className="coll-grid coll-list">
          {BOSSES.map((b) => (
            <div className="coll-item" key={b.key}>
              <span className="boss-dot" style={{ background: b.color }} />
              <div>
                <strong>{b.name}</strong>
                <span className="dim small">{b.showdown ? 'Final boss, ante 8' : `From ante ${b.minAnte}`}</span>
                <p>
                  <RichText text={b.text} />
                </p>
              </div>
            </div>
          ))}
          {Object.values(TAG_MAP).map((t) => (
            <div className="coll-item" key={t.key}>
              <span className="coll-tag">
                <TagArt tkey={t.key} />
              </span>
              <div>
                <strong>{t.name}</strong>
                <span className="dim small">Tag</span>
                <p>{t.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}

export function NewRun({ onClose }: { onClose: () => void }) {
  const startRun = useStore((s) => s.startRun)
  const hasRun = useStore((s) => !!s.game && s.game.phase !== 'over')
  const [deck, setDeck] = useState('plain')
  const [seed, setSeed] = useState('')
  return (
    <Sheet title="New run" onClose={onClose} wide>
      <div className="deck-pick" role="radiogroup" aria-label="Deck">
        {DECKS.map((d) => (
          <button key={d.key} role="radio" aria-checked={deck === d.key} className={`deck-option${deck === d.key ? ' is-on' : ''}`} onClick={() => setDeck(d.key)}>
            <span className="deck-option-art">
              <CardBack deck={d.key} />
            </span>
            <strong>{d.name}</strong>
            <span className="small">
              <RichText text={d.text} />
            </span>
          </button>
        ))}
      </div>
      <div className="newrun-foot">
        <label className="seed-field">
          <span>Seed (optional)</span>
          <input
            value={seed}
            onChange={(e) => setSeed(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
            placeholder="Random"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {hasRun && <span className="dim small">Starting a new run ends the current one.</span>}
        <button
          className="btn btn-play"
          onClick={() => {
            sfx('play')
            startRun(deck, seed || undefined)
          }}
        >
          <span className="btn-label">Start run</span>
        </button>
      </div>
    </Sheet>
  )
}

export function Modals() {
  const modal = useStore((s) => s.modal)
  const setModal = useStore((s) => s.setModal)
  const close = () => setModal(null)
  switch (modal) {
    case 'runinfo':
      return <RunInfo onClose={close} />
    case 'options':
      return <Options onClose={close} />
    case 'deck':
      return <DeckView onClose={close} />
    case 'howto':
      return <HowTo onClose={close} />
    case 'collection':
      return <Collection onClose={close} />
    case 'newrun':
      return <NewRun onClose={close} />
    default:
      return null
  }
}

export function EndScreen() {
  const g = useStore((s) => s.game!)
  const setModal = useStore((s) => s.setModal)
  const toMenu = useStore((s) => s.toMenu)
  const act = useStore((s) => s.act)
  const won = g.phase === 'won'
  const r = g.round
  const most = g.stats.mostPlayed
  return (
    <div className="overlay overlay-end">
      <div className={`sheet end-sheet${won ? ' is-won' : ''}`} role="dialog" aria-modal="true" aria-label={won ? 'You won' : 'Run over'}>
        <h2 className="end-title">{won ? 'You won the run' : 'Run over'}</h2>
        <p className="end-sub">
          {won
            ? 'Every boss through ante 8 is beaten. Keep going in endless mode to see how far your deck can go.'
            : r
              ? `${r.handsLeft > 0 ? 'Out of cards' : 'Out of hands'} on ${E.blindName(g.blinds[g.blindIdx])}: ${fmt(r.score)} of ${fmt(r.target)}.`
              : 'Out of cards to play.'}
        </p>
        <dl className="end-stats">
          <div>
            <dt>Best hand</dt>
            <dd>{fmt(g.stats.bestHand)}</dd>
          </div>
          <div>
            <dt>Ante reached</dt>
            <dd>{g.ante}</dd>
          </div>
          <div>
            <dt>Hands played</dt>
            <dd>{g.stats.handsPlayed}</dd>
          </div>
          <div>
            <dt>Most played</dt>
            <dd>{most ? HANDS[most].name : 'None'}</dd>
          </div>
          <div>
            <dt>Rerolls</dt>
            <dd>{g.stats.rerolls}</dd>
          </div>
          <div>
            <dt>Seed</dt>
            <dd className="seed">{g.seed}</dd>
          </div>
        </dl>
        <div className="end-actions">
          {won && (
            <button className="btn btn-play" onClick={() => act(E.continueEndless)}>
              <span className="btn-label">Keep playing</span>
            </button>
          )}
          <button className={`btn ${won ? 'btn-small' : 'btn-play'}`} onClick={() => setModal('newrun')}>
            <span className="btn-label">New run</span>
          </button>
          <button className="btn btn-small" onClick={toMenu}>
            Main menu
          </button>
        </div>
      </div>
    </div>
  )
}
