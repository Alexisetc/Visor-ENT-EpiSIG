// TendenciaChart — gráfico de tendencia 2013→2024 en SVG inline.
//
// Replica la propuesta de Claude Design: pill rojo del año al TOP del SVG
// (NO detrás de la línea), línea de referencia roja punteada que llega hasta
// el pill, dot grande en el año seleccionado, área degradada del color del
// ENT, banner CAGR superior. Sin dependencia de Recharts para este chart
// específico — más control sobre layout y orden de pintado.

import { ENT_COLOR } from '../../lib/colors'

export default function TendenciaChart({ series, disease, year, metric = 'morbilidad' }) {
  const data = (series && series.length) ? series : []
  const isMort  = metric === 'mortalidad'
  const color   = isMort ? '#be123c' : (ENT_COLOR[disease] || '#1a1b4a')
  const dataKey = isMort ? 'mortRate' : 'rate'
  const tooltipLabel = isMort ? 'Mortalidad /100k' : 'Morbilidad /100k'
  const hasData = data.some(d => (d[dataKey] || 0) > 0)
  const gradId  = `g-${disease}-${metric}`

  // Geometría del SVG (responsive vía viewBox).
  const W = 320, H = 150
  const padL = 30, padR = 8, padT = 18, padB = 22

  const values = data.map(d => Number(d[dataKey] || 0))
  const minV   = hasData ? Math.min(...values) * 0.92 : 0
  const maxV   = hasData ? Math.max(...values) * 1.08 : 100
  const range  = maxV - minV || 1
  const years  = data.map(d => d.year)
  const minYr  = years[0] ?? 2013
  const maxYr  = years[years.length - 1] ?? 2024

  const xs = (yr) => padL + ((yr - minYr) / (maxYr - minYr || 1)) * (W - padL - padR)
  const ys = (v)  => padT + (1 - (v - minV) / range) * (H - padT - padB)

  // CAGR sobre la serie completa.
  let cagr = null
  if (hasData && data.length >= 2) {
    const first = Number(data[0][dataKey])
    const last  = Number(data[data.length - 1][dataKey])
    const span  = (data[data.length - 1].year - data[0].year)
    if (first > 0 && last > 0 && span > 0) {
      const r = Math.pow(last / first, 1 / span) - 1
      if (Number.isFinite(r)) cagr = (r * 100).toFixed(1)
    }
  }

  // Path de la serie + área cerrada al baseline.
  let path = ''
  let area = ''
  if (hasData) {
    path = data.map((d, i) =>
      `${i === 0 ? 'M' : 'L'} ${xs(d.year).toFixed(1)} ${ys(d[dataKey] || 0).toFixed(1)}`
    ).join(' ')
    area = `${path} L ${xs(maxYr).toFixed(1)} ${(H - padB).toFixed(1)} L ${xs(minYr).toFixed(1)} ${(H - padB).toFixed(1)} Z`
  }

  // Y-ticks (3 niveles): min, mid, max.
  const yTicks = [minV, (minV + maxV) / 2, maxV]
  const fmtY = (v) => {
    const n = Number(v)
    if (Math.abs(n) >= 10000) return `${Math.round(n / 1000)}K`
    if (Math.abs(n) >= 1000)  return `${(n / 1000).toFixed(1)}K`
    return String(Math.round(n))
  }

  // X-ticks (cada 3 años). Garantiza que minYr y maxYr estén incluidos.
  const xTicks = [...new Set([minYr, minYr + 3, minYr + 6, minYr + 9, maxYr])]
    .filter(t => t >= minYr && t <= maxYr)

  // Posición del pill del año (clampeada para que no se salga del SVG).
  const yearX = xs(year)
  const pillW = 32, pillH = 13

  return (
    <div className="rounded-[3px] border border-inspi-line bg-inspi-paper">
      {/* Banner CAGR superior. */}
      {cagr != null && (
        <div className="flex items-center justify-end border-b border-inspi-line bg-inspi-slate-50 px-2.5 py-1 font-display text-[9.5px] font-semibold text-inspi-muted">
          CAGR{' '}
          <span className={`ml-1 font-mono tnum ${Number(cagr) >= 0 ? 'text-inspi-red' : 'text-inspi-green'}`}>
            {Number(cagr) >= 0 ? '+' : ''}{cagr}%
          </span>
          <span className="ml-1">/año</span>
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {hasData && (
          <>
            {/* Y-grid + ticks */}
            {yTicks.map((t, i) => (
              <g key={`yt-${i}`}>
                <line
                  x1={padL} x2={W - padR}
                  y1={ys(t)} y2={ys(t)}
                  stroke="#E2E5EB" strokeWidth="0.5" strokeDasharray="2 3"
                />
                <text
                  x={padL - 4} y={ys(t) + 3}
                  fontSize="8" fill="#94A0AC" textAnchor="end"
                  fontFamily="Roboto Mono, monospace"
                >
                  {fmtY(t)}
                </text>
              </g>
            ))}

            {/* Área */}
            <path d={area} fill={`url(#${gradId})`} />

            {/* Serie */}
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />

            {/* Línea de referencia del año seleccionado (rojo punteado). */}
            <line
              x1={yearX} x2={yearX}
              y1={padT - 2} y2={H - padB}
              stroke="#B81D24" strokeWidth="1"
              strokeDasharray="3 2" opacity="0.85"
            />

            {/* Pill del año en el TOP del SVG (sobre la línea, no detrás). */}
            <rect
              x={yearX - pillW / 2}
              y={2}
              width={pillW} height={pillH}
              rx="2"
              fill="#B81D24"
            />
            <text
              x={yearX} y={11}
              fill="#fff"
              fontSize="9" fontWeight="700"
              textAnchor="middle"
              fontFamily="Roboto Mono, monospace"
            >
              {year}
            </text>

            {/* Dots: año seleccionado más grande, otros pequeños. */}
            {data.map((d) => {
              const sel = d.year === year
              return (
                <circle
                  key={d.year}
                  cx={xs(d.year)} cy={ys(d[dataKey] || 0)}
                  r={sel ? 3.4 : 1.6}
                  fill={sel ? color : '#fff'}
                  stroke={color} strokeWidth="1.4"
                >
                  <title>
                    {`${tooltipLabel} · Año ${d.year}: ${Number(d[dataKey] || 0).toFixed(1)}`}
                  </title>
                </circle>
              )
            })}

            {/* X-ticks */}
            {xTicks.map((t) => (
              <text
                key={`xt-${t}`}
                x={xs(t)} y={H - padB + 11}
                fontSize="8" fill="#6B7280"
                textAnchor="middle"
                fontFamily="Roboto Mono, monospace"
              >
                {t}
              </text>
            ))}
          </>
        )}

        {!hasData && (
          <text
            x={W / 2} y={H / 2}
            fontSize="10"
            fill="#9AA3AE"
            textAnchor="middle"
            fontStyle="italic"
            fontFamily="Montserrat, sans-serif"
          >
            Sin datos reales para esta unidad · serie vacía
          </text>
        )}
      </svg>
    </div>
  )
}
