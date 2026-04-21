// Header global — INSPI brand + año global + acciones (Export, Metodología, Settings)
import { Activity, Download, Info, Settings } from 'lucide-react'
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
          onClick={() => openModal('metodologia')}
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-slate-200 hover:bg-inspi-navy-2 hover:text-white"
          title="Metodología y fuentes"
        >
          <Info size={14} /> Metodología
        </button>
        <button
          onClick={() => openModal('export')}
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-slate-200 hover:bg-inspi-navy-2 hover:text-white"
          title="Exportar (próximamente)"
        >
          <Download size={14} /> Exportar
        </button>
        <button className="rounded p-1.5 text-slate-200 hover:bg-inspi-navy-2 hover:text-white"
                title="Configuración">
          <Settings size={16} />
        </button>
      </div>
    </header>
  )
}
