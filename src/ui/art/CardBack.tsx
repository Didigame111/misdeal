import { memo } from 'react'
import { DECK_MAP } from '../../game/meta'
import type { Suit } from '../../game/types'
import { INK } from './palette'
import { SuitShape } from './suits'

export const CardBack = memo(function CardBack({ deck = 'plain' }: { deck?: string }) {
  const [a, b] = DECK_MAP[deck]?.inks ?? DECK_MAP.plain.inks
  const id = `back-${deck}`
  return (
    <svg className="card-svg" viewBox="0 0 100 140" aria-hidden="true">
      <defs>
        <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="14" height="14" fill={a} />
          <circle cx="7" cy="7" r="3.2" fill={b} />
        </pattern>
      </defs>
      <rect x={1} y={1} width={98} height={138} rx={8} fill={INK.paper} />
      <rect x={6} y={6} width={88} height={128} rx={5} fill={`url(#${id})`} />
      <rect x={6} y={6} width={88} height={128} rx={5} fill="none" stroke={INK.paper} strokeWidth={1.5} />
      <ellipse cx={50} cy={70} rx={25} ry={31} fill={INK.paper} />
      <ellipse cx={50} cy={70} rx={21} ry={27} fill="none" stroke={a} strokeWidth={1.6} />
      {(['S', 'H', 'C', 'D'] as Suit[]).map((s, i) => (
        <SuitShape key={s} suit={s} x={50 + (i % 2 ? 7.5 : -7.5)} y={70 + (i < 2 ? -7.5 : 7.5)} size={12} fill={i % 2 ? b : a} />
      ))}
      <rect x={1} y={1} width={98} height={138} rx={8} fill="none" stroke="rgba(35,35,63,0.3)" strokeWidth={1.2} />
    </svg>
  )
})
