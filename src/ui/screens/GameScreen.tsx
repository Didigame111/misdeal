import { useStore } from '../../store'
import { useScorePlayback } from '../fx'
import { Hud } from '../parts/Hud'
import { Inspector } from '../parts/Inspector'
import { EndScreen, Modals } from '../parts/Modals'
import { BlindSelect, CashOut, PackStage, Shop } from '../parts/Phases'
import { RoundStage } from '../parts/RoundStage'
import { Toasts } from '../parts/Toasts'
import { Trays } from '../parts/Trays'

export function GameScreen() {
  useScorePlayback()
  const phase = useStore((s) => s.game!.phase)
  const hasRound = useStore((s) => !!s.game!.round)
  return (
    <div className="game mat" data-phase={phase}>
      <Hud />
      <Trays />
      <main className="stage">
        {phase === 'blinds' && <BlindSelect />}
        {(phase === 'round' || phase === 'scoring' || (phase === 'over' && hasRound)) && <RoundStage />}
        {(phase === 'cashout' || phase === 'won') && <CashOut />}
        {phase === 'shop' && <Shop />}
        {phase === 'pack' && <PackStage />}
      </main>
      {(phase === 'over' || phase === 'won') && <EndScreen />}
      <Toasts />
      <Inspector />
      <Modals />
    </div>
  )
}
