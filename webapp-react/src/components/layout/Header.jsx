// Header global — INSPI brand + año global + acciones (Export, Metodología, Settings)
import { Activity, Download, Info, Settings, Sparkles } from 'lucide-react'
import { useStore } from '../../store'

export default function Header() {
  const year = useStore(s => s.year)
  const openModal = useStore(s => s.openModal)

  return (
    <header className="z-30 flex h-14 items-center gap-3 bg-inspi-navy px-5 text-white shadow-md">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded bg-inspi-yellow text-inspi-navy">
          <Activity size={20} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="font-display text-lg font-semibold leading-tight tracking-tight">
            EpiSIG <span className="text-inspi-yellow">Global Health Platform</span>
          </h1>
          <p className="text-[11px] leading-tight text-slate-300">
            Sistema de Vigilancia Espacial de Precisión · Ecuador Continental
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-2 rounded bg-inspi-navy-2 px-3 py-1.5 text-xs">
          <span className="font-medium uppercase tracking-wider text-slate-300">Año</span>
          <span className="font-mono text-base font-semibold text-inspi-yellow">{year}</span>
        </div>

        <button
          onClick={() => openModal('welcome')}
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-slate-200 hover:bg-inspi-navy-2 hover:text-white"
          title="Mostrar mensaje de bienvenida"
        >
          <Sparkles size={14} /> Bienvenida
        </button>
        <button
          onClick={() => openModal('metodologia')}
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-slate-200 hover:bg-inspi-navy-2 hover:text-white"
          title="Metodología y fuentes"
        >
          <Info size={14} /> Metodología
        </button>
        {/* Exportar y Configuración aún no están implementados. Quedan
            visibles pero deshabilitados, con un pill "en desarrollo" para
            que no parezca que se rompieron — son features planificadas. */}
        <button
          disabled
          className="flex cursor-not-allowed items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-slate-400 opacity-70"
          title="Exportar PDF/CSV — función en desarrollo, aún no implementada"
        >
          <Download size={14} /> Exportar
          <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider text-amber-700">
            en desarrollo
          </span>
        </button>
        <button
          disabled
          className="relative cursor-not-allowed rounded p-1.5 text-slate-400 opacity-70"
          title="Configuración — función en desarrollo, aún no implementada"
          aria-label="Configuración (en desarrollo)"
        >
          <Settings size={16} />
          {/* Punto amber en la esquina = indicador WIP, mismo lenguaje
              visual que el pill "en desarrollo" del botón Exportar. */}
          <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 ring-1 ring-inspi-navy" />
        </button>
      </div>
    </header>
  )
}
