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
    <aside className="flex w-[296px] flex-shrink-0 flex-col overflow-y-auto border-r border-inspi-line bg-inspi-paper">
      {/* === Módulos analíticos (en su propia sección con border-bottom) === */}
      <div className="border-b border-inspi-line p-[14px]">
        <SectionHeader icon={Layers} label="Módulo analítico" />
        <div className="mt-2 space-y-1">
          {MODULES.map(m => {
            const active = module === m.id
            const Icon = m.icon
            return (
              <button
                key={m.id}
                onClick={() => m.ready && setModule(m.id)}
                disabled={!m.ready}
                title={m.label}
                className={`relative flex w-full items-center gap-2.5 rounded-[4px] border px-2.5 py-[9px] text-left transition ${
                  active
                    ? 'border-inspi-navy bg-inspi-navy text-white'
                    : m.ready
                      ? 'border-inspi-line bg-inspi-paper text-inspi-ink hover:bg-inspi-slate-50'
                      : 'cursor-not-allowed border-inspi-line bg-inspi-line/40 opacity-60'
                }`}
              >
                {/* Barra roja vertical 3px (eco del wordmark) en el módulo
                    activo, sale ligeramente del borde izquierdo. */}
                {active && (
                  <span className="absolute -left-px top-1.5 bottom-1.5 w-[3px] rounded-r-[2px] bg-inspi-red" />
                )}

                <Icon size={15} strokeWidth={2.1} className="flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-[12.5px] font-semibold leading-[1.15]">
                    {m.label}
                  </div>
                  <div className={`mt-px truncate font-display text-[10px] ${active ? 'text-white/65' : 'text-inspi-muted'}`}>
                    {m.desc}
                  </div>
                </div>
                {m.simulada && (
                  <span
                    className={`ml-auto flex-shrink-0 rounded-[3px] px-1.5 py-0.5 font-display text-[8.5px] font-bold uppercase tracking-[0.05em] ${
                      active ? 'bg-white/16 text-white' : 'bg-inspi-navy/10 text-inspi-navy'
                    }`}
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

      {/* === Resto de controles + footer Fuentes === */}
      <div className="flex flex-1 flex-col gap-[18px] p-[14px]">

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

      {/* === Footer Fuentes (institucional) === */}
      <div className="mt-auto border-t border-inspi-line pt-3.5 font-display text-[9.5px] leading-[1.4] text-inspi-muted">
        <div className="mb-1 font-bold text-inspi-navy">Fuentes</div>
        INEC/MSP egresos hospitalarios 2013–2024<br/>
        CPV 2022 · ENSANUT-ECU · STEPS-OMS<br/>
        <span className="text-inspi-muted/80">
          Corte al {new Date().toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </span>
      </div>

      </div>
    </aside>
  )
}
