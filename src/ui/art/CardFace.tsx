import { memo } from 'react'
import { rankLabel } from '../../game/cards'
import type { Card, Rank, Suit } from '../../game/types'
import { Character, charSpec } from './Character'
import { ht, inkName } from './Defs'
import { INK, SUIT_INK, SUIT_SHADOW } from './palette'
import { SuitShape } from './suits'

const PIPS: Record<number, [number, number][]> = {
  2: [[50, 32], [50, 108]],
  3: [[50, 32], [50, 70], [50, 108]],
  4: [[33, 32], [67, 32], [33, 108], [67, 108]],
  5: [[33, 32], [67, 32], [50, 70], [33, 108], [67, 108]],
  6: [[33, 32], [67, 32], [33, 70], [67, 70], [33, 108], [67, 108]],
  7: [[33, 32], [67, 32], [50, 51], [33, 70], [67, 70], [33, 108], [67, 108]],
  8: [[33, 32], [67, 32], [50, 51], [33, 70], [67, 70], [50, 89], [33, 108], [67, 108]],
  9: [[33, 32], [67, 32], [33, 57.3], [67, 57.3], [50, 70], [33, 82.7], [67, 82.7], [33, 108], [67, 108]],
  10: [[33, 32], [67, 32], [50, 44.7], [33, 57.3], [67, 57.3], [33, 82.7], [67, 82.7], [50, 95.3], [33, 108], [67, 108]],
}

const FONT = { fontFamily: "'Dela Gothic One', system-ui, sans-serif" }

function Index({ rank, suit, flip }: { rank: Rank; suit: Suit; flip?: boolean }) {
  const label = rankLabel(rank)
  const size = label.length > 1 ? 17 : 21
  return (
    <g transform={flip ? 'rotate(180 50 70)' : undefined}>
      <text x={12.4} y={26} textAnchor="middle" fontSize={size} fill={SUIT_SHADOW[suit]} style={{ ...FONT, mixBlendMode: 'multiply' }} letterSpacing={label.length > 1 ? -1.5 : 0}>
        {label}
      </text>
      <text x={11.2} y={25} textAnchor="middle" fontSize={size} fill={SUIT_INK[suit]} style={FONT} letterSpacing={label.length > 1 ? -1.5 : 0}>
        {label}
      </text>
      <SuitShape suit={suit} x={11.2} y={36} size={11} fill={SUIT_INK[suit]} />
    </g>
  )
}

function Court({ rank, suit }: { rank: Rank; suit: Suit }) {
  const hat = rank === 13 ? 'crown' : rank === 12 ? 'tiara' : 'cap'
  const spec = charSpec(`court-${suit}-${rank}`, {
    hat,
    hatInk: SUIT_INK[suit],
    hatInk2: SUIT_SHADOW[suit],
    collarInk: SUIT_INK[suit],
    collar: rank === 11 ? 'torso' : 'ruff',
    line: INK.navy,
    eyes: rank === 13 ? 'sleepy' : rank === 12 ? 'happy' : 'dots',
    cheeks: rank !== 13,
  })
  return (
    <g>
      <rect x={22} y={17} width={56} height={106} rx={4} fill={INK.paper2} />
      <rect x={22} y={17} width={56} height={106} rx={4} fill={ht(inkName(SUIT_SHADOW[suit]))} opacity={0.55} />
      <svg x={22} y={17} width={56} height={106} viewBox="18 42 64 121" preserveAspectRatio="xMidYMid slice">
        <Character spec={spec} cx={50} cy={92} r={20} />
      </svg>
      <rect x={22} y={17} width={56} height={106} rx={4} fill="none" stroke={SUIT_INK[suit]} strokeWidth={1.6} />
    </g>
  )
}

function Center({ rank, suit }: { rank: Rank; suit: Suit }) {
  if (rank >= 11 && rank <= 13) return <Court rank={rank} suit={suit} />
  if (rank === 14) {
    return (
      <g>
        <circle cx={50} cy={70} r={30} fill={ht(inkName(SUIT_SHADOW[suit]))} />
        <g transform="translate(2.2 1.6)" style={{ mixBlendMode: 'multiply' }}>
          <SuitShape suit={suit} x={50} y={70} size={44} fill={SUIT_SHADOW[suit]} />
        </g>
        <SuitShape suit={suit} x={50} y={70} size={44} fill={SUIT_INK[suit]} />
      </g>
    )
  }
  const pips = PIPS[rank] ?? []
  const size = rank >= 9 ? 15 : 17
  return (
    <g>
      <g transform="translate(1.4 1.1)" style={{ mixBlendMode: 'multiply' }}>
        {pips.map(([x, y], i) => (
          <SuitShape key={i} suit={suit} x={x} y={y} size={size} fill={SUIT_SHADOW[suit]} flip={y > 71} />
        ))}
      </g>
      {pips.map(([x, y], i) => (
        <SuitShape key={i} suit={suit} x={x} y={y} size={size} fill={SUIT_INK[suit]} flip={y > 71} />
      ))}
    </g>
  )
}

