// KPIBlock — Tarjeta KPI institucional (Manual de Diseño v2).
// Borde superior rojo de 2 px (eco del wordmark), número grande en mono
// con tabular-nums, delta YoY con flecha, píldora de tendencia MK+Sen+FDR.
//
// Convención de colores (métricas de salud: subir es malo):
//   · Ascendente  → rojo (inspi-red)
//   · Descendente → verde (inspi-green)
//   · Estable     → muted

import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight, MoveRight } from 'lucide-react'
import { deltaYoY } from '../../lib/trend'

export default function KPIBlock({
  title, value, prev, prevYear, unit = '/100k',
  real = true,
  trend,
}) {
  const delta = deltaYoY(value, prev)

  const deltaColor =
    !delta || delta.dir === 'flat' ? 'text-inspi-muted'
    : delta.dir === 'up'            ? 'text-inspi-red'
    :                                  'text-inspi-green'

  const DeltaIcon =
    !delta || delta.dir === 'flat' ? Minus
    : delta.dir === 'up'            ? TrendingUp
    :                                  TrendingDown

  // Píldora de tendencia (MK+Sen+FDR)
  const trendStyles = {
    up:   'border-inspi-red/30    bg-inspi-red/5    text-inspi-red',
    down: 'border-inspi-green/30  bg-inspi-green/5  text-inspi-green',
    flat: 'border-inspi-line      bg-inspi-bone     text-inspi-muted',
  }
  const TrendIcon = !trend?.valid ? null
    : trend.dir === 'up'   ? ArrowUpRight
    : trend.dir === 'down' ? ArrowDownRight
    :                         MoveRight

  return (
    <div className="relative rounded-[3px] border border-inspi-line bg-white p-2.5 shadow-sm">
      {/* Borde superior rojo 2 px (acento brand). */}
      <span className="absolute left-0 right-0 top-0 h-[2px] bg-inspi-red" />

      <div className="font-display text-[10px] font-semibold uppercase tracking-[0.07em] text-inspi-muted">
        {title}
      </div>

      <div className="mt-1 flex items-baseline gap-1">
        <div className="font-mono text-[26px] font-bold leading-none text-inspi-navy tnum">
          {Number.isFinite(value) ? value.toFixed(0) : '—'}
        </div>
        <div className="font-mono text-[10px] font-medium text-inspi-muted tnum">{unit}</div>
      </div>

      {delta ? (
        <div className={`mt-1 flex items-center gap-1 font-display text-[11px] font-semibold ${deltaColor}`}>
          <DeltaIcon size={11} strokeWidth={2.5} />
          <span>
            {delta.dir === 'flat' ? 'sin cambio' : `${Math.abs(delta.pct)}%`}
            {prevYear !== undefined && prevYear !== null && (
              <span className="ml-1 font-normal text-inspi-muted">vs {prevYear}</span>
            )}
          </span>
        </div>
      ) : (
        <div className="mt-1 font-display text-[10px] italic text-inspi-muted">— sin año base —</div>
      )}

      {/* Píldora de tendencia estadística (Mann-Kendall + Sen + FDR) */}
      {trend?.valid && TrendIcon && (
        <div className="mt-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 font-display text-[10px] font-semibold ${trendStyles[trend.dir]}`}
            title={
              (trend.pValue != null
                ? `p(FDR)=${trend.pValue < 0.001 ? '<0.001' : trend.pValue.toFixed(3)}`
                : 'p=n/a') +
              (trend.tau != null ? ` · τ=${Number(trend.tau).toFixed(2)}` : '') +
              (trend.n ? ` · n=${trend.n}` : '')
            }
          >
            MK <TrendIcon size={9} strokeWidth={2.6} />
            <span className="font-mono font-medium tnum">
              {trend.annualPct >= 0 ? '+' : ''}{trend.annualPct}%/año
            </span>
          </span>
        </div>
      )}

      {!real && (
        <div className="mt-1 font-display text-[9px] italic text-inspi-amber">simulación</div>
      )}
    </div>
  )
}
