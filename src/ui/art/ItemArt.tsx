import { memo, useId } from 'react'
import { consDef } from '../../game/consumables'
import { HAND_ORDER } from '../../game/hands'
import { PACKS } from '../../game/meta'
import type { HandType, PackKey, Suit } from '../../game/types'
import { ht, inkName } from './Defs'
import { INK, SUIT_INK } from './palette'
import { SuitShape } from './suits'

const FONT = { fontFamily: "'Dela Gothic One', system-ui, sans-serif" }

function NameBand({ name, fill, color = INK.paper }: { name: string; fill: string; color?: string }) {
  const long = name.length > 9
  return (
    <g>
      <rect x={7} y={112} width={86} height={21} rx={4} fill={fill} />
      <text
        x={50}
        y={126.5}
        textAnchor="middle"
        fontSize={long ? 9 : 10.5}
        fill={color}
        style={FONT}
        textLength={long ? Math.min(80, name.length * 6.6) : undefined}
        lengthAdjust="spacingAndGlyphs"
      >
        {name}
      </text>
    </g>
  )
}

const Frame = ({ children }: { children: React.ReactNode }) => (
  <svg className="card-svg" viewBox="0 0 100 140" aria-hidden="true">
    <rect x={1} y={1} width={98} height={138} rx={8} fill={INK.paper} />
    {children}
    <rect x={1} y={1} width={98} height={138} rx={8} fill="none" stroke="rgba(35,35,63,0.3)" strokeWidth={1.2} />
  </svg>
)

// ——— Plates ———

const TIER = [INK.aqua, INK.aqua, INK.aqua, INK.sun, INK.sun, INK.sun, INK.pink, INK.pink, INK.pink, INK.purple, INK.purple, INK.purple]

function miniCards(hand: HandType): { x: number; y: number; ink: string }[] {
  const groups: Record<HandType, number[]> = {
    high: [1],
    pair: [2],
    twopair: [2, 2],
    three: [3],
    straight: [5],
    flush: [5],
    full: [3, 2],
    four: [4],
    sflush: [5],
    five: [5],
    fhouse: [3, 2],
    ffive: [5],
  }
  const flushy = ['flush', 'sflush', 'fhouse', 'ffive'].includes(hand)
  const stepped = hand === 'straight' || hand === 'sflush'
  const sizes = groups[hand]
  const step = 9
  const gap = 8
  const width = sizes.reduce((s, n) => s + (n - 1) * step + 14, 0) + gap * (sizes.length - 1)
  let x = 50 - width / 2
  const out: { x: number; y: number; ink: string }[] = []
  const inks = [INK.federal, INK.red, '#00835c', '#e8641c', INK.federal]
  let k = 0
  sizes.forEach((n) => {
    for (let i = 0; i < n; i++) {
      out.push({ x: x + i * step, y: stepped ? 70 - k * 5 : 56, ink: flushy ? INK.red : inks[k % inks.length] })
      k++
    }
    x += (n - 1) * step + 14 + gap
  })
  return out
}

function PlateArt({ hand, name }: { hand: HandType; name: string }) {
  const tier = TIER[HAND_ORDER.indexOf(hand)]
  return (
    <Frame>
      <rect x={10} y={10} width={80} height={96} rx={6} fill="#cfd9df" />
      <rect x={10} y={10} width={80} height={96} rx={6} fill={ht(inkName(tier))} opacity={0.55} />
      <rect x={10} y={10} width={80} height={96} rx={6} fill="none" stroke="#7f8f9b" strokeWidth={1.6} />
      <circle cx={20} cy={20} r={3.2} fill={INK.paper} stroke="#7f8f9b" />
      <circle cx={80} cy={20} r={3.2} fill={INK.paper} stroke="#7f8f9b" />
      {miniCards(hand).map((c, i) => (
        <g key={i}>
          <rect x={c.x + 1.2} y={c.y + 1} width={14} height={20} rx={2} fill={tier} style={{ mixBlendMode: 'multiply' }} />
          <rect x={c.x} y={c.y} width={14} height={20} rx={2} fill={INK.paper} stroke={INK.navy} strokeWidth={1.2} />
          <rect x={c.x + 3} y={c.y + 3} width={3} height={4} fill={c.ink} />
        </g>
      ))}
      <NameBand name={name} fill={INK.navy} />
    </Frame>
  )
}

