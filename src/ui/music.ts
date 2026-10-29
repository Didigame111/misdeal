/**
 * Generative lo-fi music, synthesized live: soft keys, bass and brushed drums over a slow swing.
 * Nothing is recorded; the chords below are common jazz voicings and the melody is improvised
 * from a seeded random walk, so it never loops exactly.
 */
import { audio } from './audio'

export type MusicMode = 'calm' | 'round' | 'boss'

const BPM = 80
const EIGHTH = 60 / BPM / 2
const SWING = 0.16 // how late the off-beat eighths land, as a fraction of an eighth

// Four bars each. Notes are MIDI numbers; the first is the bass root.
const PROGRESSIONS: Record<MusicMode, number[][]> = {
  calm: [
    [38, 53, 57, 60, 64], // Dm9
    [43, 53, 59, 64], // G13
    [36, 52, 55, 59, 62], // Cmaj9
    [45, 55, 60, 64], // Am7
  ],
  round: [
    [38, 53, 57, 60, 64],
    [43, 53, 59, 64],
    [36, 52, 55, 59, 62],
    [33, 55, 60, 64, 67], // A minor with the 9th up top
  ],
  boss: [
    [33, 55, 60, 64, 71], // Am9
    [29, 52, 57, 59, 64], // Fmaj7#11
    [38, 53, 57, 60, 64], // Dm9
    [40, 50, 56, 62, 65], // E7b9
  ],
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

let bus: GainNode | null = null
let drums: GainNode | null = null
let timer = 0
let nextTime = 0
let step = 0
let mode: MusicMode = 'calm'
let pending: MusicMode | null = null
let walk = 0x2f6e2b1
let melodyNote = 72

function rnd() {
  walk = (walk * 1103515245 + 12345) >>> 0
  return walk / 4294967296
}

function setup() {
  const a = audio()
  if (!a) return null
  if (!bus) {
    bus = a.ctx.createGain()
    bus.gain.value = 0
    const warm = a.ctx.createBiquadFilter()
    warm.type = 'lowpass'
    warm.frequency.value = 3800
    bus.connect(warm).connect(a.master)
    drums = a.ctx.createGain()
    drums.gain.value = 0
    drums.connect(bus)
  }
  return a
}

function voice(freq: number, t: number, dur: number, vol: number, type: OscillatorType, dest: AudioNode, attack = 0.01) {
  const a = audio()!
  const osc = a.ctx.createOscillator()
  const g = a.ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(dest)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

/** Electric-piano-ish: a sine body with a quickly fading bell partial. */
function keys(note: number, t: number, dur: number, vol: number) {
  voice(midi(note), t, dur, vol, 'sine', bus!, 0.012)
  voice(midi(note) * 2.01, t, dur * 0.35, vol * 0.22, 'sine', bus!, 0.004)
}

function hit(t: number, dur: number, vol: number, freq: number, type: BiquadFilterType) {
  const a = audio()!
  const src = a.ctx.createBufferSource()
  src.buffer = a.noise
  const f = a.ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  const g = a.ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(drums!)
  src.start(t, Math.random() * 0.5, dur + 0.05)
}

function kick(t: number, vol: number) {
  const a = audio()!
  const osc = a.ctx.createOscillator()
  const g = a.ctx.createGain()
  osc.frequency.setValueAtTime(110, t)
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.16)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
  osc.connect(g).connect(drums!)
  osc.start(t)
  osc.stop(t + 0.25)
}

function playStep(t: number) {
  const bar = Math.floor(step / 8) % 4
  const beat8 = step % 8
  if (beat8 === 0 && bar === 0 && pending) {
    mode = pending
    pending = null
  }
  const chord = PROGRESSIONS[mode][bar]
  const [root, ...upper] = chord
  const barLen = EIGHTH * 8

  // Chords on the downbeat, with a light strum; a softer push on the "and" of 3.
  if (beat8 === 0) upper.forEach((n, i) => keys(n, t + i * 0.018, barLen * 0.9, 0.05))
  if (beat8 === 5 && rnd() < 0.55) upper.slice(1).forEach((n, i) => keys(n, t + i * 0.012, EIGHTH * 2.6, 0.028))

  // Bass: root on 1, fifth or octave on 3, a passing note sometimes.
  if (beat8 === 0) voice(midi(root), t, EIGHTH * 3.4, 0.2, 'triangle', bus!, 0.02)
  if (beat8 === 4) voice(midi(root + (rnd() < 0.5 ? 7 : 12)), t, EIGHTH * 2.8, 0.15, 'triangle', bus!, 0.02)
  if (beat8 === 7 && mode !== 'calm' && rnd() < 0.4) voice(midi(root + 10), t, EIGHTH * 0.9, 0.11, 'triangle', bus!, 0.01)

  // Melody: a sparse random walk over the chord's own notes, an octave or two up.
  if (mode !== 'calm' || rnd() < 0.5) {
    if ((beat8 === 2 || beat8 === 6 || (mode === 'boss' && beat8 === 3)) && rnd() < 0.42) {
      const pool = upper.flatMap((n) => [n + 12, n + 24]).filter((n) => n >= 64 && n <= 88)
      const near = pool.sort((x, y) => Math.abs(x - melodyNote) - Math.abs(y - melodyNote)).slice(0, 4)
      melodyNote = near[Math.floor(rnd() * near.length)] ?? melodyNote
      keys(melodyNote, t, EIGHTH * 3, 0.04)
    }
  }

  // Brushed drums.
  if (beat8 === 0) kick(t, 0.5)
  if (beat8 === 4) kick(t, 0.32)
  if (beat8 === 2 || beat8 === 6) hit(t, 0.14, 0.2, 2200, 'bandpass')
  hit(t, 0.035, beat8 % 2 ? 0.05 : 0.08, 7500, 'highpass')
}

function schedule() {
  const a = audio()
  if (!a) return
  while (nextTime < a.ctx.currentTime + 0.15) {
    const swingOffset = step % 2 ? EIGHTH * SWING : 0
    playStep(nextTime + swingOffset)
    nextTime += EIGHTH
    step++
  }
}

function fade(node: GainNode | null, value: number, secs = 1.2) {
  const a = audio()
  if (!a || !node) return
  const t = a.ctx.currentTime
  node.gain.cancelScheduledValues(t)
  node.gain.setValueAtTime(node.gain.value, t)
  node.gain.linearRampToValueAtTime(value, t + secs)
}

const LEVEL = 0.5
const DRUMS: Record<MusicMode, number> = { calm: 0, round: 0.8, boss: 1 }

/** Starts the music (after the first touch, since iOS requires one). Safe to call repeatedly. */
export function startMusic() {
  const a = setup()
  if (!a || a.ctx.state !== 'running') return
  if (!timer) {
    nextTime = a.ctx.currentTime + 0.1
    timer = window.setInterval(schedule, 25)
  }
  fade(bus, LEVEL, 2)
  fade(drums, DRUMS[pending ?? mode], 2)
}

export function stopMusic() {
  fade(bus, 0, 0.6)
  window.setTimeout(() => {
    if (bus && bus.gain.value < 0.01 && timer) {
      window.clearInterval(timer)
      timer = 0
    }
  }, 800)
}

/** Switches the feel at the next bar line, so changes land on the beat. */
export function setMusicMode(next: MusicMode) {
  if (next === mode && !pending) return
  pending = next
  fade(drums, DRUMS[next], 3)
}

/** Dips the music while a hand scores, so the scoring sounds read clearly. */
export function duckMusic(on: boolean) {
  if (!timer) return
  fade(bus, on ? LEVEL * 0.45 : LEVEL, on ? 0.25 : 1.2)
}