function Paper({ card }: { card: Card }) {
  const base = <rect x={1} y={1} width={98} height={138} rx={8} fill={INK.paper} />
  switch (card.enh) {
    case 'fluoro':
      return (
        <>
          <rect x={1} y={1} width={98} height={138} rx={8} fill="#ffd6ec" />
          <rect x={1} y={1} width={98} height={138} rx={8} fill={ht('pink')} opacity={0.35} />
        </>
      )
    case 'rainbow':
      return (
        <>
          {base}
          <rect x={1} y={1} width={98} height={138} rx={8} fill="url(#rainbow)" opacity={0.4} />
        </>
      )
    case 'tissue':
      return (
        <>
          <rect x={1} y={1} width={98} height={138} rx={8} fill="#fdfcf8" opacity={0.8} />
          <path d="M8 30l14 6l10-4l16 8M60 100l12-6l18 7M10 112l12 5l9-6M70 22l10 6l12-3" stroke="#a9b8c6" strokeWidth={0.9} fill="none" />
        </>
      )
    case 'stock':
      return (
        <>
          <rect x={1} y={1} width={98} height={138} rx={8} fill="#d6d3ca" />
          <rect x={1} y={1} width={98} height={138} rx={8} fill="url(#grain)" />
          <rect x={4.5} y={4.5} width={91} height={131} rx={6} fill="none" stroke="#9c988c" strokeWidth={1.4} />
        </>
      )
    case 'blank':
      return (
        <>
          <rect x={1} y={1} width={98} height={138} rx={8} fill={INK.kraft} />
          <rect x={1} y={1} width={98} height={138} rx={8} fill="url(#fibres)" />
        </>
      )
    case 'gilded':
      return (
        <>
          {base}
          <rect x={3.5} y={3.5} width={93} height={133} rx={7} fill="none" stroke="url(#gold)" strokeWidth={5} />
        </>
      )
    case 'embossed':
      return (
        <>
          {base}
          <rect x={5} y={5} width={90} height={130} rx={6} fill="none" stroke="#fff" strokeWidth={2.6} />
          <rect x={6.4} y={6.4} width={90} height={130} rx={6} fill="none" stroke="#cfc6b0" strokeWidth={1.4} />
        </>
      )
    default:
      return base
  }
}

function EnhMark({ card }: { card: Card }) {
  const tag = (text: string, fill: string, color: string = INK.paper) => (
    <g>
      <rect x={34} y={124} width={32} height={12} rx={6} fill={fill} />
      <text x={50} y={133.2} textAnchor="middle" fontSize={8.6} fill={color} style={FONT}>
        {text}
      </text>
    </g>
  )
  switch (card.enh) {
    case 'embossed':
      return tag('+30', INK.blue)
    case 'fluoro':
      return tag('+4', INK.pink, INK.navy)
    case 'tissue':
      return tag('×2', INK.purple)
    case 'stock':
      return tag('×1.5', '#6f6c64')
    case 'gilded':
      return tag('$3', INK.sun, INK.navy)
    case 'scratch':
      return (
        <g>
          <rect x={28} y={118} width={44} height={16} rx={4} fill="url(#silver)" />
          <text x={50} y={130} textAnchor="middle" fontSize={10} fill="#6d7080" style={FONT}>
            ? ? ?
          </text>
        </g>
      )
    default:
      return null
  }
}

const SEAL_COLOR = { coin: INK.sun, echo: INK.red, plate: INK.blue, stamp: INK.purple } as const
const SEAL_GLYPH = { coin: '$', echo: '2', plate: 'P', stamp: 'S' } as const

function SealMark({ card }: { card: Card }) {
  if (!card.seal) return null
  const fill = SEAL_COLOR[card.seal]
  return (
    <g>
      <circle cx={88} cy={70} r={8.5} fill={fill} />
      <circle cx={88} cy={70} r={6.2} fill="none" stroke={INK.paper} strokeWidth={1} strokeDasharray="1.6 1.4" />
      <text x={88} y={73.6} textAnchor="middle" fontSize={9.5} fill={card.seal === 'coin' ? INK.navy : INK.paper} style={FONT}>
        {SEAL_GLYPH[card.seal]}
      </text>
    </g>
  )
}

interface Props {
  card: Card
  debuffed?: boolean
}

export const CardFace = memo(function CardFace({ card, debuffed }: Props) {
  const blank = card.enh === 'blank'
  return (
    <svg className="card-svg" viewBox="0 0 100 140" aria-hidden="true">
      <Paper card={card} />
      {blank ? (
        <g>
          <rect x={14} y={18} width={72} height={104} rx={6} fill="none" stroke="#8a6a3e" strokeWidth={1.6} strokeDasharray="4 3" />
          <text x={50} y={78} textAnchor="middle" fontSize={22} fill="#6b4e2a" style={FONT}>
            +50
          </text>
        </g>
      ) : (
        <>
          <Center rank={card.rank} suit={card.suit} />
          <Index rank={card.rank} suit={card.suit} />
          <Index rank={card.rank} suit={card.suit} flip />
          {card.enh === 'rainbow' && (
            <g>
              {(['S', 'H', 'C', 'D'] as Suit[]).map((s, i) => (
                <SuitShape key={s} suit={s} x={11.2 + 0} y={46 + i * 9} size={7} fill={SUIT_INK[s]} />
              ))}
            </g>
          )}
        </>
      )}
      <EnhMark card={card} />
      <SealMark card={card} />
      <rect x={1} y={1} width={98} height={138} rx={8} fill="none" stroke="rgba(35,35,63,0.28)" strokeWidth={1.2} />
      {debuffed && (
        <g>
          <rect x={1} y={1} width={98} height={138} rx={8} fill="rgba(35,35,63,0.42)" />
          <path d="M22 34L78 106M78 34L22 106" stroke={INK.red} strokeWidth={7} strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
})
