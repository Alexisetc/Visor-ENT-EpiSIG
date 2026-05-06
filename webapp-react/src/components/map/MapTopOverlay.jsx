// MapTopOverlay — Bar contextual sobre el mapa (top): scope geográfico
// (izquierda) + métrica + ENT activa (derecha). Reproduce el badge
// "ECUADOR CONTINENTAL" del Manual v2.

import { Globe, Map as MapIcon, Flame } from 'lucide-react'
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

  const cieByEnt = {
    circulatorio: 'I00-I99',
    neoplasia:    'C00-D48',
    metabolica:   'E00-E90',
    respiratorio: 'J00-J99',
    nervioso:     'G00-G99',
  }

  return (
    <div className="pointer-events-none absolute left-3 right-[60px] top-3 z-[450] flex items-start justify-between gap-3">
      {/* === Badge scope geográfico (izquierda) === */}
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-[3px] border border-inspi-navy bg-inspi-navy px-2.5 py-1.5 font-display text-[11px] font-bold uppercase tracking-[0.07em] text-white shadow-md">
        <Globe size={12} strokeWidth={2.4} />
        <span className="truncate max-w-[260px]">{scopeLabel}</span>
      </div>

      {/* === Info card métrica + ENT (derecha) === */}
      <div className="pointer-events-auto rounded-[3px] border border-inspi-line bg-white/95 px-2.5 py-1 leading-tight shadow-sm">
        <div className="flex items-center gap-1.5 font-display text-[10px] font-medium text-inspi-muted">
          <LayerIcon size={10} strokeWidth={2.2} className="text-inspi-red" />
          <span className="truncate">{metricLabel}</span>
        </div>
        <div className="font-display text-[11.5px] font-semibold text-inspi-navy">
          {ENT_LABEL[ent]}
          {cieByEnt[ent] && (
            <span className="ml-1.5 font-mono text-[9.5px] font-normal text-inspi-muted tnum">
              {cieByEnt[ent]}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
