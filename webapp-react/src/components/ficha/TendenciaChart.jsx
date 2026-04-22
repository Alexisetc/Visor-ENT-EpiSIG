// TendenciaChart — AreaChart Recharts con la serie 2013→2024 COMPLETA para
// la unidad seleccionada (parroquia, provincia agregada o nacional).
//
// Una sola serie, elegida por el prop `metric` (que sigue al toggle global
// "Métrica del mapa"):
//   · morbilidad → rate     (egresos /100k)   · color del grupo ENT
//   · mortalidad → mortRate (defunciones /100k) · color rose-700
//
// Antes se dibujaban ambas simultáneamente, pero el usuario pidió que el
// panel derecho refleje UNA sola métrica a la vez (la del toggle) para no
// confundir lectores.
//
// La línea vertical punteada amarilla indica el año actualmente seleccionado
// y NO corta la serie: siempre se muestran los 12 años.

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from 'recharts'
import { ENT_COLOR } from '../../lib/colors'

export default function TendenciaChart({ series, disease, year, metric = 'morbilidad' }) {
  const data = series && series.length ? series : []
  const isMort = metric === 'mortalidad'

  // Color: grupo ENT para morbilidad, rose-700 para mortalidad
  const color = isMort ? '#be123c' : (ENT_COLOR[disease] || '#1a1b4a')
  const dataKey = isMort ? 'mortRate' : 'rate'
  const tooltipLabel = isMort ? 'Mortalidad /100k' : 'Morbilidad Hosp. /100k'
  const gradId = `g-${disease}-${metric}`

  const hasData = data.some(d => (d[dataKey] || 0) > 0)

  // Formateo compacto para tick del YAxis (325 → 325, 1250 → 1.3K, 12500 → 12K)
  const fmtY = (v) => {
    if (v == null) return ''
    const n = Number(v)
    if (Math.abs(n) >= 10000) return `${Math.round(n / 1000)}K`
    if (Math.abs(n) >= 1000)  return `${(n / 1000).toFixed(1)}K`
    return String(Math.round(n))
  }

  return (
    <div className="rounded border border-slate-200 bg-white p-2">
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 22, right: 14, bottom: 2, left: 4 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.55} />
                <stop offset="100%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" vertical={false} />
            <XAxis
              type="number"
              dataKey="year"
              domain={['dataMin', 'dataMax']}
              ticks={data.map(d => d.year)}
              tick={{ fontSize: 9, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
              allowDecimals={false}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={32}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={fmtY}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: `1px solid ${color}` }}
              formatter={(v) => [Number(v).toFixed(1), tooltipLabel]}
              labelFormatter={l => `Año ${l}`}
            />
            <ReferenceLine
              x={year}
              stroke="#fbc400"
              strokeWidth={2.5}
              strokeDasharray="4 3"
              ifOverflow="extendDomain"
              label={{
                value: String(year),
                position: 'insideTopRight',
                fill: '#d97706',
                fontSize: 10,
                fontWeight: 700,
                offset: 4,
              }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2.2}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={{ r: 3.5, stroke: color, strokeWidth: 1.5, fill: '#fff' }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {!hasData && (
        <div className="mt-1 text-center text-[10px] italic text-slate-400">
          Sin datos reales para esta unidad · serie vacía
        </div>
      )}
    </div>
  )
}
