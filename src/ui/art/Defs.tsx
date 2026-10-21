import { INK } from './palette'

export type InkName = keyof typeof INK

const PATTERN_INKS: InkName[] = ['blue', 'pink', 'yellow', 'sun', 'red', 'teal', 'green', 'orange', 'purple', 'aqua', 'navy', 'federal', 'burgundy', 'paper']

export const ht = (ink: InkName) => `url(#ht-${ink})`
export const stripes = (ink: InkName) => `url(#st-${ink})`
export const checks = (ink: InkName) => `url(#ck-${ink})`

export function inkName(hex: string): InkName {
  const hit = (Object.keys(INK) as InkName[]).find((k) => INK[k].toLowerCase() === hex.toLowerCase())
  return hit && PATTERN_INKS.includes(hit) ? hit : 'navy'
}

/** Shared SVG patterns, rendered once. Kept in the layout (not display:none) so Safari resolves them. */
export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        {PATTERN_INKS.map((k) => (
          <g key={k}>
            <pattern id={`ht-${k}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
              <circle cx="2.5" cy="2.5" r="1.25" fill={INK[k]} />
            </pattern>
            <pattern id={`st-${k}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)">
              <rect width="4" height="8" fill={INK[k]} />
            </pattern>
            <pattern id={`ck-${k}`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={INK[k]} />
              <rect x="6" y="6" width="6" height="6" fill={INK[k]} />
            </pattern>
          </g>
        ))}
        <pattern id="grain" width="23" height="19" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="4" r="0.55" fill="#000" opacity="0.13" />
          <circle cx="14" cy="2" r="0.45" fill="#000" opacity="0.1" />
          <circle cx="19" cy="11" r="0.6" fill="#000" opacity="0.12" />
          <circle cx="8" cy="14" r="0.4" fill="#000" opacity="0.1" />
          <circle cx="12" cy="9" r="0.35" fill="#fff" opacity="0.4" />
          <circle cx="21" cy="17" r="0.4" fill="#000" opacity="0.08" />
        </pattern>
        <pattern id="fibres" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M2 5q6 -2 11 1M16 20q5 3 11 0M5 25q3 -4 8 -3M20 8q3 2 7 1" stroke="#6b4e2a" strokeWidth="0.6" fill="none" opacity="0.35" />
        </pattern>
        <linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={INK.pink} />
          <stop offset="0.35" stopColor={INK.yellow} />
          <stop offset="0.7" stopColor={INK.aqua} />
          <stop offset="1" stopColor={INK.purple} />
        </linearGradient>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6d77a" />
          <stop offset="0.5" stopColor="#d9a520" />
          <stop offset="1" stopColor="#f2c94c" />
        </linearGradient>
        <linearGradient id="silver" x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0" stopColor="#d9dbe2" />
          <stop offset="0.5" stopColor="#a8acb9" />
          <stop offset="1" stopColor="#cfd2da" />
        </linearGradient>
      </defs>
    </svg>
  )
}
