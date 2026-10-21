import { useEffect } from 'react'
import { create } from 'zustand'
import * as E from '../game/engine'
import { HANDS } from '../game/hands'
import type { ScoreEvent } from '../game/types'
import { act, useStore } from '../store'
import { sfx } from './audio'

export interface ActiveFx extends ScoreEvent {
  key: number
}

interface FxState {
  /** The event currently being shown on a card or joker. */
  active: ActiveFx | null
  /** Values in the chips × mult panel while a hand is scoring. */
  panel: { chips: number; mult: number; name: string; level: number; bad?: string } | null
  total: number | null
  /** Money already added to the game but not yet "paid out" on screen. */
  hiddenMoney: number
  scoringIds: string[]
  skip: boolean
  set: (p: Partial<FxState>) => void
  reset: () => void
}

const idle = { active: null, panel: null, total: null, hiddenMoney: 0, scoringIds: [], skip: false }

export const useFx = create<FxState>()((set) => ({
  ...idle,
  set: (p) => set(p),
  reset: () => set(idle),
}))

function delayFor(ev: ScoreEvent, i: number): number {
  let d = 320
  if (ev.t === 'base') d = 380
  else if (ev.t === 'joker') d = 400
  else if (ev.tone === 'xmult') d = 440
  else if (ev.label === 'Again!') d = 260
  return d * Math.max(0.5, 1 - i * 0.018)
}

/** Plays the scoring timeline for the hand on the table, then commits it. */
export function useScorePlayback() {
  const phase = useStore((s) => s.game?.phase)
  const score = useStore((s) => s.game?.score)

  useEffect(() => {
    if (phase !== 'scoring' || !score) return
    const fx = useFx.getState()
    const speed = () => useStore.getState().settings.speed
    let hidden = score.events.reduce((s, e) => s + (e.money ?? 0), 0)
    const name = HANDS[score.hand].name
    let i = 0
    let chipsSteps = 0
    let timer = 0
    let done = false
    fx.set({
      active: null,
      total: null,
      skip: false,
      hiddenMoney: hidden,
      scoringIds: score.scoringIds,
      panel: { chips: score.events[0]?.chips ?? 0, mult: score.events[0]?.mult ?? 0, name, level: score.level },
    })

    const finish = () => {
      if (done) return
      done = true
      act(E.finishScoring)
      useFx.getState().reset()
    }

    const showTotal = () => {
      useFx.getState().set({
        active: null,
        panel: { chips: score.chips, mult: score.mult, name, level: score.level, bad: score.blocked },
        total: score.total,
        hiddenMoney: 0,
      })
      if (!score.blocked) sfx('total')
      timer = window.setTimeout(finish, (useFx.getState().skip ? 450 : 1100) / speed())
    }

    const step = () => {
      const st = useFx.getState()
      if (st.skip || i >= score.events.length) {
        showTotal()
        return
      }
      const ev = score.events[i++]
      if (ev.money) hidden -= ev.money
      const bad = ev.tone === 'bad' && !ev.target ? ev.label : undefined
      st.set({
        active: { ...ev, key: i },
        panel: { chips: ev.chips, mult: ev.mult, name, level: score.level, bad },
        hiddenMoney: hidden,
      })
      if (ev.tone === 'chips') sfx('chips', chipsSteps++)
      else if (ev.tone === 'mult') sfx('mult', i)
      else if (ev.tone === 'xmult') sfx('xmult')
      else if (ev.tone === 'money') sfx('money')
      else if (ev.tone === 'bad') sfx('bad')
      else if (ev.t !== 'base') sfx('tick')
      timer = window.setTimeout(step, delayFor(ev, i) / speed())
    }

    timer = window.setTimeout(step, 260 / speed())
    return () => {
      window.clearTimeout(timer)
    }
  }, [phase, score])
}
