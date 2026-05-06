// Header global — Manual de Diseño v2 (institucional EpiSIG).
// Estructura: [toggle] · [logo+wordmark] · [breadcrumb] · ⟶ [año] [acciones]
// 56 px de alto, fondo navy, barra roja de 2 px al fondo (eco del wordmark).

import { Download, Info, Settings, Sparkles, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useStore } from '../../store'

// Iso EpiSIG: pequeño grid 2×2 de bricks (rojo arriba, navy oscuro abajo).
// Aproximación CSS al logo del manual de marca — fácil de mantener,
// reemplazable por SVG cuando esté el asset definitivo.
function EpiSIGIso() {
  return (
    <div
      className="grid h-7 w-7 grid-cols-2 grid-rows-2 gap-[2px] rounded-[3px] bg-white p-[2px] shadow-sm"
      aria-hidden="true"
    >
      <div className="bg-inspi-red" />
      <div className="bg-inspi-navy" />
      <div className="bg-inspi-navy" />
      <div className="bg-inspi-red" />
    </div>
  )
}

export default function Header() {
  const year             = useStore(s => s.year)
  const openModal        = useStore(s => s.openModal)
  const sidebarCollapsed = useStore(s => s.sidebarCollapsed)
  const toggleSidebar    = useStore(s => s.toggleSidebar)

  return (
    <header className="relative z-30 flex h-14 flex-shrink-0 items-center gap-3 bg-inspi-navy pl-3 pr-4 text-white shadow-md">
      {/* Toggle del panel de configuración — card-style en slate-50 (igual
          que en el screenshot del Manual). */}
      <button
        onClick={toggleSidebar}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded border border-white/20 bg-white/5 text-slate-200 transition hover:bg-white/15 hover:text-white"
        title={sidebarCollapsed ? 'Mostrar panel de configuración' : 'Ocultar panel de configuración'}
        aria-label={sidebarCollapsed ? 'Mostrar panel de configuración' : 'Ocultar panel de configuración'}
        aria-expanded={!sidebarCollapsed}
      >
        {sidebarCollapsed
          ? <PanelLeftOpen size={16} strokeWidth={2.2} />
          : <PanelLeftClose size={16} strokeWidth={2.2} />}
      </button>

      {/* === Cluster: logo + wordmark + barra roja + breadcrumb === */}
      <div className="flex items-center gap-3 rounded border border-white/10 bg-white/5 px-2.5 py-1">
        <EpiSIGIso />
        <div className="font-display text-base font-bold leading-none tracking-tight text-white">
          <span className="text-inspi-red">Epi</span>SIG
        </div>
      </div>

      {/* Barra roja vertical 2px (eco del wordmark) */}
      <div className="h-7 w-[2px] flex-shrink-0 bg-inspi-red" />

      {/* Breadcrumb / título del visor */}
      <div className="min-w-0 leading-tight">
        <div className="truncate font-display text-[14px] font-semibold text-white">
          Visor ENT · Ecuador
        </div>
        <div className="truncate font-display text-[10px] font-medium uppercase tracking-[0.07em] text-slate-300">
          INSPI · Sistema de Información Geográfica Epidemiológica
        </div>
      </div>

      {/* === Acciones a la derecha === */}
      <div className="ml-auto flex items-center gap-2">
        {/* Año + Semana epidemiológica — card mono */}
        <div className="flex items-center gap-2 rounded border border-white/15 bg-white/5 px-2.5 py-1">
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-300">
            Año
          </span>
          <span className="font-mono text-[18px] font-bold leading-none text-white tnum">
            {year}
          </span>
          <span className="h-4 w-px bg-white/20" />
          <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-300 tnum">
            SE 14
          </span>
        </div>

        <HeaderButton
          onClick={() => openModal('welcome')}
          icon={Sparkles}
          label="Bienvenida"
          title="Mostrar mensaje de bienvenida"
        />
        <HeaderButton
          onClick={() => openModal('metodologia')}
          icon={Info}
          label="Metodología"
          title="Metodología y fuentes"
        />
        <HeaderButton
          icon={Download}
          label="Exportar"
          title="Exportar PDF/CSV — función en desarrollo, aún no implementada"
          wip
        />
        <HeaderButton
          icon={Settings}
          title="Configuración — función en desarrollo, aún no implementada"
          aria-label="Configuración (en desarrollo)"
          wip
          iconOnly
        />
      </div>

      {/* Bottom red bar — eco del isotipo (2px) */}
      <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-inspi-red" />
    </header>
  )
}

// Botón uniforme del header. Acepta el flag `wip` para marcar como
// "en desarrollo" (deshabilitado + pill rojo).
function HeaderButton({ icon: Icon, label, title, onClick, wip = false, iconOnly = false, ...rest }) {
  if (wip) {
    return (
      <button
        disabled
        title={title}
        className={`relative flex cursor-not-allowed items-center gap-1.5 rounded px-2.5 py-1.5 font-display text-[12px] font-medium text-slate-400 opacity-80 ${iconOnly ? 'p-1.5' : ''}`}
        {...rest}
      >
        <Icon size={14} strokeWidth={2.2} />
        {!iconOnly && <span>{label}</span>}
        {!iconOnly && (
          <span className="ml-0.5 rounded bg-white/10 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.07em] text-slate-300">
            En desarrollo
          </span>
        )}
        {iconOnly && (
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-inspi-amber ring-2 ring-inspi-navy" />
        )}
      </button>
    )
  }
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-1.5 rounded px-2.5 py-1.5 font-display text-[12px] font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
      {...rest}
    >
      <Icon size={14} strokeWidth={2.2} />
      <span>{label}</span>
    </button>
  )
}
