// EntSelector — Lista plana de grupos ENT (Manual de Diseño v2).
// Cada ítem: dot de color · nombre · CIE-10 mono. Activo lleva borde
// rojo a la izquierda + fondo blanco. "Todas las ENT" arriba como
// agregado, separado visualmente del resto.
//
// Solo 6 opciones (incluyendo "Todas") — caben en flat list sin
// scroll. Provincia (24 opciones) sí queda como combobox type-ahead.

import { useStore } from '../../store'
import { ENT_COLOR } from '../../lib/colors'

const OPTIONS = [
  { value: 'todas',        label: 'Todas las ENT', cie: 'agregado', color: '#9AA3AE' },
  { value: 'circulatorio', label: 'Circulatorio',  cie: 'I00-I99',  color: ENT_COLOR.circulatorio },
  { value: 'neoplasia',    label: 'Neoplasias',    cie: 'C00-D48',  color: ENT_COLOR.neoplasia    },
  { value: 'metabolica',   label: 'Metabólicas',   cie: 'E00-E90',  color: ENT_COLOR.metabolica   },
  { value: 'respiratorio', label: 'Respiratorio',  cie: 'J00-J99',  color: ENT_COLOR.respiratorio },
  { value: 'nervioso',     label: 'Nervioso',      cie: 'G00-G99',  color: ENT_COLOR.nervioso     },
]

export default function EntSelector() {
  const ent    = useStore(s => s.ent)
  const setEnt = useStore(s => s.setEnt)

  return (
    <div className="space-y-1">
      {OPTIONS.map((o, i) => {
        const active     = ent === o.value
        const isAggregate = o.value === 'todas'
        return (
          <button
            key={o.value}
            onClick={() => setEnt(o.value)}
            title={`${o.label} ${o.cie}`}
            className={`relative flex w-full items-center gap-2 rounded-[3px] border px-2.5 py-1.5 text-left transition ${
              active
                ? 'border-inspi-navy bg-white shadow-sm'
                : 'border-inspi-line bg-white/40 hover:border-slate-300 hover:bg-white'
            } ${isAggregate ? 'mb-1' : ''}`}
          >
            {/* Barra activa roja (izquierda, eco del wordmark). */}
            {active && <span className="absolute left-0 top-0 h-full w-[3px] rounded-l-[3px] bg-inspi-red" />}

            {/* Dot de color (categoría). */}
            <span
              className="h-2 w-2 flex-shrink-0 rounded-[2px]"
              style={{ background: o.color }}
            />
            <span className={`flex-1 truncate font-display text-[12px] ${active ? 'font-semibold text-inspi-navy' : 'font-medium text-slate-700'} ${isAggregate ? 'italic' : ''}`}>
              {o.label}
            </span>
            <span className={`flex-shrink-0 font-mono text-[10px] tnum ${active ? 'text-inspi-muted' : 'text-inspi-muted/80'}`}>
              {o.cie}
            </span>
          </button>
        )
      })}
    </div>
  )
}
