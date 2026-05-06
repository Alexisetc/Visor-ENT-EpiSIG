// Legend — Leyenda flotante bottom-right. Cambia según módulo + layerType:
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

  // Título principal limpio: "TASA · MÉTRICA" (eje izquierdo) + año (eje derecho).
  const titleLeft = isHot
    ? `Hot-spot · ${isMort ? 'Mortalidad' : 'Morbilidad'}`
    : module === 'carga'         ? `Tasa · ${isMort ? 'Mortalidad' : 'Morbilidad'}`
    : module === 'determinantes' ? 'Determinante dominante'
    : module === 'mcda'          ? 'ENT prioritaria #1'
    : ''

  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-[400] w-[300px] max-w-[92vw] rounded-[3px] border border-inspi-line bg-white px-3 py-2 shadow-lg">
      {/* Header con barra roja vertical 3px (eco del wordmark) */}
      <div className="mb-1.5 flex items-center justify-between gap-2 border-l-[3px] border-inspi-red pl-2">
        <div className="font-display text-[11px] font-bold uppercase tracking-[0.07em] text-inspi-navy">
          {titleLeft}
        </div>
        <div className="font-mono text-[11px] font-semibold text-inspi-muted tnum">
          {year}
        </div>
      </div>
      {/* Título contextual menor (módulo concreto) */}
      <div className="mb-1.5 -mt-1 pl-2 font-display text-[9px] font-medium uppercase tracking-[0.07em] text-inspi-muted truncate">
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
            KDE gaussiano · normalización p2-p98 · paleta Turbo (Mikhailov)
          </div>
          {/* Swatch "interpolado IDW" — parroquias sin reporte directo INEC
              (incluye las creadas por decreto CONALI después del año consultado) */}
          <div className="mt-1.5 flex items-center gap-1.5 border-t border-slate-200 pt-1">
            <div
              style={{
                background: 'linear-gradient(90deg,#c7d2fe 0%,#6366f1 100%)',
                opacity: 0.85,
                width: '22px',
                height: '11px',
                flexShrink: 0,
                borderRadius: '2px',
              }}
            />
            <div className="text-[9px] text-slate-500">
              Interpolado · IDW k=5 (sin reporte INEC directo)
            </div>
          </div>
          {/* Swatch "sin dato" — estándar OMS/CDC para insufficient data */}
          <div className="mt-1 flex items-center gap-1.5">
            <div
              style={{
                background: '#e2e8f0',
                border: '1px dashed #94a3b8',
                width: '22px',
                height: '11px',
                flexShrink: 0,
              }}
            />
            <div className="text-[9px] text-slate-500">
              Sin información · pob. CPV 2022 = 0
            </div>
          </div>
        </div>
      )}

      {/* ===== CARGA + COROPLETA: quintiles tasa /100k ===== */}
      {!isHot && module === 'carga' && (
        <>
          <div className="flex items-center gap-px">
            {scaleCarga.map((c, i) => (
              <div key={i} className="flex flex-1 flex-col items-center">
                <div className="h-3 w-full" style={{ background: c }} />
                <div className="mt-0.5 font-mono text-[9.5px] font-medium text-inspi-navy tnum">
                  {i === 0 ? `<${fmt(limits[0])}`
                    : i === scaleCarga.length - 1 ? `>${fmt(limits[3])}`
                    : `${fmt(limits[i - 1])}–${fmt(limits[i])}`}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1 font-display text-[9px] font-semibold uppercase tracking-[0.07em] text-inspi-muted">
            Tasas /100.000 hab · Quintiles · {ENT_LABEL[ent]}
          </div>
          {/* Chips: sin dato + interp. IDW */}
          <div className="mt-1.5 flex items-center gap-3 border-t border-inspi-line pt-1.5">
            <div className="flex items-center gap-1.5">
              <span className="block h-2.5 w-3.5 rounded-[2px] border border-dashed border-inspi-muted bg-inspi-line" />
              <span className="font-display text-[9.5px] font-medium text-inspi-muted">Sin dato</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="block h-2.5 w-3.5 rounded-[2px]"
                style={{ background: 'linear-gradient(90deg,#c7d2fe,#6366f1)' }}
              />
              <span className="font-display text-[9.5px] font-medium text-inspi-muted">Interp. IDW</span>
            </div>
          </div>
        </>
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