// ——— Stamps ———

type Glyph = { text: string } | { suit: Suit } | { shape: 'rainbow' | 'crinkle' | 'blank' | 'cut' | 'copy' | 'seal' | 'spin' | 'up' }

const STAMP_LOOK: Record<string, { ink: string; glyph: Glyph }> = {
  emboss: { ink: INK.blue, glyph: { text: '+30' } },
  fluoroink: { ink: INK.pink, glyph: { text: '+4' } },
  rainbowroll: { ink: INK.purple, glyph: { shape: 'rainbow' } },
  tissuepaper: { ink: INK.aqua, glyph: { shape: 'crinkle' } },
  cardstock: { ink: '#6f6c64', glyph: { text: '×1.5' } },
  blankout: { ink: '#8a6a3e', glyph: { shape: 'blank' } },
  goldleaf: { ink: INK.sun, glyph: { text: '$3' } },
  scratchcard: { ink: '#7d8190', glyph: { text: '?' } },
  redink: { ink: SUIT_INK.H, glyph: { suit: 'H' } },
  orangeink: { ink: SUIT_INK.D, glyph: { suit: 'D' } },
  blueink: { ink: SUIT_INK.S, glyph: { suit: 'S' } },
  greenink: { ink: SUIT_INK.C, glyph: { suit: 'C' } },
  bump: { ink: INK.teal, glyph: { shape: 'up' } },
  shred: { ink: INK.red, glyph: { shape: 'cut' } },
  duplicate: { ink: INK.blue, glyph: { shape: 'copy' } },
  waxseal: { ink: INK.burgundy, glyph: { shape: 'seal' } },
  pettycash: { ink: '#00835c', glyph: { text: '$×2' } },
  appraisal: { ink: INK.sun, glyph: { text: '$$' } },
  reprint: { ink: INK.purple, glyph: { text: 'R' } },
  commission: { ink: INK.teal, glyph: { text: 'P+' } },
  luckyspin: { ink: INK.pink, glyph: { shape: 'spin' } },
  hire: { ink: INK.orange, glyph: { text: 'J+' } },
}

