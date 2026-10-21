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

function audio(): AudioContext | null {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.32
  master.connect(ctx.destination)
  return ctx
}

/** iOS only allows audio after a touch, so the first touch unlocks it. */
export function unlockAudio() {
  const a = audio()
  if (a && a.state !== 'running') void a.resume()
}

function tone(freq: number, dur: number, type: OscillatorType, vol = 1, at = 0, slide = 0) {
  const a = ctx!
  const t = a.currentTime + at
  const osc = a.createOscillator()
  const gain = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(gain).connect(master!)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function noise(dur: number, vol: number, freq: number, at = 0) {
  const a = ctx!
  const t = a.currentTime + at
  const len = Math.ceil(a.sampleRate * dur)
  const buf = a.createBuffer(1, len, a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = a.createBufferSource()
  src.buffer = buf
  const filter = a.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = 1.2
  const gain = a.createGain()
  gain.gain.value = vol
  src.connect(filter).connect(gain).connect(master!)
  src.start(t)
}

const semi = (n: number) => Math.pow(2, n / 12)

export function sfx(name: Sfx, step = 0) {
  if (!useStore.getState().settings.sound) return
  const a = audio()
  if (!a || a.state !== 'running') return
  switch (name) {
    case 'select':
      noise(0.05, 0.5, 2400)
      tone(660, 0.06, 'triangle', 0.25)
      break
    case 'deselect':
      noise(0.05, 0.4, 1600)
      tone(520, 0.05, 'triangle', 0.18)
      break
    case 'tick':
      tone(880, 0.05, 'square', 0.08)
      break
    case 'button':
      noise(0.04, 0.35, 1200)
      break
    case 'deal':
      noise(0.07, 0.35, 3200)
      break
    case 'chips':
      tone(392 * semi(Math.min(step, 18)), 0.11, 'triangle', 0.45)
      break
    case 'mult':
      tone(220 * semi(Math.min(step, 14) * 0.5), 0.14, 'square', 0.16)
      tone(330 * semi(Math.min(step, 14) * 0.5), 0.12, 'triangle', 0.25, 0.01)
      break
    case 'xmult':
      tone(330, 0.22, 'sawtooth', 0.12, 0, 1.5)
      tone(495, 0.22, 'triangle', 0.3, 0.02, 1.5)
      break
    case 'money':
      tone(1318, 0.09, 'square', 0.12)
      tone(1760, 0.16, 'square', 0.12, 0.07)
      break
    case 'bad':
      tone(180, 0.25, 'sawtooth', 0.14, 0, 0.6)
      break
    case 'total':
      noise(0.35, 0.5, 700)
      tone(196, 0.4, 'triangle', 0.45, 0, 2)
      break
    case 'play':
      noise(0.09, 0.5, 1800)
      break
    case 'discard':
      noise(0.14, 0.5, 900)
      break
    case 'buy':
      tone(988, 0.08, 'square', 0.12)
      tone(1318, 0.12, 'square', 0.12, 0.06)
      break
    case 'win':
      ;[523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.4, i * 0.09))
      break
    case 'lose':
      ;[392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.35, i * 0.14))
      break
  }
}
