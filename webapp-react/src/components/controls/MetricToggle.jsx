// MetricToggle — Selector de qué tasa grafica el mapa (morbilidad vs
// mortalidad). Es la fuente de verdad única: afecta coropleta, heatmap,
// leyenda, tooltip del mapa Y todo el panel derecho (KPI, conteos,
// gráfica temporal y píldora de tendencia). Una sola métrica a la vez
// evita la confusión de leer dos indicadores en paralelo.

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
    <div className="grid grid-cols-2 gap-1.5">
      {TABS.map(t => {
        const active = mapMetric === t.id
        const Icon = t.icon
        return (
          <button
            key={t.id}
            onClick={() => setMapMetric(t.id)}
            title={t.hint}
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
