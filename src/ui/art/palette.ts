/** Risograph-style ink colours used across the art. */
export const INK = {
  paper: '#f4f0e6',
  paper2: '#e8e0cc',
  navy: '#23233f',
  blue: '#3255a4',
  pink: '#ff48b0',
  yellow: '#ffe800',
  sun: '#ffb511',
  red: '#e83a5b',
  teal: '#00838a',
  green: '#00a95c',
  orange: '#ff6c2f',
  purple: '#765ba7',
  aqua: '#5ec8e5',
  burgundy: '#914e72',
  federal: '#2a2f6b',
  kraft: '#c9a46f',
  mat: '#1d5b47',
} as const

export const SUIT_INK = {
  S: INK.federal,
  H: INK.red,
  C: '#00835c',
  D: '#e8641c',
} as const

/** A second, lighter ink printed under each suit for the misregistered look. */
export const SUIT_SHADOW = {
  S: INK.aqua,
  H: INK.pink,
  C: INK.yellow,
  D: INK.sun,
} as const

export const RARITY_INK = { 1: INK.blue, 2: INK.green, 3: INK.pink } as const

export const BRIGHT = [INK.blue, INK.pink, INK.yellow, INK.teal, INK.orange, INK.purple, INK.green, INK.red, INK.aqua, INK.sun] as const
