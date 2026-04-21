// LayerToggle — Selector de capa (Coropletas | Hot Spots | Priorización).
// Reemplaza .layer-toggle del legacy. Coropleta y Heatmap aplican a Carga de Enfermedad;
// Priorización fuerza el módulo MCDA (Sprint 3).

import { Map as MapIcon, Flame, Star } from 'lucide-react'
import { useStore } from '../../store'

const TABS = [
  { id: 'coropleta',    label: 'Coropletas',  icon: MapIcon },
  { id: 'heatmap',      label: 'Hot Spots',   icon: Flame   },
  { id: 'priorizacion', label: 'Priorización', icon: Star    },
]

export default function LayerToggle() {
  const layerType    = useStore(s => s.layerType)
  const setLayerType = useStore(s => s.setLayerType)

  return (
    <div className="grid grid-cols-3 gap-1 rounded border border-slate-200 bg-slate-50 p-0.5">
      {TABS.map(t => {
        const active = layerType === t.id
        const Icon = t.icon
        return (
          <button
            key={t.id}
            onClick={() => setLayerType(t.id)}
            className={`flex flex-col items-center justify-center gap-0.5 rounded px-1 py-1.5 text-[10px] font-medium transition ${
              active ? 'bg-white text-inspi-navy shadow' : 'text-slate-500 hover:bg-white/60'
            }`}
            title={t.label}
          >
            <Icon size={14} className={active ? 'text-inspi-yellow' : ''} />
            <span>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}
