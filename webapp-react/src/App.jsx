// App.jsx — Sprint 1: scaffold mínimo que verifica carga de datasets.
// El layout completo (Header + Sidebar + MapView + AnalyticsPanel) llega en Sprint 2.

import { useStore } from './store'
import { useDataLoader } from './hooks/useDataLoader'
import { Activity, Loader2, MapPin } from 'lucide-react'

function StatusPill({ label, count, ready }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
      ready ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-slate-200 bg-slate-50 text-slate-500'
    }`}>
      <span className={`inline-block h-2 w-2 rounded-full ${ready ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      <span className="font-medium">{label}</span>
      {ready && <span className="ml-auto font-mono text-xs text-slate-600">{count}</span>}
    </div>
  )
}

export default function App() {
  useDataLoader()

  const loading  = useStore(s => s.loading)
  const error    = useStore(s => s.error)
  const entData  = useStore(s => s.entData)
  const pobData  = useStore(s => s.pobData)
  const geoParr  = useStore(s => s.geoParr)
  const geoProv  = useStore(s => s.geoProv)
  const mcdaData = useStore(s => s.mcdaData)
  const mgwrData = useStore(s => s.mgwrData)
  const detData  = useStore(s => s.detData)

  return (
    <div className="min-h-screen">
      <header className="bg-inspi-navy text-white shadow-panel">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-inspi-yellow text-inspi-navy">
            <Activity size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">EpiSIG · Visor ENT</h1>
            <p className="text-xs text-slate-300">Sistema de Vigilancia Espacial · INSPI Ecuador</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-300">
            <MapPin size={14} /> Sprint 1 · Capa de datos
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {loading && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm font-medium">Cargando 7 datasets desde /assets/...</span>
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
            <p className="text-sm font-semibold">Error de carga</p>
            <p className="font-mono text-xs">{error}</p>
            <p className="mt-2 text-xs">
              Verifica que el servidor legacy <code>python -m http.server 8000</code> esté corriendo
              en <code>webapp/</code>, o que <code>webapp/assets/</code> existan los JSONs.
            </p>
          </div>
        )}

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Estado de datasets
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <StatusPill label="Egresos ENT 2013-2023"
                        count={entData ? `${Object.keys(entData.parroquias || {}).length} parroquias` : '—'}
                        ready={!!entData} />
            <StatusPill label="Población CPV 2022"
                        count={pobData ? `${Object.keys(pobData.poblacion || {}).length} parroquias` : '—'}
                        ready={!!pobData} />
            <StatusPill label="Polígonos parroquias"
                        count={geoParr ? `${(geoParr.features || []).length} features` : '—'}
                        ready={!!geoParr} />
            <StatusPill label="Polígonos provincias"
                        count={geoProv ? `${(geoProv.features || []).length} features` : '—'}
                        ready={!!geoProv} />
            <StatusPill label="MCDA priorización"
                        count={mcdaData ? `${Object.keys(mcdaData.parroquias || {}).length} parroquias` : '—'}
                        ready={!!mcdaData} />
            <StatusPill label="MGWR β locales"
                        count={mgwrData ? `${Object.keys(mgwrData.parroquias || {}).length} parroquias` : '—'}
                        ready={!!mgwrData} />
            <StatusPill label="Determinantes"
                        count={detData ? `${Object.keys(detData.parroquias || {}).length} parroquias` : '—'}
                        ready={!!detData} />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-panel">
          <h2 className="mb-2 text-base font-semibold text-inspi-navy">Sprint 1 completado</h2>
          <p className="text-sm text-slate-600">
            Capa de datos y librerías base portadas desde el visor legacy. Sprint 2 traerá el
            layout tri-pane con mapa Leaflet, selectores y módulo <strong>Carga de Enfermedad</strong>.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs text-slate-600">
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-700">lib/</p>
              <p className="mt-1">colors · parroquia · rates · quintiles</p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-700">hooks/</p>
              <p className="mt-1">useDataLoader · usePlay</p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-700">store</p>
              <p className="mt-1">zustand · 11 piezas de estado · 7 datasets</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
