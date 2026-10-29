import { makeCard } from '../../game/cards'
import { DIFFICULTIES } from '../../game/difficulty'
import { useStore } from '../../store'
import { CardFace } from '../art/CardFace'
import { JokerArt } from '../art/JokerArt'
import { sfx } from '../audio'
import { Modals } from '../parts/Modals'

export function Menu() {
  const game = useStore((s) => s.game)
  const profile = useStore((s) => s.profile)
  const continueRun = useStore((s) => s.continueRun)
  const setModal = useStore((s) => s.setModal)
  const canContinue = !!game && game.phase !== 'over'

  return (
    <div className="menu mat">
      <div className="poster">
        <h1 className="logo" aria-label="Misdeal">
          <span className="logo-ink logo-pink" aria-hidden="true">
            Mis
            <br />
            deal
          </span>
          <span className="logo-ink logo-blue" aria-hidden="true">
            Mis
            <br />
            deal
          </span>
        </h1>
        <p className="poster-line">A poker roguelike. Build hands, hire Jokers, beat eight antes of blinds.</p>
        <div className="poster-cards" aria-hidden="true">
          <div className="poster-card c1">
            <CardFace card={makeCard('m1', 'S', 14)} />
          </div>
          <div className="poster-card c2">
            <JokerArt jkey="poster-mascot" rarity={3} />
          </div>
          <div className="poster-card c3">
            <CardFace card={makeCard('m3', 'H', 13)} />
          </div>
        </div>
      </div>

      <nav className="menu-actions" aria-label="Main menu">
        {canContinue && (
          <button
            className="btn btn-play btn-menu"
            onClick={() => {
              sfx('play')
              continueRun()
            }}
          >
            <span className="btn-label">Continue</span>
            <span className="btn-sub">
              {(game!.difficulty ?? 0) > 0 ? `${DIFFICULTIES[game!.difficulty!].name}, ` : ''}Ante {game!.ante}, ${game!.money}
            </span>
          </button>
        )}
        <button className={`btn btn-menu ${canContinue ? 'btn-plain' : 'btn-play'}`} onClick={() => setModal('newrun')}>
          <span className="btn-label">New run</span>
        </button>
        <button className="btn btn-menu btn-plain" onClick={() => setModal('howto')}>
          <span className="btn-label">How to play</span>
        </button>
        <button className="btn btn-menu btn-plain" onClick={() => setModal('collection')}>
          <span className="btn-label">Collection</span>
        </button>
        <button className="btn btn-menu btn-plain" onClick={() => setModal('options')}>
          <span className="btn-label">Options</span>
        </button>
        {profile.runs > 0 && (
          <p className="menu-stats">
            {profile.runs} {profile.runs === 1 ? 'run' : 'runs'}, {profile.wins} {profile.wins === 1 ? 'win' : 'wins'}, best ante {profile.bestAnte || 1}
          </p>
        )}
      </nav>
      <Modals />
    </div>
  )
}
