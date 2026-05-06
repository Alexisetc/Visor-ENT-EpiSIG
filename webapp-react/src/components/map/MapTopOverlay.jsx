// MapTopOverlay — Bar contextual sobre el mapa (top): scope geográfico
// + métrica + ENT activa + stats parroquial. Reproduce el diseño del
// Manual v2 (badge navy izquierda + info card derecha + stats).

import { Globe, Layers as LayersIcon, Map as MapIcon, Flame } from 'lucide-react'
import { useStore } from '../../store'
import { ENT_LABEL } from '../../lib/colors'
import { getProvLabel, getParroquiaLabelShort } from '../../lib/parroquia'

export default function MapTopOverlay() {
  const module      = useStore(s => s.module)
  const layerType   = useStore(s => s.layerType)
  const ent         = useStore(s => s.ent)
  const mapMetric   = useStore(s => s.mapMetric)
  const provFilter  = useStore(s => s.provFilter)
  const selectedDpa = useStore(s => s.selectedDpa)
  const selectedProps = useStore(s => s.selectedProps)
  const geoProv     = useStore(s => s.geoProv)
  const geoParr     = useStore(s => s.geoParr)

  // Scope label — adapta el badge según filtro actual
  const scopeLabel = selectedDpa && selectedProps
    ? `Parroquia · ${getParroquiaLabelShort(selectedProps)}`
    : provFilter
      ? `Provincia · ${getProvLabel(provFilter, geoProv)}`
      : 'Ecuador continental'

  // Métrica visible
  const isMort = mapMetric === 'mortalidad'
  const metricLabel =
      module === 'carga' ? `Tasa de ${isMort ? 'mortalidad' : 'morbilidad'}`
    : module === 'determinantes' ? 'Determinante dominante'
    : module === 'mcda' ? 'Priorización MCDA'
    : ''

  const LayerIcon = layerType === 'heatmap' ? Flame : MapIcon

  // Stats parroquial (solo a nivel nacional para no abrumar)
  const totalParr = geoParr?.features?.length ?? 0
  const totalProv = geoProv?.features?.length ?? 0
  const showStats = !provFilter && !selectedDpa && totalParr > 0

  return (
    <div className="pointer-events-none absolute left-3 right-[60px] top-3 z-[450] flex items-start justify-between gap-3">
      {/* === Badge scope geográfico (izquierda) === */}
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-[3px] border border-inspi-navy bg-inspi-navy px-2.5 py-1.5 font-display text-[11px] font-bold uppercase tracking-[0.07em] text-white shadow-md">
        <Globe size={12} strokeWidth={2.4} />
        <span className="truncate max-w-[260px]">{scopeLabel}</span>
      </div>

      {/* === Info card métrica + ENT + stats (centro/derecha) === */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
        {showStats && (
          <div className="flex items-center gap-1.5 rounded-[3px] border border-inspi-line bg-white/95 px-2.5 py-1 font-display text-[10.5px] font-medium text-inspi-muted shadow-sm">
            <span className="block h-2 w-2 rounded-full bg-inspi-green" />
            <span className="font-mono tnum text-inspi-navy">{totalParr.toLocaleString('es')}</span>
            <span>parroquias</span>
            <span className="text-inspi-line">·</span>
            <span className="font-mono tnum text-inspi-navy">{totalProv}</span>
            <span>provincias</span>
            <span className="text-inspi-line">·</span>
            <span>CPV 2022</span>
          </div>
        )}
        <div className="rounded-[3px] border border-inspi-line bg-white/95 px-2.5 py-1 leading-tight shadow-sm">
          <div className="flex items-center gap-1.5 font-display text-[10px] font-medium text-inspi-muted">
            <LayerIcon size={10} strokeWidth={2.2} className="text-inspi-red" />
            <span className="truncate">{metricLabel}</span>
          </div>
          <div className="font-display text-[11.5px] font-semibold text-inspi-navy">
            {ENT_LABEL[ent]}
            <span className="ml-1.5 font-mono text-[9.5px] font-normal text-inspi-muted tnum">
              {ent === 'circulatorio' ? 'I00-I99' :
               ent === 'neoplasia'    ? 'C00-D48' :
               ent === 'metabolica'   ? 'E00-E90' :
               ent === 'respiratorio' ? 'J00-J99' :
               ent === 'nervioso'     ? 'G00-G99' : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
