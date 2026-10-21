import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/base.css'
import './styles/game.css'
import { App } from './ui/App'
import { useStore } from './store'
import * as Engine from './game/engine'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.DEV) {
  // Handy for poking at runs from the browser console while developing.
  Object.assign(window, { __store: useStore, __engine: Engine })
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // The first worker taking control is the install, not an update; every later change is a new release.
    let controlled = !!navigator.serviceWorker.controller
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // A Home Screen app can stay open for days, so look for a new release whenever it comes back.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void reg.update().catch(() => {})
        })
      })
      .catch(() => {
        // Offline play is a bonus; the game still works without it.
      })
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (controlled) window.dispatchEvent(new Event('misdeal:update-ready'))
      controlled = true
    })
  })
}
