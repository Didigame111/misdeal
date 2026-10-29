import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import * as E from './game/engine'
import { unlockedNames } from './game/unlocks'
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
  music: boolean
  /** Difficulty last picked in the New run sheet. */
  difficulty: number
}

export interface Profile {
  runs: number
  wins: number
  bestAnte: number
  bestHand: number
  /** Highest difficulty level unlocked (0 = Normal only). */
  maxDifficulty: number
  /** Highest difficulty won with each deck. */
  deckBest: Record<string, number>
  bossesBeaten: number
  /** Jokers the player has owned at least once, for the Collection. */
  seen: string[]
}

interface Store {
  screen: 'menu' | 'game'
  game: GameState | null
  settings: Settings
  profile: Profile
  /** Things unlocked during the current run, shown on the end screen. */
  runUnlocks: string[]
  modal: Modal
  inspect: Inspect | null
  act: (fn: (g: GameState) => void) => void
  startRun: (deck: string, seed?: string, difficulty?: number) => void
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

const defaultProfile: Profile = { runs: 0, wins: 0, bestAnte: 0, bestHand: 0, maxDifficulty: 0, deckBest: {}, bossesBeaten: 0, seen: [] }

function loadProfile(): Profile {
  const saved = read<Partial<Profile>>(PROFILE_KEY) ?? {}
  const p = { ...defaultProfile, ...saved }
  // Profiles from before difficulty levels: every earlier win was on Normal, which opens Hard.
  if (saved.maxDifficulty === undefined) p.maxDifficulty = p.wins > 0 ? 1 : 0
  return p
}

export const useStore = create<Store>()(
  immer((set) => ({
    screen: 'menu',
    game: loadGame(),
    settings: { speed: 1, sound: true, music: true, difficulty: 0, ...read<Settings>(SETTINGS_KEY) },
    profile: loadProfile(),
    runUnlocks: [],
    modal: null,
    inspect: null,

    act: (fn) =>
      set((s) => {
        if (!s.game) return
        const before = s.game.phase
        const unlockedBefore = unlockedNames(s.profile)
        fn(s.game)
        const g = s.game
        const p = s.profile
        for (const j of g.jokers) if (!p.seen.includes(j.key)) p.seen.push(j.key)
        if (g.ante > p.bestAnte) p.bestAnte = g.ante
        if (before === 'scoring' && (g.phase === 'cashout' || g.phase === 'won') && g.blinds[g.blindIdx]?.kind === 'boss') p.bossesBeaten += 1
        if (g.phase !== before && (g.phase === 'over' || g.phase === 'won')) {
          p.bestHand = Math.max(p.bestHand, g.stats.bestHand)
          if (g.phase === 'won') {
            const level = g.difficulty ?? 0
            p.wins += 1
            p.deckBest[g.deck] = Math.max(p.deckBest[g.deck] ?? -1, level)
            p.maxDifficulty = Math.max(p.maxDifficulty, Math.min(3, level + 1))
          }
        }
        const fresh = unlockedNames(p).filter((n) => !unlockedBefore.includes(n))
        for (const name of fresh) {
          s.runUnlocks.push(name)
          g.notices.push(`Unlocked: ${name}`)
        }
        if (g.phase !== before) s.inspect = null
      }),

    startRun: (deck, seed, difficulty = 0) =>
      set((s) => {
        s.game = E.newGame(deck, seed || undefined, difficulty)
        s.settings.difficulty = difficulty
        s.runUnlocks = []
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

function writeSave() {
  window.clearTimeout(saveTimer)
  saveTimer = 0
  const g = useStore.getState().game
  try {
    if (!g || g.phase === 'over') localStorage.removeItem(SAVE_KEY)
    else localStorage.setItem(SAVE_KEY, JSON.stringify(g))
  } catch {
    // Storage full or unavailable: the run just won't resume.
  }
}

useStore.subscribe((s, prev) => {
  if (s.settings !== prev.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(s.settings))
  if (s.profile !== prev.profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(s.profile))
  if (s.game !== prev.game) {
    // Batch rapid moves into one write, but never lose the last move.
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(writeSave, 250)
  }
})

// iPadOS can freeze or kill a backgrounded web app without warning, so save the moment it leaves the screen.
const flushSave = () => {
  if (saveTimer) writeSave()
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSave()
})
window.addEventListener('pagehide', flushSave)

/** Shorthand for running an engine action. */
export const act = (fn: (g: GameState) => void) => useStore.getState().act(fn)
