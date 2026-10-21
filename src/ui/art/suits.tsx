import type { Suit } from '../../game/types'

/** Suit shapes drawn in a 20×20 box. */
export const SUIT_PATH: Record<Suit, string> = {
  H: 'M10 19.2C6.4 16.1 0.6 12 0.6 6.4 0.6 3.1 3 0.8 6 0.8c1.8 0 3.2 0.9 4 2.4 0.8-1.5 2.2-2.4 4-2.4 3 0 5.4 2.3 5.4 5.6 0 5.6-5.8 9.7-9.4 12.8z',
  D: 'M10 0.4C12.3 4.1 15.3 7.4 18.6 10 15.3 12.6 12.3 15.9 10 19.6 7.7 15.9 4.7 12.6 1.4 10 4.7 7.4 7.7 4.1 10 0.4z',
  S: 'M10 0.4C12.8 4.4 19.4 7.6 19.4 12.4c0 2.9-2.2 4.9-4.7 4.9-1.5 0-2.6-0.6-3.5-1.6l1.2 3.9H7.6l1.2-3.9c-0.9 1-2 1.6-3.5 1.6C2.8 17.3 0.6 15.3 0.6 12.4 0.6 7.6 7.2 4.4 10 0.4z',
  C: 'M10 0.6a4.7 4.7 0 0 1 3.9 7.4 4.7 4.7 0 1 1-2.5 7.5l1.2 3.9H7.4l1.2-3.9A4.7 4.7 0 1 1 6.1 8 4.7 4.7 0 0 1 10 0.6z',
}

interface Props {
  suit: Suit
  x: number
  y: number
  size: number
  fill: string
  flip?: boolean
}

/** Places a suit shape centred on (x, y). */
export function SuitShape({ suit, x, y, size, fill, flip }: Props) {
  const s = size / 20
  const t = `translate(${x} ${y})${flip ? ' rotate(180)' : ''} scale(${s}) translate(-10 -10)`
  return <path d={SUIT_PATH[suit]} transform={t} fill={fill} />
}

/** Inline suit icon for running text. */
export function SuitIcon({ suit, color }: { suit: Suit; color: string }) {
  return (
    <svg className="suit-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d={SUIT_PATH[suit]} fill={color} />
    </svg>
  )
}
