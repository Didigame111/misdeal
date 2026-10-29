import { useStore } from '../store'

export type Sfx =
  | 'select'
  | 'deselect'
  | 'tick'
  | 'chips'
  | 'mult'
  | 'xmult'
  | 'money'
  | 'bad'
  | 'total'
  | 'play'
  | 'discard'
  | 'deal'
  | 'buy'
  | 'win'
  | 'lose'
  | 'button'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let sfxBus: GainNode | null = null
let noiseBuf: AudioBuffer | null = null

/** Shared audio graph: sound effects and music each get their own bus into one master. */
export function audio(): { ctx: AudioContext; master: GainNode; noise: AudioBuffer } | null {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.9
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 3
    master.connect(comp).connect(ctx.destination)
    sfxBus = ctx.createGain()
    sfxBus.gain.value = 0.36
    sfxBus.connect(master)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return { ctx, master: master!, noise: noiseBuf! }
}

/** iOS only allows audio after a touch, so every touch makes sure the context is running. */
export function unlockAudio() {
  const a = audio()
  if (a && a.ctx.state !== 'running') void a.ctx.resume()
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

function tone(freq: number, dur: number, type: OscillatorType, vol = 1, at = 0, slide = 0, dest: AudioNode = sfxBus!) {
  const a = ctx!
  const t = a.currentTime + at
  const osc = a.createOscillator()
  const gain = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(gain).connect(dest)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function noise(dur: number, vol: number, freq: number, at = 0, type: BiquadFilterType = 'bandpass', q = 1.2) {
  const a = ctx!
  const t = a.currentTime + at
  const src = a.createBufferSource()
  src.buffer = noiseBuf
  const filter = a.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  filter.Q.value = q
  const gain = a.createGain()
  gain.gain.setValueAtTime(vol, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filter).connect(gain).connect(sfxBus!)
  src.start(t, Math.random() * 0.5, dur + 0.05)
}

/** A struck-wood note (sine body plus a short overtone), used so scoring plays a melody. */
function marimba(note: number, vol: number, at = 0) {
  const f = midi(note)
  tone(f, 0.32, 'sine', vol, at)
  tone(f * 4, 0.06, 'sine', vol * 0.35, at)
}

// C major pentatonic, so any run of chips or mult sounds musical.
const PENTA = [0, 2, 4, 7, 9]
const scaleNote = (base: number, step: number) => base + PENTA[step % 5] + 12 * Math.floor(step / 5)

export function sfx(name: Sfx, step = 0) {
  if (!useStore.getState().settings.sound) return
  const a = audio()
  if (!a || a.ctx.state !== 'running') return
  switch (name) {
    case 'select':
      noise(0.04, 0.5, 4200, 0, 'highpass', 0.7)
      tone(1250, 0.03, 'sine', 0.22)
      break
    case 'deselect':
      noise(0.04, 0.35, 2600, 0, 'highpass', 0.7)
      tone(900, 0.03, 'sine', 0.16)
      break
    case 'tick':
      marimba(84, 0.12)
      break
    case 'button':
      noise(0.03, 0.35, 1800)
      tone(700, 0.04, 'sine', 0.1)
      break
    case 'deal':
      // A short slide, like a card leaving the deck.
      noise(0.09, 0.32, 3000, 0, 'bandpass', 0.8)
      noise(0.06, 0.2, 5200, 0.03, 'highpass', 0.6)
      break
    case 'chips':
      marimba(scaleNote(67, Math.min(step, 14)), 0.5)
      break
    case 'mult':
      tone(midi(scaleNote(72, Math.min(step, 12))), 0.16, 'square', 0.1)
      marimba(scaleNote(72, Math.min(step, 12)), 0.32, 0.005)
      break
    case 'xmult':
      noise(0.25, 0.25, 900, 0, 'bandpass', 0.6)
      ;[60, 64, 67, 72].forEach((n, i) => tone(midi(n), 0.35, 'triangle', 0.18, i * 0.025, 1.12))
      break
    case 'money':
      tone(1976, 0.07, 'square', 0.08)
      tone(2637, 0.22, 'sine', 0.2, 0.06)
      tone(3951, 0.15, 'sine', 0.06, 0.06)
      break
    case 'bad':
      tone(170, 0.28, 'sawtooth', 0.1, 0, 0.6)
      noise(0.2, 0.15, 400)
      break
    case 'total':
      // A rubber stamp coming down: a low thump and a paper slap.
      tone(140, 0.28, 'sine', 0.75, 0, 0.45)
      noise(0.12, 0.6, 1300, 0.005, 'bandpass', 0.8)
      break
    case 'play':
      noise(0.08, 0.45, 2400, 0, 'bandpass', 0.7)
      noise(0.08, 0.35, 2000, 0.05, 'bandpass', 0.7)
      break
    case 'discard':
      for (let i = 0; i < 3; i++) noise(0.07, 0.3, 1800 + i * 500, i * 0.045, 'bandpass', 0.8)
      break
    case 'buy':
      tone(1568, 0.08, 'square', 0.08)
      tone(2093, 0.16, 'square', 0.08, 0.07)
      noise(0.06, 0.3, 5000, 0.07, 'highpass', 0.7)
      break
    case 'win':
      ;[67, 72, 76, 79, 84].forEach((n, i) => marimba(n, 0.42, i * 0.075))
      ;[60, 64, 67].forEach((n) => tone(midi(n), 0.7, 'triangle', 0.14, 0.38))
      break
    case 'lose':
      ;[67, 63, 60, 55].forEach((n, i) => tone(midi(n), 0.34, 'triangle', 0.3, i * 0.15))
      break
  }
}
