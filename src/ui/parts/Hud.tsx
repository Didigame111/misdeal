import { BOSS_MAP } from '../../game/blinds'
import { blindName, WIN_ANTE } from '../../game/engine'
import type { BlindInfo } from '../../game/types'
import { useStore } from '../../store'
import { INK } from '../art/palette'
import { fmt } from '../format'
import { useFx } from '../fx'
import { useCountUp } from '../hooks'

export function blindColor(b: BlindInfo): string {
  if (b.kind === 'small') return INK.blue
  if (b.kind === 'big') return INK.orange
  return BOSS_MAP[b.boss!]?.color ?? INK.red
}

export function BlindChip({ blind, size = 'md' }: { blind: BlindInfo; size?: 'md' | 'lg' }) {
  const letter = blind.kind === 'small' ? 'S' : blind.kind === 'big' ? 'B' : '!'
  return (
    <span className={`blind-chip blind-chip-${size}`} style={{ '--accent': blindColor(blind) } as React.CSSProperties}>
      {letter}
    </span>
  )
}

function Ticket() {
  const g = useStore((s) => s.game!)
  const b = g.blinds[g.blindIdx]
  if (g.phase === 'shop' || g.phase === 'blinds' || g.phase === 'pack' || !b) {
    const inShop = g.phase === 'shop' || (g.phase === 'pack' && g.pack?.returnTo === 'shop')
    const next = inShop ? (g.blindIdx >= 2 ? null : g.blinds[g.blindIdx + 1]) : b
    return (
      <div className="ticket" style={{ '--accent': next ? blindColor(next) : INK.purple } as React.CSSProperties}>
        <div className="ticket-stub">{next ? <BlindChip blind={next} /> : <span className="blind-chip">+</span>}</div>
        <div className="ticket-body">
          <div className="ticket-name">{inShop ? 'Shop' : 'Choose a blind'}</div>
          <div className="ticket-goal">
            {inShop ? (next ? `Next up: ${blindName(next)}` : `Next up: ante ${g.ante + 1}`) : `${blindName(b)} is up next`}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="ticket" style={{ '--accent': blindColor(b) } as React.CSSProperties}>
      <div className="ticket-stub">
        <BlindChip blind={b} />
      </div>
      <div className="ticket-body">
        <div className="ticket-name">{blindName(b)}</div>
        <div className="ticket-goal">
          Score at least <b>{fmt(b.target)}</b>
        </div>
      </div>
      <div className="ticket-reward">+${b.reward}</div>
    </div>
  )
}

export function Hud() {
  const g = useStore((s) => s.game!)
  const setModal = useStore((s) => s.setModal)
  const hidden = useFx((s) => s.hiddenMoney)
  const score = useCountUp(g.round?.score ?? 0)
  const showScore = !!g.round
  return (
    <header className="hud">
      <Ticket />
      {showScore && (
        <div className="hud-box hud-score">
          <span className="hud-label">Score</span>
          <span className="hud-num">{fmt(score)}</span>
        </div>
      )}
      <div className="hud-box hud-money" aria-label={`Money: $${g.money - hidden}`}>
        <span className="hud-num">${g.money - hidden}</span>
      </div>
      <div className="hud-box hud-ante">
        <span className="hud-label">Ante</span>
        <span className="hud-num">
          {g.ante}
          <small>/{WIN_ANTE}</small>
        </span>
      </div>
      <div className="hud-actions">
        <button className="hud-btn" onClick={() => setModal('runinfo')}>
          Run info
        </button>
        <button className="hud-btn" onClick={() => setModal('options')} aria-label="Options">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  )
}
