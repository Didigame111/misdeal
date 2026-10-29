/**
 * Balance simulator. Build and run with `npm run sim -- <experiment> [runs]`.
 *   base    N runs on the Plain Deck: win rate, where runs end
 *   jokers  N paired runs per Joker: start with it vs without, same seeds
 *   decks   N runs per deck
 *   diff    N runs per difficulty level
 */
import { availableParallelism } from 'node:os'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads'
import { DIFFICULTIES } from '../src/game/difficulty'
import { JOKERS } from '../src/game/jokers'
import { DECKS } from '../src/game/meta'
import { existsSync, readFileSync } from 'node:fs'
import { playRun, setJokerValues, type RunOptions, type RunResult } from './bot'

// Buy Jokers by their measured value once a `jokers` experiment has been run.
if (existsSync('sim/out/joker-values.json')) setJokerValues(JSON.parse(readFileSync('sim/out/joker-values.json', 'utf8')))

interface Task extends RunOptions {
  group: string
}

if (!isMainThread) {
  const tasks = workerData as Task[]
  const out = tasks.map((t) => ({ group: t.group, seed: t.seed, ...playRun(t) }))
  parentPort!.postMessage(out)
} else {
  const [experiment = 'base', nArg = '400'] = process.argv.slice(2)
  const n = Number(nArg)
  const seeds = Array.from({ length: n }, (_, i) => `SIM${i}`)
  const tasks: Task[] = []
  if (experiment === 'base') for (const seed of seeds) tasks.push({ group: 'base', seed })
  if (experiment === 'jokers') {
    for (const seed of seeds) tasks.push({ group: 'none', seed })
    for (const j of JOKERS) for (const seed of seeds) tasks.push({ group: j.key, seed, startJoker: j.key })
  }
  if (experiment === 'decks') for (const d of DECKS) for (const seed of seeds) tasks.push({ group: d.key, seed, deck: d.key })
  if (experiment === 'diff') DIFFICULTIES.forEach((d, i) => seeds.forEach((seed) => tasks.push({ group: d.name, seed, difficulty: i })))

  const workers = Math.max(1, Math.min(8, availableParallelism() - 4))
  const chunks: Task[][] = Array.from({ length: workers }, () => [])
  tasks.forEach((t, i) => chunks[i % workers].push(t))
  const t0 = Date.now()
  const file = fileURLToPath(import.meta.url)
  const parts = await Promise.all(
    chunks.map(
      (chunk) =>
        new Promise<(RunResult & { group: string; seed: string })[]>((resolve, reject) => {
          const w = new Worker(file, { workerData: chunk })
          w.once('message', resolve)
          w.once('error', reject)
        }),
    ),
  )
  const results = parts.flat()
  const secs = ((Date.now() - t0) / 1000).toFixed(1)

  const groups = new Map<string, typeof results>()
  for (const r of results) groups.set(r.group, [...(groups.get(r.group) ?? []), r])
  const summarize = (rs: typeof results) => {
    const wins = rs.filter((r) => r.won).length
    const ante = rs.reduce((s, r) => s + (r.won ? 9 : r.ante), 0) / rs.length
    return { runs: rs.length, winRate: wins / rs.length, avgAnte: ante }
  }
  const summary = Object.fromEntries([...groups].map(([k, rs]) => [k, summarize(rs)]))
  const deaths: Record<string, number> = {}
  const reached: Record<string, number> = {}
  for (const r of results) {
    if (r.diedAt) deaths[r.diedAt] = (deaths[r.diedAt] ?? 0) + 1
    for (const b of r.bosses) reached[b] = (reached[b] ?? 0) + 1
  }
  if (experiment === 'jokers') {
    // Paired by seed: antes gained by starting with each Joker, versus starting with none.
    const none = new Map(groups.get('none')!.map((r) => [r.seed, r.won ? 9 : r.ante]))
    const values: Record<string, number> = {}
    for (const [k, rs] of groups) {
      if (k === 'none') continue
      values[k] = rs.reduce((s, r) => s + (r.won ? 9 : r.ante) - (none.get(r.seed) ?? 0), 0) / rs.length
    }
    writeFileSync('sim/out/joker-values.json', JSON.stringify(values, null, 1))
  }
  writeFileSync(`sim/out/${experiment}.json`, JSON.stringify({ experiment, n, secs, summary, deaths, reached, results }, null, 1))
  console.log(`${experiment}: ${results.length} runs in ${secs}s on ${workers} workers`)
  const rows = Object.entries(summary).sort((a, b) => b[1].avgAnte - a[1].avgAnte)
  for (const [k, s] of rows) console.log(`${k.padEnd(16)} win ${(s.winRate * 100).toFixed(1).padStart(5)}%  avg ante ${s.avgAnte.toFixed(2)}`)
  const lethal = Object.entries(reached)
    .map(([k, v]) => [k, (deaths[k] ?? 0) / v, v] as const)
    .sort((a, b) => b[1] - a[1])
  console.log('boss kill rate when reached:', lethal.map(([k, p, v]) => `${k} ${(p * 100).toFixed(0)}% (${v})`).join(', '))
  console.log('runs ended at:', Object.entries(deaths).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '))
}
