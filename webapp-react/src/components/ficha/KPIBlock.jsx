// KPIBlock — tarjeta de un solo indicador con variación interanual (YoY).
// Se usa para mostrar Prevalencia y Mortalidad por separado en el módulo Carga
// de Enfermedad.
//   · title     'Tasa Est. Prevalencia' | 'Tasa de Mortalidad' …
//   · value     número (la tasa del año actual)
//   · prev      número (tasa del año anterior) · opcional
//   · prevYear  etiqueta numérica para mostrar en el delta ('2022' → "↑ 12% vs 2022")
//   · unit      'por 100k hab.'
//   · casos / muertes / pob  · opcional — grid inferior con conteos

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { deltaYoY } from '../../lib/trend'

export default function KPIBlock({
  title, value, prev, prevYear, unit = 'por 100k hab.',
  casos, muertes, pob, real = true, accent = 'navy',
}) {
  const delta = deltaYoY(value, prev)
  const accentColor = accent === 'red' ? 'text-rose-600' : 'text-inspi-navy'

  // Colores del delta: subida = rojo (peor) para mort/prev, bajada = verde
  const deltaColor =
    !delta || delta.dir === 'flat' ? 'text-slate-400'
    : delta.dir === 'up'            ? 'text-rose-600'
    :                                  'text-emerald-600'

  const DeltaIcon =
    !delta || delta.dir === 'flat' ? Minus
    : delta.dir === 'up'            ? TrendingUp
    :                                  TrendingDown

  return (
    <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <div className={`font-display text-3xl font-bold leading-none ${accentColor}`}>
          {Number.isFinite(value) ? value.toFixed(1) : '—'}
        </div>
        <div className="text-[10px] text-slate-400">{unit}</div>
      </div>

      {delta ? (
        <div className={`mt-1.5 flex items-center gap-1 text-[11px] font-semibold ${deltaColor}`}>
          <DeltaIcon size={12} strokeWidth={2.5} />
          <span>
            {delta.dir === 'flat' ? 'sin cambio' : `${Math.abs(delta.pct)}%`}
            {prevYear !== undefined && prevYear !== null && (
              <span className="ml-1 font-normal text-slate-400">vs {prevYear}</span>
            )}
          </span>
        </div>
      ) : (
        <div className="mt-1.5 text-[10px] italic text-slate-300">— sin año base —</div>
      )}

      {(casos > 0 || muertes > 0 || pob > 0) && (
        <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 text-center">
          <div>
            <div className="font-mono text-sm font-semibold text-slate-700">
              {Number(casos || 0).toLocaleString('es')}
            </div>
            <div className="text-[9px] uppercase text-slate-400">Casos</div>
          </div>
          <div>
            <div className="font-mono text-sm font-semibold text-slate-700">
              {Number(muertes || 0).toLocaleString('es')}
            </div>
            <div className="text-[9px] uppercase text-slate-400">Muertes</div>
          </div>
          <div>
            <div className="font-mono text-sm font-semibold text-slate-700">
              {Number(pob || 0).toLocaleString('es')}
            </div>
            <div className="text-[9px] uppercase text-slate-400">Pobl.</div>
          </div>
        </div>
      )}

      {!real && (
        <div className="mt-1 text-[9px] italic text-amber-600">simulación</div>
      )}
    </div>
  )
}
