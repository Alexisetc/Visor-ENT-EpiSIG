// TendenciaChart — AreaChart Recharts con la serie 2013→2023 COMPLETA para
// la unidad seleccionada (parroquia, provincia agregada o nacional).
//
// Recibe `series: [{year, rate, mortRate}]` y dibuja dos líneas:
//   · rate      (morbilidad hospitalaria — egresos /100k)  → color del grupo ENT
//   · mortRate  (mortalidad — muertes /100k)               → inspi-navy
//
// La línea vertical punteada indica el año actualmente seleccionado y NO corta
// la serie: siempre se muestran los 11 años.

import {
  AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Legend,
} from 'recharts'
import { ENT_COLOR } from '../../lib/colors'

export default function TendenciaChart({ series, disease, year }) {
  const data = series && series.length ? series : []
  const color = ENT_COLOR[disease] || '#1a1b4a'
  const gradId = `g-${disease}`
  const hasData = data.some(d => d.rate > 0 || d.mortRate > 0)

  return (
    <div className="rounded border border-slate-200 bg-white p-2">
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 10, bottom: 2, left: -16 }}>
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
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={32} />
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
            <Area
              type="monotone"
              dataKey="rate"
              name="rate"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={{ r: 3.5, stroke: color, strokeWidth: 1.5, fill: '#fff' }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="mortRate"
              name="mortRate"
              stroke="#1a1b4a"
              strokeWidth={1.8}
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
              formatter={(v) => v === 'rate' ? 'Morbilidad hospitalaria' : v === 'mortRate' ? 'Mortalidad' : v}
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
