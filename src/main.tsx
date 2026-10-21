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
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline play is a bonus; the game still works without it.
    })
  })
}
