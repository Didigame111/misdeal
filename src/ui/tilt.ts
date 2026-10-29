/** Tilts an element toward the finger, like pressing on a real card. Writes CSS vars only, no React state. */
export function tiltToward(el: HTMLElement | null, e: React.PointerEvent) {
  if (!el) return
  const b = el.getBoundingClientRect()
  const x = (e.clientX - b.left) / b.width - 0.5
  const y = (e.clientY - b.top) / b.height - 0.5
  el.style.setProperty('--ry', `${(x * 22).toFixed(1)}deg`)
  el.style.setProperty('--rx', `${(-y * 22).toFixed(1)}deg`)
  el.classList.add('is-pressed')
}

export function untilt(el: HTMLElement | null) {
  el?.classList.remove('is-pressed')
}
