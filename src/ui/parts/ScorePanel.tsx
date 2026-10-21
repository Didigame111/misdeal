import { memo } from 'react'
import { selectedInOrder } from '../../game/engine'
import { HANDS } from '../../game/hands'
import { previewHand } from '../../game/scoring'
import { useStore } from '../../store'
import { fmt, fmtMult } from '../format'
import { useFx } from '../fx'

/** Hand name and the chips × mult blocks. At the end of a hand the two blocks overprint into the total. */
export const ScorePanel = memo(function ScorePanel() {
  const g = useStore((s) => s.game!)
  const panel = useFx((s) => s.panel)
  const total = useFx((s) => s.total)

  let name: string | null = null
  let level = 0
  let chips = 0
  let mult = 0
  let bad: string | undefined
  if (panel) {
    ;({ name, level, chips, mult, bad } = panel)
  } else if (g.phase === 'round') {
    const p = previewHand(g, selectedInOrder(g))
    if (p) {
      name = HANDS[p.type].name
      level = p.level
      chips = p.chips
      mult = p.mult
    }
  }

  const r = g.round
  const beaten = total != null && !bad && !!r && r.score + total >= r.target

  return (
    <div className={`score-panel${total != null && !bad ? ' is-total' : ''}${bad ? ' is-bad' : ''}${beaten ? ' is-beaten' : ''}`}>
      {beaten && (
        <span className="cm-stamp" aria-live="polite">
          Blind beaten
        </span>
      )}
      <div className="hand-name" aria-live="polite">
        {bad ? (
          <span className="hand-bad">{bad}</span>
        ) : name ? (
          <>
            <span>{name}</span>
            <span className="hand-level">lvl {level}</span>
          </>
        ) : (
          <span className="hand-hint">Tap up to 5 cards</span>
        )}
      </div>
      <div className="cm">
        <div className="cm-block cm-chips">
          <span key={chips} className="cm-num">
            {fmt(chips)}
          </span>
        </div>
        <span className="cm-x" aria-hidden="true">
          ×
        </span>
        <div className="cm-block cm-mult">
          <span key={mult} className="cm-num">
            {fmtMult(mult)}
          </span>
        </div>
        {total != null && !bad && (
          <div className="cm-total" key={total}>
            {fmt(total)}
          </div>
        )}
      </div>
    </div>
  )
})
