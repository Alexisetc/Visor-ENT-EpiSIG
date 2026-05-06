// App.jsx — Layout tri-pane (Header + Sidebar + MapView + AnalyticsPanel)
// con los tres módulos analíticos cableados tras Fase 5 del pipeline Python:
//   · Carga de Enfermedad (coropletas + hot spots + tendencia MK+Sen+FDR)
//   · Determinantes (MGWR βs locales + 7 determinantes parroquiales)
//   · Priorización MCDA (ranking ENT por parroquia, 6 criterios ponderados)
// Serie temporal 2013→2024 (12 años), animable con el Play del YearSlider.

import { useEffect } from 'react'
import { useDataLoader } from './hooks/useDataLoader'
import { useStore } from './store'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import AnalyticsPanel from './components/layout/AnalyticsPanel'
import MapView from './components/map/MapView'
import MetodologiaModal from './components/modals/MetodologiaModal'
import WelcomeModal, { WELCOME_LS_KEY } from './components/modals/WelcomeModal'
import { Loader2 } from 'lucide-react'

export default function App() {
  useDataLoader()
  const loading          = useStore(s => s.loading)
  const error            = useStore(s => s.error)
  const openModal        = useStore(s => s.openModal)
  const sidebarCollapsed = useStore(s => s.sidebarCollapsed)

  // Mostrar bienvenida automáticamente en la primera visita.
  // El usuario puede reabrirla desde el botón "Bienvenida" del Header.
  useEffect(() => {
    try {
      if (!localStorage.getItem(WELCOME_LS_KEY)) openModal('welcome')
    } catch { /* sin localStorage: la mostramos igual una vez por sesión */
      openModal('welcome')
    }
  }, [openModal])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 text-slate-800">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {!sidebarCollapsed && <Sidebar />}

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

      {/* Pie de página institucional — Manual de Diseño v2.
          26 px, fondo bone, separadores "|" en muted. */}
      <footer className="z-30 flex h-[26px] flex-shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-0.5 border-t border-inspi-line bg-inspi-bone px-4 font-display text-[11px] text-inspi-muted">
        <a
          href="https://www.investigacionsalud.gob.ec/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-inspi-navy underline-offset-2 hover:text-inspi-red hover:underline"
        >
          INSPI
        </a>
        <span className="text-inspi-line">|</span>
        <a
          href="https://www.investigacionsalud.gob.ec/webs/episig/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-inspi-navy underline-offset-2 hover:text-inspi-red hover:underline"
        >
          Centro de Investigación EpiSIG
        </a>
        <span className="text-inspi-line">|</span>
        <span>
          Elaborado por:{' '}
          <b className="font-semibold text-inspi-navy">Econ. Alexis Núñez</b>
        </span>
        <span className="text-inspi-line">|</span>
        <span className="font-mono text-[10px] tnum text-inspi-muted">v0.1.0</span>
        <span className="text-inspi-line">·</span>
        <span className="font-display text-[10.5px] font-medium text-inspi-muted">
          Abril {new Date().getFullYear()}
        </span>
      </footer>

      <MetodologiaModal />
      <WelcomeModal />
    </div>
  )
}
