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

  // Calcula CAGR (compound annual growth rate) sobre la serie completa.
  // Si la serie es muy corta o el primer/último valor no son válidos,
  // retorna null y omitimos el pill.
  const cagr = (() => {
    if (!hasData || data.length < 2) return null
    const first = Number(data[0][dataKey])
    const last  = Number(data[data.length - 1][dataKey])
    if (!first || !last || first <= 0) return null
    const years = data[data.length - 1].year - data[0].year
    if (years <= 0) return null
    const r = Math.pow(last / first, 1 / years) - 1
    if (!Number.isFinite(r)) return null
    return (r * 100).toFixed(1)
  })()

  // Pill con el año actual: rectangle rojo + texto blanco mono — anclado
  // al ReferenceLine del año seleccionado (Recharts maneja el posicionamiento).
  const yearPillLabel = (props) => {
    const { viewBox } = props
    if (!viewBox) return null
    const x = viewBox.x
    const y = viewBox.y + 2
    return (
      <g>
        <rect x={x - 14} y={y} width={28} height={13} rx={2} fill="#B81D24" />
        <text
          x={x}
          y={y + 9}
          fill="#fff"
          fontSize={9}
          fontWeight={700}
          textAnchor="middle"
          fontFamily="Roboto Mono, monospace"
        >
          {year}
        </text>
      </g>
    )
  }

  return (
    <div className="rounded-[3px] border border-inspi-line bg-inspi-paper">
      {/* CAGR pill en la esquina superior derecha del chart card. */}
      {cagr != null && (
        <div className="flex items-center justify-end border-b border-inspi-line bg-inspi-slate-50 px-2.5 py-1 font-display text-[9.5px] font-semibold text-inspi-muted">
          CAGR{' '}
          <span className={`ml-1 font-mono tnum ${Number(cagr) >= 0 ? 'text-inspi-red' : 'text-inspi-green'}`}>
            {Number(cagr) >= 0 ? '+' : ''}{cagr}%
          </span>
          <span className="ml-1">/año</span>
        </div>
      )}
      <div className="h-[160px] w-full p-1.5">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 22, right: 8, bottom: 2, left: 4 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                <stop offset="100%" stopColor={color} stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 3" stroke="#E2E5EB" vertical={false} />
            <XAxis
              type="number"
              dataKey="year"
              domain={['dataMin', 'dataMax']}
              ticks={data.map(d => d.year)}
              tick={{ fontSize: 9, fill: '#6B7280', fontFamily: 'Roboto Mono, monospace' }}
              axisLine={{ stroke: '#CBD5E1' }}
              tickLine={false}
              allowDecimals={false}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={28}
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#9AA3AE', fontFamily: 'Roboto Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              width={36}
              tickFormatter={fmtY}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11, padding: '4px 8px', borderRadius: 4,
                border: '1px solid #E2E5EB', fontFamily: 'Montserrat, sans-serif',
              }}
              formatter={(v) => [Number(v).toFixed(1), tooltipLabel]}
              labelFormatter={l => `Año ${l}`}
            />
            <ReferenceLine
              x={year}
              stroke="#B81D24"
              strokeWidth={1}
              strokeDasharray="3 2"
              opacity={0.85}
              ifOverflow="extendDomain"
              label={yearPillLabel}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={1.8}
              fill={`url(#${gradId})`}
              dot={(props) => {
                const isSel = props.payload?.year === year
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={isSel ? 3.5 : 1.6}
                    fill={isSel ? color : '#fff'}
                    stroke={color}
                    strokeWidth={1.4}
                  />
                )
              }}
              activeDot={{ r: 4, stroke: color, strokeWidth: 1.6, fill: '#fff' }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {!hasData && (
        <div className="border-t border-inspi-line py-1.5 text-center font-display text-[10px] italic text-inspi-muted">
          Sin datos reales para esta unidad · serie vacía
        </div>
      )}
    </div>
  )
}
