// Sidebar — Panel izquierdo con módulos analíticos + controles globales.
// Manual de Diseño v2: cards de módulo con descripción + barra activa roja
// vertical, secciones con label uppercase + icono, lista de ENT con borde
// activo rojo. 296 px de ancho.

import { Activity, BrainCircuit, Star, Layers, Stethoscope, MapPin, Calendar, Gauge } from 'lucide-react'
import { useStore } from '../../store'
import EntSelector   from '../controls/EntSelector'
import YearSlider    from '../controls/YearSlider'
import LayerToggle   from '../controls/LayerToggle'
import MetricToggle  from '../controls/MetricToggle'
import ProvinceSelect from '../controls/ProvinceSelect'

// Cada módulo lleva una descripción corta de 1 línea (técnica del manual:
// "Egresos · mortalidad", "MGWR · 7 factores", "Ranking ponderado").
// `simulada: true` muestra el pill SIM rojo al costado.
const MODULES = [
  {
    id:    'carga',
    label: 'Carga de enfermedad',
    desc:  'Egresos · mortalidad',
    icon:  Activity,
    ready: true,
  },
  {
    id:    'determinantes',
    label: 'Determinantes',
    desc:  'MGWR · 7 factores',
    icon:  BrainCircuit,
    ready: true,
    simulada: true,
  },
  {
    id:    'mcda',
    label: 'Priorización MCDA',
    desc:  'Ranking ponderado',
    icon:  Star,
    ready: true,
    simulada: true,
  },
]

function SectionHeader({ icon: Icon, label }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-inspi-muted">
      <Icon size={11} strokeWidth={2.2} />
      <span>{label}</span>
    </div>
  )
}

export default function Sidebar() {
  const module    = useStore(s => s.module)
  const setModule = useStore(s => s.setModule)

  return (
    <aside className="flex w-[296px] flex-shrink-0 flex-col gap-4 overflow-y-auto border-r border-inspi-line bg-inspi-bone p-3">
      {/* === Módulos analíticos === */}
      <div>
        <SectionHeader icon={Layers} label="Módulo analítico" />
        <div className="space-y-1.5">
          {MODULES.map(m => {
            const active = module === m.id
            const Icon = m.icon
            return (
              <button
                key={m.id}
                onClick={() => m.ready && setModule(m.id)}
                disabled={!m.ready}
                title={m.label}
                className={`relative flex w-full items-start gap-2.5 rounded-[3px] border px-2.5 py-2 text-left transition ${
                  active
                    ? 'border-inspi-navy bg-white shadow-sm'
                    : m.ready
                      ? 'border-inspi-line bg-white/50 hover:border-slate-300 hover:bg-white'
                      : 'cursor-not-allowed border-inspi-line bg-inspi-line/40 opacity-60'
                }`}
              >
                {/* Barra roja vertical 3px en el módulo activo (eco del wordmark). */}
                {active && (
                  <span className="absolute left-0 top-0 h-full w-[3px] rounded-l-[3px] bg-inspi-red" />
                )}

                <Icon
                  size={16}
                  strokeWidth={2.1}
                  className={active ? 'mt-0.5 flex-shrink-0 text-inspi-navy' : 'mt-0.5 flex-shrink-0 text-inspi-muted'}
                />
                <div className="min-w-0 flex-1">
                  <div className={`truncate font-display text-[12.5px] font-semibold leading-tight ${active ? 'text-inspi-navy' : 'text-slate-700'}`}>
                    {m.label}
                  </div>
                  <div className="mt-0.5 truncate font-display text-[10px] font-medium text-inspi-muted">
                    {m.desc}
                  </div>
                </div>
                {m.simulada && (
                  <span
                    className="ml-auto rounded-[3px] bg-inspi-navy/10 px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-[0.07em] text-inspi-navy"
                    title="Datos simulados — no oficiales"
                  >
                    Simulación
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* === Visualización === */}
      <div>
        <SectionHeader icon={Layers} label="Visualización" />
        <LayerToggle />
      </div>

      {/* === Métrica del mapa (solo en Carga) === */}
      {module === 'carga' && (
        <div>
          <SectionHeader icon={Gauge} label="Métrica del mapa" />
          <MetricToggle />
        </div>
      )}

      {/* === Grupo ENT === */}
      <div>
        <SectionHeader icon={Stethoscope} label="Grupo ENT" />
        <EntSelector />
      </div>

      {/* === Provincia (zoom) === */}
      <div>
        <SectionHeader icon={MapPin} label="Provincia (zoom)" />
        <ProvinceSelect />
      </div>

      {/* === Evolución temporal === */}
      <div>
        <SectionHeader icon={Calendar} label="Evolución temporal" />
        <YearSlider />
      </div>
    </aside>
  )
}
