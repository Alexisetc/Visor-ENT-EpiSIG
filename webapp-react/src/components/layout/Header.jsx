// Header global — Manual de Diseño v2 (institucional EpiSIG).
// Estructura: [toggle] · [logo + breadcrumb] · ⟶ [año + acciones]
// 64 px de alto, fondo navy, borde inferior rojo 3 px (eco del wordmark).

import { Download, Info, Settings, Sparkles, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useStore } from '../../store'
import EpiLogo from '../brand/EpiLogo'

export default function Header() {
  const year             = useStore(s => s.year)
  const openModal        = useStore(s => s.openModal)
  const sidebarCollapsed = useStore(s => s.sidebarCollapsed)
  const toggleSidebar    = useStore(s => s.toggleSidebar)

  return (
    <header className="relative z-30 flex h-16 flex-shrink-0 items-center gap-4 border-b-[3px] border-inspi-red bg-inspi-navy px-5 text-white shadow-md">
      {/* Toggle del panel de configuración. */}
      <button
        onClick={toggleSidebar}
        className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[4px] border border-white/20 text-white/85 transition hover:bg-white/10 hover:text-white"
        title={sidebarCollapsed ? 'Mostrar panel de configuración' : 'Ocultar panel de configuración'}
        aria-label={sidebarCollapsed ? 'Mostrar panel de configuración' : 'Ocultar panel de configuración'}
        aria-expanded={!sidebarCollapsed}
      >
        {sidebarCollapsed
          ? <PanelLeftOpen size={16} strokeWidth={2.2} />
          : <PanelLeftClose size={16} strokeWidth={2.2} />}
      </button>

      {/* === Logo institucional EpiSIG + breadcrumb === */}
      <div className="flex items-center gap-3.5">
        <div className="rounded-[4px] bg-white px-2 py-1 shadow-sm">
          <EpiLogo width={108} />
        </div>
        <div className="min-w-0 border-l border-white/20 pl-3.5 leading-tight">
          <div className="truncate font-display text-[14px] font-bold tracking-tight text-white">
            Visor ENT · Ecuador
          </div>
          <div className="mt-0.5 truncate font-display text-[10.5px] font-medium uppercase tracking-[0.08em] text-white/65">
            INSPI · Sistema de Información Geográfica Epidemiológica
          </div>
        </div>
      </div>

      {/* === Acciones a la derecha === */}
      <div className="ml-auto flex items-center gap-2">
        {/* Año + Semana epidemiológica — card mono. */}
        <div className="flex items-center gap-2.5 rounded-[4px] border border-white/12 bg-white/[0.06] px-3 py-1.5">
          <span className="font-display text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/60">
            Año
          </span>
          <span className="font-mono text-[17px] font-bold leading-none text-white tnum tracking-[0.02em]">
            {year}
          </span>
          <span className="h-3.5 w-px bg-white/18" />
          <span className="font-mono text-[10px] font-medium text-white/55 tnum">
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

      {/* Borde inferior rojo 3px se aplica vía border-b en el <header>. */}
    </header>
  )
}

// Botón uniforme del header. Acepta el flag `wip` para marcar como
// "en desarrollo" (deshabilitado + pill rojo).
function HeaderButton({ icon: Icon, label, title, onClick, wip = false, iconOnly = false, ...rest }) {
  if (wip) {
    // Indicador sutil para features "en construcción": el botón se ve
    // deshabilitado (opacidad reducida + cursor-not-allowed) y un punto
    // amber pequeño en la esquina superior derecha indica el WIP. El
    // tooltip explica al hover. No queremos pills llamativos — la idea
    // es que se note solo si el usuario ya está mirando ese botón.
    return (
      <button
        disabled
        title={title}
        className={`relative flex cursor-not-allowed items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 font-display text-[12px] font-medium text-white/45 ${iconOnly ? 'p-2' : ''}`}
        {...rest}
      >
        <Icon size={14} strokeWidth={2.2} />
        {!iconOnly && <span>{label}</span>}
        {/* Punto amber discreto en la esquina superior derecha — mismo
            tratamiento para texto e iconOnly. */}
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-inspi-amber" />
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
