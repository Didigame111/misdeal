import { makeCard } from '../game/cards'
import { STAMPS, PLATES } from '../game/consumables'
import { JOKERS } from '../game/jokers'
import { PACKS, VOUCHERS } from '../game/meta'
import { TAGS } from '../game/blinds'
import type { Card, PackKey, Rank, Suit } from '../game/types'
import { CardBack } from './art/CardBack'
import { CardFace } from './art/CardFace'
import { ConsArt, PackArt, TagArt, VoucherArt } from './art/ItemArt'
import { JokerArt } from './art/JokerArt'

/** Developer view of every piece of art: open the app with #gallery. */
export function Gallery() {
  const ranks: Rank[] = [14, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
  const suits: Suit[] = ['S', 'H', 'C', 'D']
  const enh: Card['enh'][] = ['embossed', 'fluoro', 'rainbow', 'tissue', 'stock', 'blank', 'gilded', 'scratch']
  const box = { width: 90, height: 126 }
  const row = { display: 'flex', flexWrap: 'wrap' as const, gap: 10, marginBottom: 24 }
  return (
    <div className="mat" style={{ height: '100%', overflow: 'auto', padding: 20, userSelect: 'text' }}>
      {suits.map((s) => (
        <div key={s} style={row}>
          {ranks.map((r) => (
            <div key={r} style={box}>
              <CardFace card={makeCard(`${s}${r}`, s, r)} />
            </div>
          ))}
        </div>
      ))}
      <div style={row}>
        {enh.map((e, i) => (
          <div key={e} style={box}>
            <CardFace card={makeCard(`e${i}`, suits[i % 4], ranks[(i * 3) % 13], { enh: e, seal: i % 3 === 0 ? 'coin' : i % 3 === 1 ? 'echo' : undefined })} />
          </div>
        ))}
        <div style={box}>
          <CardFace card={makeCard('db', 'H', 9)} debuffed />
        </div>
        <div style={box}>
          <CardBack />
        </div>
        <div style={box}>
          <CardBack deck="crimson" />
        </div>
      </div>
      <div style={row}>
        {JOKERS.map((j) => (
          <div key={j.key} style={{ ...box, height: 150, fontSize: 11, textAlign: 'center' }}>
            <div style={box}>
              <JokerArt jkey={j.key} rarity={j.rarity} />
            </div>
            {j.name}
          </div>
        ))}
      </div>
      <div style={row}>
        {[...PLATES, ...STAMPS].map((c) => (
          <div key={c.key} style={box}>
            <ConsArt ckey={c.key} />
          </div>
        ))}
      </div>
      <div style={row}>
        {(Object.keys(PACKS) as PackKey[]).map((p) => (
          <div key={p} style={box}>
            <PackArt pack={p} />
          </div>
        ))}
        {VOUCHERS.map((v) => (
          <div key={v.key} style={box}>
            <VoucherArt vkey={v.key} name={v.name} />
          </div>
        ))}
      </div>
      <div style={row}>
        {TAGS.map((t) => (
          <div key={t.key} style={{ width: 48, height: 48 }}>
            <TagArt tkey={t.key} />
          </div>
        ))}
      </div>
    </div>
  )
}
