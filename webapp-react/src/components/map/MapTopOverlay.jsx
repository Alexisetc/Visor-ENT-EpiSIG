// MapTopOverlay — Info card en el top del mapa con la métrica activa
// + grupo ENT seleccionado. (El badge de scope geográfico se removió
// porque repetía la info del header del panel derecho.)

import { Map as MapIcon, Flame } from 'lucide-react'
import { useStore } from '../../store'
import { ENT_LABEL } from '../../lib/colors'

export default function MapTopOverlay() {
  const module      = useStore(s => s.module)
  const layerType   = useStore(s => s.layerType)
  const ent         = useStore(s => s.ent)
  const mapMetric   = useStore(s => s.mapMetric)

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

  // El badge de scope geográfico ("Ecuador continental" / "Provincia · X" /
  // "Parroquia · Y") se removió porque duplicaba info que ya está en el
  // header del panel derecho. Solo queda la info card de métrica + ENT
  // a la derecha del mapa.
  return (
    <div className="pointer-events-none absolute right-[60px] top-3 z-[450] flex items-start justify-end gap-3">
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
