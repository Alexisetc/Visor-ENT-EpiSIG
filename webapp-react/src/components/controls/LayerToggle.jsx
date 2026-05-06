// LayerToggle — Selector de forma de visualización (Coropletas | Hot Spots).
// Son las dos únicas formas de visualización geográfica distintas: la
// priorización MCDA también se visualiza con coropletas (por ranking), por lo
// que no es una tercera forma sino un módulo aparte.

import { Map as MapIcon, Flame } from 'lucide-react'
import { useStore } from '../../store'

const TABS = [
  { id: 'coropleta',    label: 'Coropletas',  icon: MapIcon },
  { id: 'heatmap',      label: 'Hot Spots',   icon: Flame   },
]

export default function LayerToggle() {
  const layerType    = useStore(s => s.layerType)
  const setLayerType = useStore(s => s.setLayerType)

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {TABS.map(t => {
        const active = layerType === t.id
        const Icon = t.icon
        return (
          <button
            key={t.id}
            onClick={() => setLayerType(t.id)}
            title={t.label}
            className={`flex flex-col items-center justify-center gap-1 rounded-[3px] border px-2 py-2.5 font-display text-[11px] font-semibold transition ${
              active
                ? 'border-inspi-navy bg-white text-inspi-navy shadow-sm'
                : 'border-inspi-line bg-white/60 text-inspi-muted hover:border-slate-300 hover:bg-white'
            }`}
          >
            <Icon size={16} strokeWidth={2.1} className={active ? 'text-inspi-red' : 'text-inspi-muted'} />
            <span>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}
