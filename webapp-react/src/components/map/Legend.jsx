// Legend — Leyenda flotante bottom-left. Cambia según layerType:
//   coropleta → 5 swatches por quintil (paleta del ENT actual)
//   heatmap   → gradient YlOrRd con stops principales

import { useMemo } from 'react'
import { useStore } from '../../store'
import { ENT_LABEL, colorScales, GRADIENT_QGIS } from '../../lib/colors'
import { computeQuintiles } from '../../lib/quintiles'

function fmt(n) { return n >= 100 ? Math.round(n) : Number(n.toFixed(1)) }

export default function Legend() {
  const layerType = useStore(s => s.layerType)
  const ent       = useStore(s => s.ent)
  const year      = useStore(s => s.year)
  const geoParr   = useStore(s => s.geoParr)
  const entData   = useStore(s => s.entData)
  const pobData   = useStore(s => s.pobData)

  const limits = useMemo(
    () => computeQuintiles(ent, year, geoParr, entData, pobData),
    [ent, year, geoParr, entData, pobData]
  )

  const scale = colorScales[ent] || colorScales.todas
  const stops = useMemo(() => {
    return Object.entries(GRADIENT_QGIS)
      .map(([k, v]) => [Number(k), v])
      .sort((a, b) => a[0] - b[0])
  }, [])
  const gradientCss = useMemo(
    () => `linear-gradient(to right, ${stops.map(([k, v]) => `${v} ${(k * 100).toFixed(0)}%`).join(', ')})`,
    [stops]
  )

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
      <div className="mb-1 font-display text-[11px] font-semibold uppercase tracking-wider text-inspi-navy">
        {layerType === 'heatmap'
          ? 'Densidad de casos (KDE)'
          : `Tasa /100k · ${ENT_LABEL[ent]}`}
      </div>

      {layerType === 'coropleta' && (
        <div className="flex items-center gap-1">
          {scale.map((c, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="h-3 w-7" style={{ background: c }} />
              <div className="mt-0.5 font-mono text-[9px] text-slate-500">
                {i === 0 ? `<${fmt(limits[0])}`
                  : i === scale.length - 1 ? `>${fmt(limits[3])}`
                  : `${fmt(limits[i - 1])}–${fmt(limits[i])}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {layerType === 'heatmap' && (
        <div className="w-44">
          <div className="h-3 w-full rounded" style={{ background: gradientCss }} />
          <div className="mt-0.5 flex justify-between font-mono text-[9px] text-slate-500">
            <span>min</span><span>max</span>
          </div>
        </div>
      )}
    </div>
  )
}
