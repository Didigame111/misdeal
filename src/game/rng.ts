/** Seeded RNG (mulberry32). The state lives on the game object so runs can be saved and resumed. */
export interface RngHost {
  rng: number
}

export function hashStr(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function rand(g: RngHost): number {
  g.rng = (g.rng + 0x6d2b79f5) >>> 0
  let t = g.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export const randInt = (g: RngHost, n: number) => Math.floor(rand(g) * n)

export function pick<T>(g: RngHost, arr: readonly T[]): T {
  return arr[randInt(g, arr.length)]
}

/** True with probability 1 in `n`. */
export const chance = (g: RngHost, n: number) => rand(g) < 1 / n

export function shuffle<T>(g: RngHost, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(g, i + 1)
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

export function weighted<T>(g: RngHost, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0)
  let roll = rand(g) * total
  for (const [item, w] of items) {
    roll -= w
    if (roll < 0) return item
  }
  return items[items.length - 1][0]
}

const SEED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function makeSeed(): string {
  let s = ''
  for (let i = 0; i < 7; i++) s += SEED_CHARS[Math.floor(Math.random() * SEED_CHARS.length)]
  return s
}

/** Deterministic pseudo-random sequence for visuals (art), independent from game RNG. */
export function artRng(key: string) {
  const host = { rng: hashStr(key) }
  return () => rand(host)
}
