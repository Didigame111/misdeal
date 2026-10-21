import { lazy, Suspense, useEffect } from 'react'
import { useStore } from '../store'
import { SvgDefs } from './art/Defs'
import { unlockAudio } from './audio'
import { GameScreen } from './screens/GameScreen'
import { Menu } from './screens/Menu'

// Art gallery for development only (open with #gallery); left out of production builds.
const Gallery = import.meta.env.DEV ? lazy(() => import('./Gallery').then((m) => ({ default: m.Gallery }))) : null

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
    </>
  )
}
