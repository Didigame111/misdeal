/**
 * Long-term goals: harder difficulty levels and extra decks open up as you play.
 * Every lock shows exactly what opens it, so there's never anything to look up.
 */
import { DIFFICULTIES } from './difficulty'
import { DECK_MAP } from './meta'

export interface ProgressLike {
  wins: number
  bestAnte: number
  bossesBeaten: number
  /** Highest difficulty level unlocked (0 = Normal only). */
  maxDifficulty: number
}

/** Decks open from the start. */
export const STARTER_DECKS = ['plain', 'crimson', 'cobalt', 'saffron']

const DECK_GOALS: Record<string, { text: string; met: (p: ProgressLike) => boolean }> = {
  duotone: { text: 'Win a run', met: (p) => p.wins >= 1 },
  pageless: { text: 'Reach ante 5', met: (p) => p.bestAnte >= 5 },
  inky: { text: 'Beat 10 Boss Blinds', met: (p) => p.bossesBeaten >= 10 },
  mint: { text: 'Win a run on Hard', met: (p) => p.maxDifficulty >= 2 },
}

export function deckUnlocked(deck: string, p: ProgressLike): boolean {
  return STARTER_DECKS.includes(deck) || !!DECK_GOALS[deck]?.met(p)
}

/** What to do to unlock a deck, or null if it's already open. */
export function deckGoal(deck: string, p: ProgressLike): string | null {
  return deckUnlocked(deck, p) ? null : (DECK_GOALS[deck]?.text ?? null)
}

export function difficultyUnlocked(level: number, p: ProgressLike): boolean {
  return level <= p.maxDifficulty
}

export function difficultyGoal(level: number, p: ProgressLike): string | null {
  return difficultyUnlocked(level, p) ? null : `Win a run on ${DIFFICULTIES[level - 1].name} to unlock`
}

/** Names of everything currently unlocked, for spotting new unlocks. */
export function unlockedNames(p: ProgressLike): string[] {
  const decks = Object.keys(DECK_MAP)
    .filter((d) => deckUnlocked(d, p))
    .map((d) => DECK_MAP[d].name)
  const levels = DIFFICULTIES.filter((_, i) => difficultyUnlocked(i, p)).map((d) => `${d.name} difficulty`)
  return [...levels, ...decks]
}
