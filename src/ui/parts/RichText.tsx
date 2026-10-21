import { SUIT_INK } from '../art/palette'
import { SuitIcon } from '../art/suits'
import type { Suit } from '../../game/types'

const TOKEN = /(\+\d+ to \+\d+ Mult|[+−-]\d+ Mult|×\d+(?:\.\d+)? Mult|×\d+(?:\.\d+)?|\+\d+ Chips|\$\d+|[♥♦♠♣])/g
const GLYPH_SUIT: Record<string, Suit> = { '♠': 'S', '♥': 'H', '♣': 'C', '♦': 'D' }

/** Colours game terms in descriptions: chips blue, mult pink, money gold, suits in their inks. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(TOKEN)
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0) return p
        if (GLYPH_SUIT[p]) return <SuitIcon key={i} suit={GLYPH_SUIT[p]} color={SUIT_INK[GLYPH_SUIT[p]]} />
        if (p.startsWith('×')) return <b key={i} className="rt rt-xmult">{p}</b>
        if (p.endsWith('Mult')) return <b key={i} className="rt rt-mult">{p}</b>
        if (p.endsWith('Chips')) return <b key={i} className="rt rt-chips">{p}</b>
        return <b key={i} className="rt rt-money">{p}</b>
      })}
    </>
  )
}
