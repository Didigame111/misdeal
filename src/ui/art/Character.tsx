import { artRng } from '../../game/rng'
import { INK } from './palette'

export type Head = 'circle' | 'squircle' | 'egg' | 'wide' | 'hex'
export type Hat = 'jester2' | 'jester3' | 'crown' | 'tiara' | 'tophat' | 'cone' | 'beret' | 'cap' | 'quiff'
export type Eyes = 'dots' | 'rings' | 'happy' | 'sleepy' | 'x' | 'star' | 'cyclops' | 'wink' | 'glasses'
export type Mouth = 'smile' | 'grin' | 'o' | 'flat' | 'zigzag' | 'smirk' | 'tongue' | 'teeth'
export type Collar = 'ruff' | 'torso' | 'bow'

export interface CharSpec {
  head: Head
  hat: Hat
  eyes: Eyes
  mouth: Mouth
  collar: Collar
  cheeks: boolean
  face: string
  hatInk: string
  hatInk2: string
  collarInk: string
  line: string
}

const FACES: string[] = [INK.yellow, INK.aqua, INK.sun, '#ff9fd2', '#b8e3a8', INK.paper, '#ffd0a6']
const BRIGHTS: string[] = [INK.blue, INK.pink, INK.teal, INK.orange, INK.purple, INK.green, INK.red, INK.sun]
const LINES: string[] = [INK.navy, INK.federal, INK.burgundy]

const pickFrom = <T,>(r: () => number, arr: readonly T[]) => arr[Math.floor(r() * arr.length)]

export function charSpec(seed: string, over: Partial<CharSpec> = {}): CharSpec {
  const r = artRng(seed)
  const face = pickFrom(r, FACES)
  const hatInk = pickFrom(r, BRIGHTS)
  let hatInk2 = pickFrom(r, BRIGHTS)
  if (hatInk2 === hatInk) hatInk2 = INK.yellow
  let collarInk = pickFrom(r, BRIGHTS)
  if (collarInk === hatInk) collarInk = hatInk2
  return {
    head: pickFrom<Head>(r, ['circle', 'squircle', 'egg', 'wide', 'hex']),
    hat: pickFrom<Hat>(r, ['jester2', 'jester3', 'jester2', 'crown', 'tophat', 'cone', 'beret', 'cap', 'quiff']),
    eyes: pickFrom<Eyes>(r, ['dots', 'rings', 'happy', 'sleepy', 'x', 'star', 'cyclops', 'wink', 'glasses']),
    mouth: pickFrom<Mouth>(r, ['smile', 'grin', 'o', 'flat', 'zigzag', 'smirk', 'tongue', 'teeth']),
    collar: pickFrom<Collar>(r, ['ruff', 'torso', 'bow', 'ruff']),
    cheeks: r() < 0.55,
    face,
    hatInk,
    hatInk2,
    collarInk,
    line: pickFrom(r, LINES),
    ...over,
  }
}

interface Props {
  spec: CharSpec
  cx?: number
  cy?: number
  r?: number
}

