import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import * as E from './game/engine'
import type { GameState } from './game/types'

export type Modal = null | 'runinfo' | 'options' | 'deck' | 'howto' | 'collection' | 'newrun'

export type InspectTarget =
  | { kind: 'joker'; id: string }
  | { kind: 'cons'; id: string }
  | { kind: 'card'; id: string }
  | { kind: 'shop'; id: string }
  | { kind: 'packOffer'; id: string }
  | { kind: 'voucher' }
  | { kind: 'choice'; id: string }
  | { kind: 'tag'; key: string }

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type Inspect = InspectTarget & { rect: Rect }

export interface Settings {
  speed: 1 | 2 | 4
  sound: boolean
}

export interface Profile {
  runs: number
  wins: number
  bestAnte: number
  bestHand: number
}

interface Store {
  screen: 'menu' | 'game'
  game: GameState | null
  settings: Settings
  profile: Profile
  modal: Modal
  inspect: Inspect | null
  act: (fn: (g: GameState) => void) => void
  startRun: (deck: string, seed?: string) => void
  continueRun: () => void
  toMenu: () => void
  abandonRun: () => void
  setModal: (m: Modal) => void
  setInspect: (i: Inspect | null) => void
  setSettings: (p: Partial<Settings>) => void
}

const SAVE_KEY = 'printrun:save'
const SETTINGS_KEY = 'printrun:settings'
const PROFILE_KEY = 'printrun:profile'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function loadGame(): GameState | null {
  const g = read<GameState>(SAVE_KEY)
  if (!g || g.v !== E.SAVE_VERSION) return null
  // A save taken mid-animation resumes with the hand already scored.
  if (g.phase === 'scoring') E.finishScoring(g)
  if (g.phase === 'over') return null
  g.notices = []
  return g
}

const defaultProfile: Profile = { runs: 0, wins: 0, bestAnte: 0, bestHand: 0 }

export const useStore = create<Store>()(
  immer((set) => ({
    screen: 'menu',
    game: loadGame(),
    settings: { speed: 1, sound: true, ...read<Settings>(SETTINGS_KEY) },
    profile: { ...defaultProfile, ...read<Profile>(PROFILE_KEY) },
    modal: null,
    inspect: null,

    act: (fn) =>
      set((s) => {
        if (!s.game) return
        const before = s.game.phase
        fn(s.game)
        const g = s.game
        if (g.phase !== before && (g.phase === 'over' || g.phase === 'won')) {
          s.profile.bestAnte = Math.max(s.profile.bestAnte, g.ante)
          s.profile.bestHand = Math.max(s.profile.bestHand, g.stats.bestHand)
          if (g.phase === 'won') s.profile.wins += 1
        }
        if (g.phase !== before) s.inspect = null
      }),

    startRun: (deck, seed) =>
      set((s) => {
        s.game = E.newGame(deck, seed || undefined)
        s.profile.runs += 1
        s.screen = 'game'
        s.modal = null
        s.inspect = null
      }),

    continueRun: () =>
      set((s) => {
        if (s.game) s.screen = 'game'
      }),

    toMenu: () =>
      set((s) => {
        s.screen = 'menu'
        s.modal = null
        s.inspect = null
        if (s.game?.phase === 'over') s.game = null
      }),

    abandonRun: () =>
      set((s) => {
        s.game = null
        s.screen = 'menu'
        s.modal = null
        s.inspect = null
      }),

    setModal: (m) =>
      set((s) => {
        s.modal = m
        s.inspect = null
      }),

    setInspect: (i) =>
      set((s) => {
        s.inspect = i
      }),

    setSettings: (p) =>
      set((s) => {
        Object.assign(s.settings, p)
      }),
  })),
)

// ——— Persistence ———

let saveTimer = 0
useStore.subscribe((s, prev) => {
  if (s.settings !== prev.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(s.settings))
  if (s.profile !== prev.profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(s.profile))
  if (s.game !== prev.game) {
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      const g = useStore.getState().game
      try {
        if (!g || g.phase === 'over') localStorage.removeItem(SAVE_KEY)
        else localStorage.setItem(SAVE_KEY, JSON.stringify(g))
      } catch {
        // Storage full or unavailable: the run just won't resume.
      }
    }, 250)
  }
})

/** Shorthand for running an engine action. */
export const act = (fn: (g: GameState) => void) => useStore.getState().act(fn)
