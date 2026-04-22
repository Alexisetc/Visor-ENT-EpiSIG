// App.jsx — Layout tri-pane (Header + Sidebar + MapView + AnalyticsPanel)
// con los tres módulos analíticos cableados tras Fase 5 del pipeline Python:
//   · Carga de Enfermedad (coropletas + hot spots + tendencia MK+Sen+FDR)
//   · Determinantes IA (MGWR βs locales + 7 determinantes parroquiales)
//   · Priorización MCDA (ranking ENT por parroquia, 6 criterios ponderados)
// Serie temporal 2013→2024 (12 años), animable con el Play del YearSlider.

import { useDataLoader } from './hooks/useDataLoader'
import { useStore } from './store'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import AnalyticsPanel from './components/layout/AnalyticsPanel'
import MapView from './components/map/MapView'
import MetodologiaModal from './components/modals/MetodologiaModal'
import { Loader2 } from 'lucide-react'

export default function App() {
  useDataLoader()
  const loading = useStore(s => s.loading)
  const error   = useStore(s => s.error)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 text-slate-800">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="relative flex-1 overflow-hidden">
          <MapView />
          {loading && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-900 shadow">
              <span className="inline-flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                Cargando datasets…
              </span>
            </div>
          )}
          {error && (
            <div className="absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-800 shadow">
              Error de carga: <code className="font-mono">{error}</code>
            </div>
          )}
        </main>

        <AnalyticsPanel />
      </div>

      <MetodologiaModal />
    </div>
  )
}
