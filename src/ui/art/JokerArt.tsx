import { memo, useId } from 'react'
import { artRng } from '../../game/rng'
import { Character, charSpec } from './Character'
import { checks, ht, inkName, stripes } from './Defs'
import { INK, RARITY_INK } from './palette'

const MOTIF_INKS = [INK.blue, INK.pink, INK.yellow, INK.teal, INK.orange, INK.purple, INK.green, INK.aqua, INK.sun] as string[]

function Motif({ seed, clip }: { seed: string; clip: string }) {
  const r = artRng(`${seed}:bg`)
  const ink = MOTIF_INKS[Math.floor(r() * MOTIF_INKS.length)]
  const kind = Math.floor(r() * 5)
  const name = inkName(ink)
  const body = (() => {
    switch (kind) {
      case 0:
        return <rect x={0} y={0} width={100} height={140} fill={ht(name)} opacity={0.7} />
      case 1: {
        const rays = Array.from({ length: 14 }, (_, i) => {
          const a0 = (i / 14) * Math.PI * 2
          const a1 = a0 + Math.PI / 14
          const R = 120
          return `M50 64L${50 + Math.cos(a0) * R} ${64 + Math.sin(a0) * R}L${50 + Math.cos(a1) * R} ${64 + Math.sin(a1) * R}Z`
        }).join('')
        return <path d={rays} fill={ink} opacity={0.32} />
      }
      case 2:
        return <rect x={0} y={0} width={100} height={140} fill={stripes(name)} opacity={0.3} />
      case 3:
        return (
          <g fill="none" stroke={ink} strokeWidth={4} opacity={0.35}>
            {[14, 26, 38, 50, 62, 74].map((rad) => (
              <circle key={rad} cx={50} cy={66} r={rad} />
            ))}
          </g>
        )
      default:
        return <rect x={0} y={0} width={100} height={140} fill={checks(name)} opacity={0.22} />
    }
  })()
  return <g clipPath={`url(#${clip})`}>{body}</g>
}

interface Props {
  jkey: string
  rarity: 1 | 2 | 3
}

export const JokerArt = memo(function JokerArt({ jkey, rarity }: Props) {
  const uid = useId().replace(/:/g, '')
  const clip = `jc${uid}`
  const frame = RARITY_INK[rarity]
  const spec = charSpec(jkey)
  return (
    <svg className="card-svg" viewBox="0 0 100 140" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <rect x={7} y={7} width={86} height={126} rx={5} />
        </clipPath>
      </defs>
      <rect x={1} y={1} width={98} height={138} rx={8} fill={INK.paper} />
      <rect x={7} y={7} width={86} height={126} rx={5} fill={INK.paper2} />
      <Motif seed={jkey} clip={clip} />
      <g clipPath={`url(#${clip})`}>
        <Character spec={spec} cx={50} cy={86} r={23.5} />
      </g>
      <rect x={7} y={7} width={86} height={126} rx={5} fill="none" stroke={frame} strokeWidth={2.6} />
      <g fill={frame}>
        {Array.from({ length: rarity }, (_, i) => (
          <path key={i} d={`M${50 + (i - (rarity - 1) / 2) * 9} 3.2l2.8 2.8l-2.8 2.8l-2.8 -2.8z`} />
        ))}
      </g>
      <rect x={1} y={1} width={98} height={138} rx={8} fill="none" stroke="rgba(35,35,63,0.3)" strokeWidth={1.2} />
    </svg>
  )
})
