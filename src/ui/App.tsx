import { lazy, Suspense, useEffect, useState } from 'react'
import { useStore } from '../store'
import { SvgDefs } from './art/Defs'
import { unlockAudio } from './audio'
import { GameScreen } from './screens/GameScreen'
import { Menu } from './screens/Menu'

// Art gallery for development only (open with #gallery); left out of production builds.
const Gallery = import.meta.env.DEV ? lazy(() => import('./Gallery').then((m) => ({ default: m.Gallery }))) : null

/** Offers a reload once a new release has been installed in the background. The run is saved first. */
function UpdateBanner() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const on = () => setReady(true)
    window.addEventListener('misdeal:update-ready', on)
    return () => window.removeEventListener('misdeal:update-ready', on)
  }, [])
  if (!ready) return null
  return (
    <div className="update-banner" role="status">
      <span>A new version of Misdeal is ready.</span>
      <button className="btn btn-small tone-primary" onClick={() => location.reload()}>
        Reload
      </button>
      <button className="btn btn-small" onClick={() => setReady(false)}>
        Later
      </button>
    </div>
  )
}

export function App() {
  const screen = useStore((s) => s.screen)
  const hasGame = useStore((s) => !!s.game)
  const speed = useStore((s) => s.settings.speed)

  useEffect(() => {
    const unlock = () => unlockAudio()
    const noZoom = (e: Event) => e.preventDefault()
    window.addEventListener('pointerdown', unlock)
    // Safari pinch-zoom gestures would otherwise scale the whole table.
    document.addEventListener('gesturestart', noZoom)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      document.removeEventListener('gesturestart', noZoom)
    }
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--speed', String(speed))
  }, [speed])

  if (Gallery && location.hash === '#gallery')
    return (
      <Suspense>
        <SvgDefs />
        <Gallery />
      </Suspense>
    )

  return (
    <>
      <SvgDefs />
      {screen === 'game' && hasGame ? <GameScreen /> : <Menu />}
      <UpdateBanner />
    </>
  )
}
