// TendenciaChart — AreaChart Recharts 2013→2023 para la unidad seleccionada.
// Mejora vs legacy: zoom/tooltip activos (Plotly estaba deshabilitado).

import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts'
import { ENT_COLOR } from '../../lib/colors'
import { generateData } from '../../lib/rates'
import { YEARS } from '../../hooks/usePlay'

export default function TendenciaChart({ geoKey, disease, year, entData, pobData }) {
  const data = useMemo(() => {
    return YEARS.map(y => {
      const d = generateData(geoKey, disease, y, entData, pobData)
      return { year: y, tasa: d.rate, casos: d.casos }
    })
  }, [geoKey, disease, entData, pobData])

  const color = ENT_COLOR[disease] || '#1a1b4a'
  const gradId = `g-${disease}`

  return (
    <div className="rounded border border-slate-200 bg-white p-2">
      <div className="h-[140px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 10, bottom: 2, left: -16 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.55} />
                <stop offset="100%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: `1px solid ${color}` }}
              formatter={(v, n) => n === 'tasa' ? [Number(v).toFixed(1), 'Tasa /100k'] : [v, 'Casos']}
              labelFormatter={l => `Año ${l}`}
            />
            <ReferenceLine x={year} stroke="#fbc400" strokeWidth={2} strokeDasharray="3 3" />
            <Area type="monotone" dataKey="tasa" stroke={color} strokeWidth={2} fill={`url(#${gradId})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
