// Sidebar — Panel izquierdo con módulos analíticos + controles globales.
// Reemplaza .dash-sidebar del legacy. Estructura por módulos a la Gemini:
// - Carga de Enfermedad: coropletas + hot spots + tendencia MK+Sen+FDR
// - Determinantes IA:    MGWR betas locales + 7 determinantes parroquiales
// - Priorización MCDA:   ranking y top-ENT por parroquia (6 criterios)

import { Activity, BrainCircuit, Star, Layers, Stethoscope, MapPin, Calendar, Gauge } from 'lucide-react'
import { useStore } from '../../store'
import EntSelector   from '../controls/EntSelector'
import YearSlider    from '../controls/YearSlider'
import LayerToggle   from '../controls/LayerToggle'
import MetricToggle  from '../controls/MetricToggle'
import ProvinceSelect from '../controls/ProvinceSelect'

const MODULES = [
  { id: 'carga',         label: 'Carga de Enfermedad', icon: Activity,     ready: true, color: 'text-rose-600'   },
  { id: 'determinantes', label: 'Determinantes IA',    icon: BrainCircuit, ready: true, color: 'text-violet-600' },
  { id: 'mcda',          label: 'Priorización MCDA',   icon: Star,         ready: true, color: 'text-amber-600'  },
]

function ControlGroup({ icon: Icon, label, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <Icon size={12} /> {label}
      </div>
      {children}
    </div>
  )
}

export default function Sidebar() {
  const module = useStore(s => s.module)
  const setModule = useStore(s => s.setModule)

  return (
    <aside className="flex w-72 flex-shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-200 bg-white p-3">
      {/* Módulos analíticos */}
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Módulo analítico
        </div>
        <div className="space-y-1">
          {MODULES.map(m => {
            const active = module === m.id
            const Icon = m.icon
            return (
              <button
                key={m.id}
                onClick={() => m.ready && setModule(m.id)}
                disabled={!m.ready}
                className={`flex w-full items-center gap-2 rounded border px-2.5 py-2 text-left text-xs transition ${
                  active
                    ? 'border-inspi-navy bg-slate-50 text-inspi-navy shadow-sm'
                    : m.ready
                      ? 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
                }`}
                title={m.label}
              >
                <Icon size={14} className={active ? m.color : ''} />
                <span className="font-medium">{m.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <hr className="border-slate-100" />

      <ControlGroup icon={Layers} label="Visualización">
        <LayerToggle />
      </ControlGroup>

      <ControlGroup icon={Gauge} label="Métrica del mapa">
        <MetricToggle />
      </ControlGroup>

      <ControlGroup icon={Stethoscope} label="Grupo ENT">
        <EntSelector />
      </ControlGroup>

      <ControlGroup icon={MapPin} label="Provincia (zoom)">
        <ProvinceSelect />
      </ControlGroup>

      <ControlGroup icon={Calendar} label="Evolución temporal">
        <YearSlider />
      </ControlGroup>
    </aside>
  )
}
