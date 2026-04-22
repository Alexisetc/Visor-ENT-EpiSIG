// MetricToggle — Selector de qué tasa grafica el mapa (morbilidad vs
// mortalidad). Reutilizable: afecta coropleta, heatmap, leyenda y tooltip.
//
// El KPIBlock + píldora de tendencia de la ficha derecha siempre muestran
// AMBAS métricas en paralelo (morbilidad arriba, mortalidad abajo) — este
// toggle solo decide cuál se grafica espacialmente en el mapa. Esa es la
// división deliberada: el panel lateral compara los dos indicadores
// simultáneamente, el mapa enfoca uno a la vez para no saturar el color.

import { HeartPulse, Skull } from 'lucide-react'
import { useStore } from '../../store'

const TABS = [
  { id: 'morbilidad', label: 'Morbilidad', icon: HeartPulse, hint: 'Tasa de egresos hospitalarios /100k' },
  { id: 'mortalidad', label: 'Mortalidad', icon: Skull,      hint: 'Tasa de defunciones /100k'           },
]

export default function MetricToggle() {
  const mapMetric    = useStore(s => s.mapMetric)
  const setMapMetric = useStore(s => s.setMapMetric)

  return (
    <div className="grid grid-cols-2 gap-1 rounded border border-slate-200 bg-slate-50 p-0.5">
      {TABS.map(t => {
        const active = mapMetric === t.id
        const Icon = t.icon
        return (
          <button
            key={t.id}
            onClick={() => setMapMetric(t.id)}
            className={`flex flex-col items-center justify-center gap-0.5 rounded px-1 py-1.5 text-[10px] font-medium transition ${
              active ? 'bg-white text-inspi-navy shadow' : 'text-slate-500 hover:bg-white/60'
            }`}
            title={t.hint}
          >
            <Icon size={14} className={active ? 'text-inspi-yellow' : ''} />
            <span>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}
