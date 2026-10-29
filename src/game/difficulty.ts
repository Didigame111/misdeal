/**
 * Difficulty levels. Each one keeps everything from the level before and adds one or two rules,
 * so a player only ever has to learn what's new. Numbers are tuned with the balance simulator (sim/).
 */
export interface DifficultyDef {
  name: string
  /** What this level adds on top of the one before, in plain words. */
  adds: string
}

export const DIFFICULTIES: DifficultyDef[] = [
  { name: 'Normal', adds: 'The standard game' },
  { name: 'Hard', adds: 'Blinds need 25% more score' },
  { name: 'Expert', adds: 'Small Blinds pay no reward, and you get 1 fewer discard' },
  { name: 'Master', adds: 'Boss Blinds need even more score, and shop prices are $1 higher' },
]

export interface DifficultyMods {
  targetMult: number
  smallReward: boolean
  discards: number
  bossMult: number
  shopPlus: number
}

export function difficultyMods(level = 0): DifficultyMods {
  return {
    targetMult: level >= 1 ? 1.25 : 1,
    smallReward: level < 2,
    discards: level >= 2 ? -1 : 0,
    bossMult: level >= 3 ? 1.25 : 1,
    shopPlus: level >= 3 ? 1 : 0,
  }
}

/** Rounds a blind target to a tidy number (three significant figures), leaving Normal's targets unchanged. */
export function tidy(n: number): number {
  if (n < 1000) return Math.round(n / 10) * 10
  const p = Math.pow(10, Math.floor(Math.log10(n)) - 2)
  return Math.round(n / p) * p
}
