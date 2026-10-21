const nf = new Intl.NumberFormat('en-US')

/** Whole numbers with separators; very large scores switch to scientific notation. */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '∞'
  if (Math.abs(n) >= 1e11) {
    const [m, e] = n.toExponential(3).split('e')
    return `${m}e${Number(e)}`
  }
  return nf.format(Math.floor(n))
}

/** Mult can be fractional after × effects. */
export function fmtMult(n: number): string {
  if (Math.abs(n) >= 1e11) return fmt(n)
  if (Number.isInteger(n)) return nf.format(n)
  return n >= 100 ? nf.format(Math.round(n)) : String(Math.round(n * 10) / 10)
}

export const money = (n: number) => `$${n}`