function GlyphMark({ glyph, ink }: { glyph: Glyph; ink: string }) {
  const cx = 50
  const cy = 58
  if ('suit' in glyph) return <SuitShape suit={glyph.suit} x={cx} y={cy} size={26} fill={ink} />
  if ('text' in glyph) {
    const size = glyph.text.length >= 3 ? 15 : glyph.text.length === 2 ? 19 : 24
    return (
      <text x={cx} y={cy + size * 0.36} textAnchor="middle" fontSize={size} fill={ink} style={FONT}>
        {glyph.text}
      </text>
    )
  }
  const L = { fill: 'none', stroke: ink, strokeWidth: 3.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (glyph.shape) {
    case 'rainbow':
      return (
        <g fill="none" strokeWidth={3.4} strokeLinecap="round">
          <path d="M36 66a14 14 0 0 1 28 0" stroke={INK.pink} />
          <path d="M40.5 66a9.5 9.5 0 0 1 19 0" stroke={INK.sun} />
          <path d="M45 66a5 5 0 0 1 10 0" stroke={INK.aqua} />
        </g>
      )
    case 'crinkle':
      return <path d="M36 50l6 6l6-6l6 6l6-6l4 4M36 62l6 6l6-6l6 6l6-6l4 4" {...L} />
    case 'blank':
      return <rect x={40} y={45} width={20} height={26} rx={3} {...L} strokeDasharray="4 3" />
    case 'cut':
      return <path d="M38 46l24 24M62 46l-24 24M36 58h28" {...L} />
    case 'copy':
      return (
        <g {...L}>
          <rect x={38} y={46} width={15} height={20} rx={2} />
          <rect x={47} y={51} width={15} height={20} rx={2} fill={INK.paper} />
        </g>
      )
    case 'seal':
      return (
        <g>
          <circle cx={cx} cy={cy} r={11} fill={ink} />
          <circle cx={cx} cy={cy} r={7.5} fill="none" stroke={INK.paper} strokeWidth={1.4} strokeDasharray="2 1.6" />
        </g>
      )
    case 'spin':
      return (
        <g {...L}>
          <circle cx={cx} cy={cy} r={11} />
          <path d={`M${cx} ${cy}l7 -7M${cx} ${cy - 11}v4M${cx + 11} ${cy}h-4M${cx} ${cy + 11}v-4M${cx - 11} ${cy}h4`} />
        </g>
      )
    case 'up':
      return <path d="M50 44l12 14h-7v12h-10v-12h-7z" fill={ink} />
  }
}

function StampArt({ ckey, name }: { ckey: string; name: string }) {
  const look = STAMP_LOOK[ckey] ?? { ink: INK.navy, glyph: { text: '?' } }
  return (
    <Frame>
      <rect x={7} y={7} width={86} height={100} rx={5} fill={INK.paper2} />
      <rect x={7} y={7} width={86} height={100} rx={5} fill={ht('paper')} opacity={0.8} />
      <g transform="rotate(-8 50 58)">
        <circle cx={51.5} cy={59.2} r={30} fill="none" stroke={look.ink} strokeWidth={2.5} opacity={0.35} />
        <circle cx={50} cy={58} r={30} fill="none" stroke={look.ink} strokeWidth={3.2} />
        <circle cx={50} cy={58} r={24} fill="none" stroke={look.ink} strokeWidth={1.4} strokeDasharray="3 2.4" />
        <GlyphMark glyph={look.glyph} ink={look.ink} />
      </g>
      <NameBand name={name} fill={look.ink} color={look.ink === INK.sun || look.ink === INK.aqua ? INK.navy : INK.paper} />
    </Frame>
  )
}

export const ConsArt = memo(function ConsArt({ ckey }: { ckey: string }) {
  const def = consDef(ckey)
  if (!def) return null
  if (def.kind === 'plate') return <PlateArt hand={def.hand!} name={def.name} />
  return <StampArt ckey={ckey} name={def.name} />
})

// ——— Packs ———

const PACK_INK = { joker: INK.pink, plate: INK.blue, stamp: INK.orange, print: INK.green } as const
const PACK_LABEL = { joker: 'Jokers', plate: 'Plates', stamp: 'Stamps', print: 'Cards' } as const

export const PackArt = memo(function PackArt({ pack }: { pack: PackKey }) {
  const def = PACKS[pack]
  const ink = PACK_INK[def.kind]
  const size = pack.endsWith('Mega') ? 'Mega' : pack.endsWith('Jumbo') ? 'Jumbo' : null
  return (
    <svg className="card-svg" viewBox="0 0 100 140" aria-hidden="true">
      <rect x={4} y={6} width={92} height={128} rx={6} fill={ink} />
      <rect x={4} y={6} width={92} height={128} rx={6} fill={ht('paper')} opacity={0.25} />
      <path d="M4 12Q4 6 10 6H90Q96 6 96 12L50 50Z" fill="rgba(35,35,63,0.22)" />
      <path d="M4 12L50 50L96 12" fill="none" stroke="rgba(35,35,63,0.55)" strokeWidth={1.4} />
      <rect x={16} y={60} width={68} height={50} rx={4} fill={INK.paper} />
      <text x={50} y={83} textAnchor="middle" fontSize={13} fill={INK.navy} style={FONT}>
        {PACK_LABEL[def.kind]}
      </text>
      <text x={50} y={100} textAnchor="middle" fontSize={8.5} fill={INK.navy} style={FONT} opacity={0.75}>
        pick {def.picks} of {def.size}
      </text>
      {size && (
        <g transform="rotate(10 78 30)">
          <rect x={58} y={22} width={38} height={15} rx={7.5} fill={INK.yellow} />
          <text x={77} y={33} textAnchor="middle" fontSize={9} fill={INK.navy} style={FONT}>
            {size}
          </text>
        </g>
      )}
      <rect x={4} y={6} width={92} height={128} rx={6} fill="none" stroke="rgba(35,35,63,0.4)" strokeWidth={1.2} />
    </svg>
  )
})

// ——— Vouchers ———

const VOUCHER_LOOK: Record<string, [string, string]> = {
  overtime: ['+1', 'hand'],
  recycling: ['+1', 'discard'],
  widegrip: ['+1', 'hand size'],
  bigframe: ['+1', 'joker'],
  pocket: ['+1', 'slot'],
  member: ['25%', 'off'],
  bulkreroll: ['−$2', 'rerolls'],
  savings: ['$10', 'interest'],
  overstock: ['+1', 'shelf'],
  platerack: ['×2', 'plates'],
  stamprack: ['×2', 'stamps'],
  printer: ['A', 'cards'],
}

export const VoucherArt = memo(function VoucherArt({ vkey, name }: { vkey: string; name: string }) {
  const uid = useId().replace(/:/g, '')
  const [big, small] = VOUCHER_LOOK[vkey] ?? ['?', '']
  const notches = [30, 50, 70, 90, 110]
  return (
    <svg className="card-svg" viewBox="0 0 100 140" aria-hidden="true">
      <defs>
        <mask id={`vm${uid}`}>
          <rect x={0} y={0} width={100} height={140} fill="#fff" />
          {notches.map((y) => (
            <g key={y}>
              <circle cx={4} cy={y} r={4.5} fill="#000" />
              <circle cx={96} cy={y} r={4.5} fill="#000" />
            </g>
          ))}
        </mask>
      </defs>
      <g mask={`url(#vm${uid})`}>
        <rect x={4} y={8} width={92} height={124} rx={5} fill={INK.purple} />
        <rect x={4} y={8} width={92} height={124} rx={5} fill={ht('pink')} opacity={0.4} />
        <rect x={12} y={16} width={76} height={86} rx={4} fill={INK.paper} />
        <rect x={15} y={19} width={70} height={80} rx={3} fill="none" stroke={INK.purple} strokeWidth={1.2} strokeDasharray="3 2" />
      </g>
      <text x={50} y={62} textAnchor="middle" fontSize={big.length > 2 ? 20 : 26} fill={INK.purple} style={FONT}>
        {big}
      </text>
      <text x={50} y={82} textAnchor="middle" fontSize={9.5} fill={INK.navy} style={FONT}>
        {small}
      </text>
      <NameBand name={name} fill={INK.navy} />
    </svg>
  )
})

// ——— Tags ———

const TAG_LOOK: Record<string, [string, string]> = {
  payday: ['$10', INK.sun],
  rarefind: ['R', INK.pink],
  luckyfind: ['U', INK.green],
  prismtag: ['Pr', INK.purple],
  coupon: ['%', INK.orange],
  freeroll: ['$0', INK.teal],
  jokerbundle: ['J', INK.pink],
  platebundle: ['P', INK.blue],
  stampbundle: ['S', INK.orange],
  bighand: ['+3', INK.aqua],
  bossswap: ['?', INK.red],
  investment: ['$25', INK.sun],
}

export const TagArt = memo(function TagArt({ tkey }: { tkey: string }) {
  const [glyph, ink] = TAG_LOOK[tkey] ?? ['?', INK.navy]
  const dark = ink === INK.sun || ink === INK.aqua
  return (
    <svg className="tag-svg" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx={20.8} cy={20.8} r={18} fill={ink} opacity={0.45} />
      <circle cx={20} cy={20} r={18} fill={ink} />
      <circle cx={20} cy={20} r={14.5} fill="none" stroke={dark ? INK.navy : INK.paper} strokeWidth={1.1} strokeDasharray="2.4 1.8" />
      <text x={20} y={20 + (glyph.length > 2 ? 4 : 5.5)} textAnchor="middle" fontSize={glyph.length > 2 ? 11 : 15} fill={dark ? INK.navy : INK.paper} style={FONT}>
        {glyph}
      </text>
    </svg>
  )
})