/** A two-ink printed character: flat fills slightly out of register under a single line plate. */
export function Character({ spec, cx = 50, cy = 78, r = 21 }: Props) {
  const { head, hat, eyes, mouth, collar, line } = spec
  const rx = head === 'egg' ? r * 0.88 : head === 'wide' ? r * 1.14 : r
  const ry = head === 'egg' ? r * 1.08 : head === 'wide' ? r * 0.9 : r
  const top = cy - ry
  const neck = cy + ry - 3
  const sw = 2.2

  const headShape = (fill: string, stroke?: string) => {
    const p = { fill, stroke, strokeWidth: stroke ? sw : undefined, strokeLinejoin: 'round' as const }
    if (head === 'squircle') return <rect x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} rx={r * 0.48} {...p} />
    if (head === 'hex') {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i + Math.PI / 6
        return `${cx + Math.cos(a) * r * 1.05},${cy + Math.sin(a) * r * 1.05}`
      }).join(' ')
      return <polygon points={pts} {...p} />
    }
    return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...p} />
  }

  const hatParts = (): { fills: React.ReactNode; lines: React.ReactNode } => {
    const L = { fill: 'none', stroke: line, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
    switch (hat) {
      case 'jester2': {
        const left = `M${cx - 18} ${top + 7}C${cx - 25} ${top - 5} ${cx - 33} ${top - 13} ${cx - 36} ${top - 22}C${cx - 24} ${top - 21} ${cx - 10} ${top - 13} ${cx} ${top - 1}Z`
        const right = `M${cx + 18} ${top + 7}C${cx + 25} ${top - 5} ${cx + 33} ${top - 13} ${cx + 36} ${top - 22}C${cx + 24} ${top - 21} ${cx + 10} ${top - 13} ${cx} ${top - 1}Z`
        const band = `M${cx - 21} ${top + 9}Q${cx} ${top - 3} ${cx + 21} ${top + 9}L${cx + 20} ${top + 13}Q${cx} ${top + 2} ${cx - 20} ${top + 13}Z`
        return {
          fills: (
            <>
              <path d={left} fill={spec.hatInk} />
              <path d={right} fill={spec.hatInk2} />
              <path d={band} fill={spec.collarInk} />
              <circle cx={cx - 36} cy={top - 22} r={3.8} fill={INK.yellow} />
              <circle cx={cx + 36} cy={top - 22} r={3.8} fill={INK.yellow} />
            </>
          ),
          lines: (
            <>
              <path d={left} {...L} />
              <path d={right} {...L} />
              <path d={band} {...L} />
              <circle cx={cx - 36} cy={top - 22} r={3.8} {...L} />
              <circle cx={cx + 36} cy={top - 22} r={3.8} {...L} />
            </>
          ),
        }
      }
      case 'jester3': {
        const left = `M${cx - 19} ${top + 8}C${cx - 24} ${top - 3} ${cx - 29} ${top - 11} ${cx - 33} ${top - 19}C${cx - 22} ${top - 17} ${cx - 13} ${top - 9} ${cx - 8} ${top}Z`
        const mid = `M${cx - 9} ${top + 1}C${cx - 7} ${top - 12} ${cx - 3} ${top - 22} ${cx} ${top - 30}C${cx + 3} ${top - 22} ${cx + 7} ${top - 12} ${cx + 9} ${top + 1}Z`
        const right = `M${cx + 19} ${top + 8}C${cx + 24} ${top - 3} ${cx + 29} ${top - 11} ${cx + 33} ${top - 19}C${cx + 22} ${top - 17} ${cx + 13} ${top - 9} ${cx + 8} ${top}Z`
        const tips: [number, number][] = [
          [cx - 33, top - 19],
          [cx, top - 30],
          [cx + 33, top - 19],
        ]
        return {
          fills: (
            <>
              <path d={left} fill={spec.hatInk} />
              <path d={mid} fill={spec.hatInk2} />
              <path d={right} fill={spec.hatInk} />
              {tips.map(([x, y]) => (
                <circle key={x} cx={x} cy={y} r={3.4} fill={INK.yellow} />
              ))}
            </>
          ),
          lines: (
            <>
              <path d={left} {...L} />
              <path d={mid} {...L} />
              <path d={right} {...L} />
              {tips.map(([x, y]) => (
                <circle key={x} cx={x} cy={y} r={3.4} {...L} />
              ))}
            </>
          ),
        }
      }
      case 'crown': {
        const d = `M${cx - 17} ${top + 6}L${cx - 20} ${top - 14}L${cx - 9} ${top - 4}L${cx} ${top - 19}L${cx + 9} ${top - 4}L${cx + 20} ${top - 14}L${cx + 17} ${top + 6}Z`
        return {
          fills: (
            <>
              <path d={d} fill={spec.hatInk === INK.yellow ? INK.sun : INK.yellow} />
              <circle cx={cx} cy={top - 19} r={2.6} fill={spec.hatInk} />
              <circle cx={cx - 20} cy={top - 14} r={2.4} fill={spec.hatInk2} />
              <circle cx={cx + 20} cy={top - 14} r={2.4} fill={spec.hatInk2} />
            </>
          ),
          lines: <path d={d} {...L} />,
        }
      }
      case 'tiara': {
        const d = `M${cx - 15} ${top + 6}Q${cx} ${top - 2} ${cx + 15} ${top + 6}L${cx + 12} ${top + 1}L${cx + 6} ${top - 4}L${cx + 3} ${top}L${cx} ${top - 10}L${cx - 3} ${top}L${cx - 6} ${top - 4}L${cx - 12} ${top + 1}Z`
        return {
          fills: (
            <>
              <path d={d} fill={INK.yellow} />
              <circle cx={cx} cy={top - 5} r={2.2} fill={spec.hatInk} />
            </>
          ),
          lines: <path d={d} {...L} />,
        }
      }
      case 'tophat':
        return {
          fills: (
            <>
              <rect x={cx - 14} y={top - 26} width={28} height={27} rx={2} fill={spec.hatInk} />
              <rect x={cx - 14} y={top - 8} width={28} height={5} fill={spec.hatInk2} />
              <rect x={cx - 24} y={top - 1} width={48} height={6} rx={3} fill={spec.hatInk} />
            </>
          ),
          lines: (
            <>
              <rect x={cx - 14} y={top - 26} width={28} height={25} rx={2} {...L} />
              <rect x={cx - 24} y={top - 1} width={48} height={6} rx={3} {...L} />
            </>
          ),
        }
      case 'cone': {
        const d = `M${cx - 15} ${top + 5}L${cx + 15} ${top + 5}L${cx + 5} ${top - 27}Z`
        return {
          fills: (
            <>
              <path d={d} fill={spec.hatInk} />
              <path d={`M${cx - 9} ${top - 6}L${cx + 11} ${top - 11}`} stroke={spec.hatInk2} strokeWidth={4} />
              <circle cx={cx + 5} cy={top - 29} r={4.2} fill={spec.hatInk2} />
            </>
          ),
          lines: (
            <>
              <path d={d} {...L} />
              <circle cx={cx + 5} cy={top - 29} r={4.2} {...L} />
            </>
          ),
        }
      }
      case 'beret':
        return {
          fills: (
            <>
              <ellipse cx={cx + 3} cy={top + 1} rx={23} ry={8.5} fill={spec.hatInk} />
              <circle cx={cx + 4} cy={top - 8} r={2.4} fill={spec.hatInk} />
            </>
          ),
          lines: (
            <>
              <ellipse cx={cx + 3} cy={top + 1} rx={23} ry={8.5} {...L} />
              <path d={`M${cx + 4} ${top - 7}v-3`} {...L} />
            </>
          ),
        }
      case 'cap': {
        const dome = `M${cx - 19} ${top + 9}C${cx - 19} ${top - 12} ${cx + 19} ${top - 12} ${cx + 19} ${top + 9}Z`
        const brim = `M${cx + 5} ${top + 7}Q${cx + 28} ${top + 3} ${cx + 33} ${top + 10}Q${cx + 18} ${top + 12} ${cx + 5} ${top + 10}Z`
        return {
          fills: (
            <>
              <path d={dome} fill={spec.hatInk} />
              <path d={brim} fill={spec.hatInk2} />
              <circle cx={cx} cy={top - 6} r={2.4} fill={spec.hatInk2} />
            </>
          ),
          lines: (
            <>
              <path d={dome} {...L} />
              <path d={brim} {...L} />
            </>
          ),
        }
      }
      case 'quiff': {
        const d = `M${cx - 9} ${top + 4}C${cx - 14} ${top - 9} ${cx + 1} ${top - 15} ${cx + 4} ${top - 4}C${cx + 8} ${top - 13} ${cx + 18} ${top - 7} ${cx + 11} ${top + 5}Z`
        return { fills: <path d={d} fill={spec.hatInk} />, lines: <path d={d} {...L} /> }
      }
    }
  }

  const ey = cy - 3
  const ex = Math.min(9, rx * 0.42)
  const L = { fill: 'none', stroke: line, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  const eyeAt = (x: number, kind: Eyes) => {
    switch (kind) {
      case 'dots':
        return <circle cx={x} cy={ey} r={2.7} fill={line} />
      case 'rings':
        return (
          <>
            <circle cx={x} cy={ey} r={4.4} fill={INK.paper} stroke={line} strokeWidth={1.8} />
            <circle cx={x + 0.8} cy={ey + 0.5} r={1.9} fill={line} />
          </>
        )
      case 'happy':
        return <path d={`M${x - 4} ${ey + 1.5}Q${x} ${ey - 4} ${x + 4} ${ey + 1.5}`} {...L} />
      case 'sleepy':
        return <path d={`M${x - 4} ${ey - 0.5}Q${x} ${ey + 3.5} ${x + 4} ${ey - 0.5}`} {...L} />
      case 'x':
        return <path d={`M${x - 3} ${ey - 3}l6 6M${x + 3} ${ey - 3}l-6 6`} {...L} />
      case 'star':
        return (
          <path
            d={`M${x} ${ey - 4.5}L${x + 1.4} ${ey - 1.4}L${x + 4.5} ${ey}L${x + 1.4} ${ey + 1.4}L${x} ${ey + 4.5}L${x - 1.4} ${ey + 1.4}L${x - 4.5} ${ey}L${x - 1.4} ${ey - 1.4}Z`}
            fill={line}
          />
        )
      default:
        return null
    }
  }

  const eyeNodes = () => {
    if (eyes === 'cyclops')
      return (
        <>
          <circle cx={cx} cy={ey - 1} r={7} fill={INK.paper} stroke={line} strokeWidth={sw} />
          <circle cx={cx + 1.2} cy={ey} r={3} fill={line} />
        </>
      )
    if (eyes === 'wink')
      return (
        <>
          {eyeAt(cx - ex, 'dots')}
          {eyeAt(cx + ex, 'happy')}
        </>
      )
    if (eyes === 'glasses')
      return (
        <>
          <circle cx={cx - ex} cy={ey} r={5.6} fill={INK.paper} stroke={line} strokeWidth={1.8} />
          <circle cx={cx + ex} cy={ey} r={5.6} fill={INK.paper} stroke={line} strokeWidth={1.8} />
          <path d={`M${cx - ex + 5.6} ${ey}h${2 * ex - 11.2}`} {...L} strokeWidth={1.8} />
          <circle cx={cx - ex + 1} cy={ey + 0.5} r={1.7} fill={line} />
          <circle cx={cx + ex + 1} cy={ey + 0.5} r={1.7} fill={line} />
        </>
      )
    return (
      <>
        {eyeAt(cx - ex, eyes)}
        {eyeAt(cx + ex, eyes)}
      </>
    )
  }

  const my = cy + 8
  const mouthNode = () => {
    switch (mouth) {
      case 'smile':
        return <path d={`M${cx - 8} ${my}Q${cx} ${my + 7} ${cx + 8} ${my}`} {...L} />
      case 'grin':
        return (
          <path
            d={`M${cx - 9} ${my - 1}L${cx + 9} ${my - 1}Q${cx + 9} ${my + 9} ${cx} ${my + 9}Q${cx - 9} ${my + 9} ${cx - 9} ${my - 1}Z`}
            fill={line}
          />
        )
      case 'o':
        return <ellipse cx={cx} cy={my + 2} rx={3.2} ry={4.2} fill={line} />
      case 'flat':
        return <path d={`M${cx - 6} ${my + 2}h12`} {...L} />
      case 'zigzag':
        return <path d={`M${cx - 9} ${my + 2}l3 -3l3 3l3 -3l3 3l3 -3`} {...L} />
      case 'smirk':
        return <path d={`M${cx - 7} ${my + 2}Q${cx + 2} ${my + 5} ${cx + 8} ${my - 2}`} {...L} />
      case 'tongue':
        return (
          <>
            <path d={`M${cx - 2} ${my + 3}q0 6 4 6q4 0 4 -6z`} fill={INK.pink} stroke={line} strokeWidth={1.6} />
            <path d={`M${cx - 8} ${my}Q${cx} ${my + 6} ${cx + 8} ${my}`} {...L} />
          </>
        )
      case 'teeth':
        return (
          <>
            <rect x={cx - 8} y={my - 1} width={16} height={7} rx={2} fill={INK.paper} stroke={line} strokeWidth={1.8} />
            <path d={`M${cx - 8} ${my + 2.5}h16M${cx - 3} ${my - 1}v7M${cx + 3} ${my - 1}v7`} stroke={line} strokeWidth={1.2} />
          </>
        )
    }
  }

  const collarParts = () => {
    if (collar === 'ruff') {
      const pts: string[] = []
      for (let i = 0; i <= 8; i++) pts.push(`${cx - 30 + i * 7.5},${neck + (i % 2 === 0 ? 14 : 5)}`)
      const d = `M${cx - 30} ${neck + 14}Q${cx} ${neck - 6} ${cx + 30} ${neck + 14}L${pts.reverse().join('L')}Z`
      return { fills: <path d={d} fill={spec.collarInk} />, lines: <path d={d} {...L} /> }
    }
    if (collar === 'bow') {
      const d = `M${cx} ${neck + 5}L${cx - 13} ${neck - 2}L${cx - 13} ${neck + 13}ZM${cx} ${neck + 5}L${cx + 13} ${neck - 2}L${cx + 13} ${neck + 13}Z`
      const body = `M${cx - 30} 142C${cx - 30} ${neck + 12} ${cx - 16} ${neck + 4} ${cx} ${neck + 4}C${cx + 16} ${neck + 4} ${cx + 30} ${neck + 12} ${cx + 30} 142Z`
      return {
        fills: (
          <>
            <path d={body} fill={spec.hatInk2} />
            <path d={d} fill={spec.collarInk} />
          </>
        ),
        lines: (
          <>
            <path d={body} {...L} />
            <path d={d} {...L} />
            <circle cx={cx} cy={neck + 5} r={2.6} fill={line} />
          </>
        ),
      }
    }
    const body = `M${cx - 32} 142C${cx - 32} ${neck + 10} ${cx - 18} ${neck + 2} ${cx} ${neck + 2}C${cx + 18} ${neck + 2} ${cx + 32} ${neck + 10} ${cx + 32} 142Z`
    const dia = (x: number) => `M${x} ${neck + 10}l6 9l-6 9l-6 -9z`
    return {
      fills: (
        <>
          <path d={body} fill={spec.collarInk} />
          <path d={dia(cx - 14) + dia(cx + 14)} fill={spec.hatInk2} />
          <path d={dia(cx)} fill={spec.hatInk} />
        </>
      ),
      lines: <path d={body} {...L} />,
    }
  }

  const h = hatParts()
  const c = collarParts()
  return (
    <g>
      <g transform="translate(1.6 1.1)" style={{ mixBlendMode: 'multiply' }}>
        {c.fills}
        {headShape(spec.face)}
        {spec.cheeks && (
          <>
            <circle cx={cx - ex - 5} cy={cy + 5} r={3.8} fill={INK.pink} opacity={0.75} />
            <circle cx={cx + ex + 5} cy={cy + 5} r={3.8} fill={INK.pink} opacity={0.75} />
          </>
        )}
        {h.fills}
      </g>
      <g>
        {c.lines}
        {headShape('none', line)}
        {h.lines}
        {eyeNodes()}
        {mouthNode()}
      </g>
    </g>
  )
}
