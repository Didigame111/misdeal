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

/** The only deck open from the start: no bonus at all. */
export const STARTER_DECKS = ['plain']

/**
 * Decks open one at a time as your best ante climbs, weakest bonus first, so every new
 * milestone hands you a better tool for the next run. Ordered by the balance simulator's deck results.
 */
export const DECK_LADDER: { deck: string; ante?: number; win?: true }[] = [
  { deck: 'crimson', ante: 3 },
  { deck: 'inky', ante: 4 },
  { deck: 'pageless', ante: 5 },
  { deck: 'saffron', ante: 6 },
  { deck: 'duotone', ante: 7 },
  { deck: 'mint', ante: 8 },
  { deck: 'cobalt', win: true },
]

const DECK_GOALS: Record<string, { text: string; met: (p: ProgressLike) => boolean }> = Object.fromEntries(
  DECK_LADDER.map(({ deck, ante, win }) => [
    deck,
    win ? { text: 'Win a run', met: (p: ProgressLike) => p.wins >= 1 } : { text: `Reach ante ${ante}`, met: (p: ProgressLike) => p.bestAnte >= ante! },
  ]),
)

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
