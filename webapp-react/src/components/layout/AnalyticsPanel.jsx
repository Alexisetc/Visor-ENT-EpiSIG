// AnalyticsPanel — Panel derecho. Renderiza la ficha contextual del módulo activo.
// Los tres módulos analíticos están cableados:
//   · carga         → Carga de Enfermedad (egresos + mortalidad INEC 2013-2024)
//   · determinantes → Determinantes IA (MGWR β locales + 7 determinantes)
//   · mcda          → Priorización MCDA (ranking ponderado 6 criterios)

import { useStore } from '../../store'
import CargaEnfermedad   from '../../modules/CargaEnfermedad'
import DeterminantesIA   from '../../modules/DeterminantesIA'
import PriorizacionMCDA  from '../../modules/PriorizacionMCDA'

export default function AnalyticsPanel() {
  const module = useStore(s => s.module)

  return (
    <aside className="flex w-[340px] flex-shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white">
      {module === 'carga'         && <CargaEnfermedad />}
      {module === 'determinantes' && <DeterminantesIA />}
      {module === 'mcda'          && <PriorizacionMCDA />}
    </aside>
  )
}
