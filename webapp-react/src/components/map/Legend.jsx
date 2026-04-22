// Legend — Leyenda flotante bottom-left. Cambia según módulo + layerType:
//
//   module='carga' + layer='coropleta'         → 5 swatches por quintil (paleta ENT)
//                  + layer='heatmap' (hot-spot)→ bipolar RdBu + tamaño |z|, puntos en centroides
//   module='determinantes' + layer='coropleta' → 7 swatches categóricos (DET_COLOR)
//                          + layer='heatmap'   → bipolar RdBu (vulnerabilidad) en centroides
//   module='mcda' + layer='coropleta'          → 5 swatches categóricos (ENT_COLOR)
//                 + layer='heatmap'            → bipolar RdBu (score MCDA) en centroides
//
// Nota: en modo hot-spot (puntos) el color refleja la dirección del z-score
// (cold-spot azul / hot-spot rojo) y el tamaño del círculo la magnitud (|z|).
// Parroquias con valor 0 o sin dato se omiten tanto del cálculo como del mapa.

import { useMemo } from 'react'
import { useStore } from '../../store'
import {
  ENT_LABEL, ENT_COLOR, ENTS,
  DET_COLOR, DET_LABEL, DETS,
  colorScales, TURBO_LUT,
} from '../../lib/colors'
import { computeQuintiles } from '../../lib/quintiles'

function fmt(n) { return n >= 100 ? Math.round(n) : Number(n.toFixed(1)) }

export default function Legend() {
  const module    = useStore(s => s.module)
  const layerType = useStore(s => s.layerType)
  const ent       = useStore(s => s.ent)
  const year      = useStore(s => s.year)
  const mapMetric = useStore(s => s.mapMetric)
  const geoParr   = useStore(s => s.geoParr)
  const entData   = useStore(s => s.entData)
  const pobData   = useStore(s => s.pobData)

  const isHot  = layerType === 'heatmap'
  const isMort = mapMetric === 'mortalidad'

  // Título de la leyenda según módulo + layer
  const title =
    isHot && module === 'carga'         ? `Hot-spot tasa ${isMort ? 'mortalidad' : 'morbilidad'} · ${ENT_LABEL[ent]}`
  : isHot && module === 'determinantes' ? 'Hot-spot vulnerabilidad (determinantes)'
  : isHot && module === 'mcda'          ? 'Hot-spot score MCDA total'
  : module === 'carga'                  ? `Tasa ${isMort ? 'mortalidad' : 'morbilidad'} /100k · ${ENT_LABEL[ent]}`
  : module === 'determinantes'          ? `Determinante dominante · ${ENT_LABEL[ent]}`
  : module === 'mcda'                   ? 'ENT prioritaria #1 (MCDA)'
  :                                       ''

  // Quintiles solo aplican a módulo carga + coropleta
  const limits = useMemo(
    () => (module === 'carga' && !isHot)
      ? computeQuintiles(ent, year, geoParr, entData, pobData, mapMetric)
      : [0, 0, 0, 0],
    [module, isHot, ent, year, geoParr, entData, pobData, mapMetric]
  )

  const scaleCarga = colorScales[ent] || colorScales.todas

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] max-w-[320px] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
      <div className="mb-1 font-display text-[11px] font-semibold uppercase tracking-wider text-inspi-navy">
        {title}
      </div>

      {/* ===== Modo HOT-SPOT (KDE continuo + paleta Turbo) — 3 módulos ===== */}
      {isHot && (
        <div>
          {/* Gradiente Turbo continuo (64 stops para transición suave) */}
          <div className="flex h-3 w-full overflow-hidden rounded-sm">
            {Array.from({ length: 64 }, (_, i) => {
              const lutIdx = Math.floor((i / 63) * 255) * 3
              const bg = `rgb(${TURBO_LUT[lutIdx]},${TURBO_LUT[lutIdx + 1]},${TURBO_LUT[lutIdx + 2]})`
              return <div key={i} className="h-full flex-1" style={{ background: bg }} />
            })}
          </div>
          <div className="mt-0.5 flex justify-between font-mono text-[9px] text-slate-500">
            <span>Muy bajo</span>
            <span>Medio</span>
            <span>Muy alto</span>
          </div>
          <div className="mt-0.5 flex justify-between font-mono text-[9px] text-slate-400">
            <span>p2</span>
            <span>mediana</span>
            <span>p98</span>
          </div>
          <div className="mt-1 text-[9px] italic text-slate-500">
            KDE gaussiano sobre centroides · normalización p2-p98 · paleta Turbo · excluye valores 0
          </div>
        </div>
      )}

      {/* ===== CARGA + COROPLETA: quintiles tasa /100k ===== */}
      {!isHot && module === 'carga' && (
        <div className="flex items-center gap-1">
          {scaleCarga.map((c, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="h-3 w-7" style={{ background: c }} />
              <div className="mt-0.5 font-mono text-[9px] text-slate-500">
                {i === 0 ? `<${fmt(limits[0])}`
                  : i === scaleCarga.length - 1 ? `>${fmt(limits[3])}`
                  : `${fmt(limits[i - 1])}–${fmt(limits[i])}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== DETERMINANTES + COROPLETA: 7 swatches categóricos ===== */}
      {!isHot && module === 'determinantes' && (
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          {DETS.concat('nbi').filter((v, i, a) => a.indexOf(v) === i).map(d => (
            <div key={d} className="flex items-center gap-1.5">
              <div className="h-3 w-5 flex-shrink-0 rounded-sm" style={{ background: DET_COLOR[d] || '#94a3b8' }} />
              <div className="truncate text-[10px] text-slate-600">{DET_LABEL[d] || d}</div>
            </div>
          ))}
          <div className="col-span-2 mt-0.5 text-[9px] italic text-slate-500">
            Color = determinante con mayor |β| MGWR
          </div>
        </div>
      )}

      {/* ===== MCDA + COROPLETA: 5 swatches categóricos por ENT ===== */}
      {!isHot && module === 'mcda' && (
        <div className="grid grid-cols-1 gap-y-0.5">
          {ENTS.map(e => (
            <div key={e} className="flex items-center gap-1.5">
              <div className="h-3 w-5 flex-shrink-0 rounded-sm" style={{ background: ENT_COLOR[e] }} />
              <div className="truncate text-[10px] text-slate-600">{ENT_LABEL[e]}</div>
            </div>
          ))}
          <div className="mt-0.5 text-[9px] italic text-slate-500">
            Color = ENT ranking #1 por parroquia
          </div>
        </div>
      )}
    </div>
  )
}
