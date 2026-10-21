import * as E from '../../game/engine'
import { effectiveJokerSlots } from '../../game/jokers'
import { act, useStore } from '../../store'
import { rectOf } from '../hooks'
import { ConsCard, JokerCard } from './Items'
import { SlotRow } from './SlotRow'

export function Trays() {
  const g = useStore((s) => s.game!)
  const setInspect = useStore((s) => s.setInspect)
  return (
    <div className="trays">
      <SlotRow
        className="tray tray-jokers"
        items={g.jokers}
        getId={(j) => j.id}
        label={`${g.jokers.length}/${effectiveJokerSlots(g)}`}
        empty="Jokers you buy sit here"
        render={(j) => <JokerCard joker={j} g={g} />}
        onTap={(j, el) => setInspect({ kind: 'joker', id: j.id, rect: rectOf(el) })}
        onMove={(from, to) => act((d) => E.moveJoker(d, from, to))}
      />
      <SlotRow
        className="tray tray-cons"
        items={g.cons}
        getId={(c) => c.id}
        label={`${g.cons.length}/${g.consSlots}`}
        empty="Plates and stamps"
        render={(c) => <ConsCard cons={c} />}
        onTap={(c, el) => setInspect({ kind: 'cons', id: c.id, rect: rectOf(el) })}
        onMove={(from, to) => act((d) => E.moveCons(d, from, to))}
      />
    </div>
  )
}
