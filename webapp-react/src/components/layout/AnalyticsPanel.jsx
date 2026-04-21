// AnalyticsPanel — Panel derecho. Renderiza la ficha contextual del módulo activo.
// En Sprint 2 solo está cableado <CargaEnfermedad/>; los otros dos llegan en Sprint 3.

import { useStore } from '../../store'
import CargaEnfermedad from '../../modules/CargaEnfermedad'

function PlaceholderModule({ name }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-400">
      <div>
        <p className="mb-2 font-medium text-slate-500">{name}</p>
        <p>Disponible en Sprint 3</p>
      </div>
    </div>
  )
}

export default function AnalyticsPanel() {
  const module = useStore(s => s.module)

  return (
    <aside className="flex w-[340px] flex-shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white">
      {module === 'carga'         && <CargaEnfermedad />}
      {module === 'determinantes' && <PlaceholderModule name="Determinantes IA · MGWR" />}
      {module === 'mcda'          && <PlaceholderModule name="Priorización MCDA" />}
    </aside>
  )
}
