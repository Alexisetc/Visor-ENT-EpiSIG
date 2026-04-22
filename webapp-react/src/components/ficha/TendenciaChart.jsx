// TendenciaChart — AreaChart Recharts con la serie 2013→2024 COMPLETA para
// la unidad seleccionada (parroquia, provincia agregada o nacional).
//
// Recibe `series: [{year, rate, mortRate}]` y dibuja DOS series (morbilidad
// hospitalaria + mortalidad) con dos ejes Y independientes para que la más
// pequeña (típicamente mortalidad /100k ≈ 5-50 vs morbilidad ≈ 50-500) no
// quede aplastada contra el eje X.
//
// El prop `metric` (controlado por el toggle "Métrica del mapa") decide cuál
// es la PRINCIPAL: se dibuja como Area rellena con el color del grupo ENT; la
// otra queda como Line punteada en inspi-navy para comparación visual.
//
// La línea vertical punteada indica el año actualmente seleccionado y NO corta
// la serie: siempre se muestran los 12 años.

import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Legend,
} from 'recharts'
import { ENT_COLOR } from '../../lib/colors'

export default function TendenciaChart({ series, disease, year, metric = 'morbilidad' }) {
  const data = series && series.length ? series : []
  const color = ENT_COLOR[disease] || '#1a1b4a'
  const gradId = `g-${disease}`
  const hasData = data.some(d => d.rate > 0 || d.mortRate > 0)
  const isMort = metric === 'mortalidad'

  // Primary = métrica activa; Secondary = la otra
  const primary   = isMort
    ? { key: 'mortRate', label: 'Mortalidad /100k',          axisId: 'mort' }
    : { key: 'rate',     label: 'Morbilidad Hosp. /100k',    axisId: 'morb' }
  const secondary = isMort
    ? { key: 'rate',     label: 'Morbilidad Hosp. /100k',    axisId: 'morb' }
    : { key: 'mortRate', label: 'Mortalidad /100k',          axisId: 'mort' }

  return (
    <div className="rounded border border-slate-200 bg-white p-2">
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 2, left: -16 }}>
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
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
              allowDecimals={false}
            />
            {/* Dos YAxis: morbilidad a la izquierda, mortalidad a la derecha.
                Cada uno con su propio dominio para que ambas series se vean
                completas sin importar la diferencia de escala. */}
            <YAxis
              yAxisId="morb"
              orientation="left"
              tick={{ fontSize: 9, fill: isMort ? '#94a3b8' : color }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <YAxis
              yAxisId="mort"
              orientation="right"
              tick={{ fontSize: 9, fill: isMort ? color : '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: `1px solid ${color}` }}
              formatter={(v, n) => {
                if (n === 'rate')     return [Number(v).toFixed(1), 'Morbilidad Hosp. /100k']
                if (n === 'mortRate') return [Number(v).toFixed(1), 'Mortalidad /100k']
                return [v, n]
              }}
              labelFormatter={l => `Año ${l}`}
            />
            <ReferenceLine
              yAxisId={primary.axisId}
              x={year}
              stroke="#fbc400"
              strokeWidth={2.5}
              strokeDasharray="4 3"
              ifOverflow="extendDomain"
              label={{
                value: String(year),
                position: 'top',
                fill: '#d97706',
                fontSize: 10,
                fontWeight: 700,
              }}
            />

            {/* Serie PRINCIPAL → Area rellena, color del grupo */}
            <Area
              yAxisId={primary.axisId}
              type="monotone"
              dataKey={primary.key}
              name={primary.key}
              stroke={color}
              strokeWidth={2.2}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={{ r: 3.5, stroke: color, strokeWidth: 1.5, fill: '#fff' }}
              isAnimationActive={false}
            />

            {/* Serie SECUNDARIA → Line fina punteada inspi-navy */}
            <Line
              yAxisId={secondary.axisId}
              type="monotone"
              dataKey={secondary.key}
              name={secondary.key}
              stroke="#1a1b4a"
              strokeWidth={1.6}
              strokeDasharray="3 2"
              dot={false}
              activeDot={{ r: 3, stroke: '#1a1b4a', strokeWidth: 1.5, fill: '#fff' }}
              isAnimationActive={false}
            />

            <Legend
              verticalAlign="bottom"
              height={18}
              iconSize={8}
              wrapperStyle={{ fontSize: 10, paddingTop: 2 }}
              formatter={(v) => {
                const isPrim = v === primary.key
                const label = v === 'rate'
                  ? 'Morbilidad hospitalaria'
                  : v === 'mortRate' ? 'Mortalidad' : v
                return isPrim ? `${label} (principal)` : label
              }}
            />
          </ComposedChart>
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
