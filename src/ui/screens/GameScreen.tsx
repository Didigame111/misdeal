import { useEffect } from 'react'
import * as E from '../../game/engine'
import { act, useStore } from '../../store'
import { sfx } from '../audio'
import { useFx, useScorePlayback } from '../fx'
import { Hud } from '../parts/Hud'
import { Inspector } from '../parts/Inspector'
import { EndScreen, Modals } from '../parts/Modals'
import { BlindSelect, CashOut, PackStage, Shop } from '../parts/Phases'
import { RoundStage } from '../parts/RoundStage'
import { Toasts } from '../parts/Toasts'
import { Trays } from '../parts/Trays'

/** Keeps the iPad from dimming mid-run. Safari drops the lock when the app is hidden, so take it again on return. */
function useWakeLock() {
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }
    if (!nav.wakeLock) return
    let lock: { release: () => Promise<void> } | null = null
    let alive = true
    const take = () => {
      if (document.visibilityState !== 'visible') return
      nav.wakeLock!
        .request('screen')
        .then((l) => {
          if (alive) lock = l
          else void l.release()
        })
        .catch(() => {
          // Low power mode or no permission: the screen just dims as usual.
        })
    }
    take()
    document.addEventListener('visibilitychange', take)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', take)
      void lock?.release()
    }
  }, [])
}

/** Shortcuts for an iPad keyboard: Return plays, Delete discards, 1–9 and 0 pick cards, R and S sort. */
function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState()
      const g = s.game
      if (!g || e.defaultPrevented || s.modal || s.inspect || e.metaKey || e.ctrlKey || e.altKey) return
      // Keys aimed at a focused button belong to that button.
      if ((e.target as HTMLElement)?.closest('button, [role="button"]') && (e.key === 'Enter' || e.key === ' ')) return
      if ((e.target as HTMLElement)?.closest('input, textarea')) return
      if (g.phase === 'scoring' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        useFx.getState().set({ skip: true })
        return
      }
      if (g.phase !== 'round' || !g.round) return
      const r = g.round
      if (e.key === 'Enter' && r.selected.length) {
        e.preventDefault()
        sfx('play')
        act(E.playHand)
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && r.selected.length && r.discardsLeft > 0) {
        e.preventDefault()
        sfx('discard')
        act(E.discard)
      } else if (/^[0-9]$/.test(e.key)) {
        const idx = e.key === '0' ? 9 : Number(e.key) - 1
        const id = r.hand[idx]
        if (!id || (!r.selected.includes(id) && r.selected.length >= 5)) return
        sfx(r.selected.includes(id) ? 'deselect' : 'select')
        act((d) => E.toggleSelect(d, id))
      } else if (e.key === 'r' || e.key === 's') {
        act((d) => E.setSort(d, e.key === 'r' ? 'rank' : 'suit'))
      } else if (e.key === 'Escape') {
        act(E.clearSelection)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export function GameScreen() {
  useScorePlayback()
  useWakeLock()
  useKeyboard()
  const phase = useStore((s) => s.game!.phase)
  const hasRound = useStore((s) => !!s.game!.round)
  return (
    <div className="game mat" data-phase={phase}>
      <Hud />
      <Trays />
      <main className="stage">
        {phase === 'blinds' && <BlindSelect />}
        {(phase === 'round' || phase === 'scoring' || (phase === 'over' && hasRound)) && <RoundStage />}
        {(phase === 'cashout' || phase === 'won') && <CashOut />}
        {phase === 'shop' && <Shop />}
        {phase === 'pack' && <PackStage />}
      </main>
      {(phase === 'over' || phase === 'won') && <EndScreen />}
      <Toasts />
      <Inspector />
      <Modals />
    </div>
  )
}
