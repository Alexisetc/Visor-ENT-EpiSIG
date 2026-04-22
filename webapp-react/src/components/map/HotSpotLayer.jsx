// HotSpotLayer — Hot-spot sobre CENTROIDES (puntos, no polígonos).
// Para cada parroquia con valor > 0 calcula z-score contra media/desv.
// nacional de la métrica activa del módulo y dibuja un CircleMarker en
// su centroide, con:
//   · color  = HOTSPOT_BIPOLAR (9 stops RdBu invertida) según z
//   · radio  = proporcional a |z| (cluster más fuerte = círculo más grande)
//
// Exclusiones (a petición del usuario):
//   - Valores 0, NaN, null → parroquia NO aparece en el mapa
//     Y no cuenta para el cálculo de mean / sd
//
// Métricas por módulo (idénticas a la versión coropleta previa):
//   · carga         → tasa /100k del ENT activo (morb OR mort según mapMetric)
//   · determinantes → índice de vulnerabilidad (avg normalizado de 7 dets)
//   · mcda          → score MCDA total (suma de 5 ENT ranking scores)
//
// Nota metodológica: no es Gi* estricto (sin matriz de pesos espaciales).
// Es un z-score global que identifica parroquias extremas contra el promedio
// nacional. La visualización puntual evita el sesgo de área (polígonos
// rurales enormes vs. urbanos pequeños) que distorsiona los hot-spots
// cuando se pintan como coropletas.

import { useMemo } from 'react'
import { CircleMarker, Tooltip } from 'react-leaflet'
import { useStore } from '../../store'
import {
  getParroquiaKey, getParroquiaLabel, getParroquiaProvKey,
} from '../../lib/parroquia'
import { generateData } from '../../lib/rates'
import {
  HOTSPOT_BIPOLAR, HOTSPOT_BREAKS, ENT_LABEL, DETS_FULL,
} from '../../lib/colors'

// ───── helpers: métricas por módulo ─────

function carga_value(key, { ent, year, entData, pobData, isMort }) {
  const d = generateData(key, ent, year, entData, pobData)
  return isMort ? d.mortRate : d.rate
}

function det_vuln_value(key, { detData }) {
  const row = detData?.parroquias?.[key]
  if (!row) return null
  const norms = {
    pobreza: 50, nbi: 100, pm25: 50, tabaquismo: 35,
    obesidad: 45, sedentarismo: 75, acceso_salud_km: 15,
  }
  let sum = 0, n = 0
  for (const d of DETS_FULL) {
    const v = Number(row[d])
    if (Number.isFinite(v)) {
      sum += Math.max(0, Math.min(1, v / norms[d]))
      n++
    }
  }
  return n > 0 ? sum / n : null
}

function mcda_total_value(key, { mcdaData }) {
  const row = mcdaData?.parroquias?.[key]
  if (!row) return null
  const ranking = row.ranking || []
  if (ranking.length === 0) return null
  let sum = 0, n = 0
  for (const r of ranking) {
    const s = Number(r.score)
    if (Number.isFinite(s)) { sum += s; n++ }
  }
  return n > 0 ? sum : null
}

// ───── centroide de (Multi)Polygon — promedio simple de vertices ─────
// Para parroquias normalmente-formadas este promedio es visualmente
// indistinguible del centroide geométrico exacto. Evita dependencia pesada
// (turf.js) sin sacrificar precisión perceptual.
function centroidOf(geometry) {
  if (!geometry) return null
  let lng = 0, lat = 0, n = 0
  const walk = (c) => {
    if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') {
      lng += c[0]; lat += c[1]; n++
    } else if (Array.isArray(c)) {
      for (const x of c) walk(x)
    }
  }
  walk(geometry.coordinates)
  return n > 0 ? [lat / n, lng / n] : null
}

// ───── color y radio por z-score ─────

function colorFromZ(z) {
  if (!Number.isFinite(z)) return '#e2e8f0'
  for (let i = 0; i < HOTSPOT_BREAKS.length; i++) {
    if (z <= HOTSPOT_BREAKS[i]) return HOTSPOT_BIPOLAR[Math.min(i, HOTSPOT_BIPOLAR.length - 1)]
  }
  return HOTSPOT_BIPOLAR[HOTSPOT_BIPOLAR.length - 1]
}

// Radio en píxeles escalado por |z|. Clamp a [0, 3] desviaciones:
//   · z ≈ 0  → r = 4  px (cerca de la media)
//   · |z|=1  → r ≈ 7  px
//   · |z|=2  → r ≈ 10 px
//   · |z|≥3  → r = 14 px (cluster muy fuerte)
function radiusFromZ(z) {
  if (!Number.isFinite(z)) return 0
  const abs = Math.min(Math.abs(z), 3)
  return 4 + abs * 3.3
}

function claseFromZ(z) {
  if (!Number.isFinite(z)) return { txt: 'Sin datos',         color: '#94a3b8' }
  if (z >=  1.5)           return { txt: 'Hot-spot fuerte',   color: '#b2182b' }
  if (z >=  0.5)           return { txt: 'Hot-spot leve',     color: '#f4a582' }
  if (z <= -1.5)           return { txt: 'Cold-spot fuerte',  color: '#2166ac' }
  if (z <= -0.5)           return { txt: 'Cold-spot leve',    color: '#92c5de' }
  return                          { txt: 'Cerca de la media', color: '#64748b' }
}

// ───── componente ─────

export default function HotSpotLayer() {
  const geoParr     = useStore(s => s.geoParr)
  const entData     = useStore(s => s.entData)
  const pobData     = useStore(s => s.pobData)
  const detData     = useStore(s => s.detData)
  const mcdaData    = useStore(s => s.mcdaData)
  const module      = useStore(s => s.module)
  const ent         = useStore(s => s.ent)
  const year        = useStore(s => s.year)
  const mapMetric   = useStore(s => s.mapMetric)
  const provFilter  = useStore(s => s.provFilter)
  const selectedDpa = useStore(s => s.selectedDpa)
  const setSelected = useStore(s => s.setSelected)

  const isMort = mapMetric === 'mortalidad'

  // 1) Barre features, calcula valor por parroquia y centroide.
  //    Excluye valores 0, null, NaN (no cuentan para mean/sd ni se pintan).
  // 2) Mean + sd nacional sobre los válidos > 0.
  const { points, mean, sd, metricLabel } = useMemo(() => {
    if (!geoParr) return { points: [], mean: 0, sd: 1, metricLabel: '' }
    const ctx = { ent, year, entData, pobData, isMort, detData, mcdaData }
    const raw = []
    for (const f of geoParr.features) {
      const p = f.properties || {}
      const key = getParroquiaKey(p)
      let v = null
      if (module === 'determinantes')       v = det_vuln_value(key, ctx)
      else if (module === 'mcda')           v = mcda_total_value(key, ctx)
      else                                  v = carga_value(key, ctx)
      // ⬇ exclusión: ceros, nulos, no-finitos
      if (!Number.isFinite(v) || v <= 0) continue
      const c = centroidOf(f.geometry)
      if (!c) continue
      raw.push({
        key,
        label: getParroquiaLabel(p),
        prov:  getParroquiaProvKey(p),
        value: v,
        latlng: c,
        props: p,
      })
    }
    if (raw.length === 0) return { points: [], mean: 0, sd: 1, metricLabel: '' }
    const m = raw.reduce((a, b) => a + b.value, 0) / raw.length
    const variance = raw.reduce((a, b) => a + (b.value - m) ** 2, 0) / raw.length
    const s = Math.sqrt(variance) || 1
    const label =
      module === 'determinantes' ? 'Índice de vulnerabilidad (determinantes)'
    : module === 'mcda'          ? 'Score MCDA total'
    :                              (isMort ? 'Tasa mortalidad /100k' : 'Tasa morbilidad /100k')
    return { points: raw, mean: m, sd: s, metricLabel: label }
  }, [geoParr, module, ent, year, entData, pobData, detData, mcdaData, isMort])

  const entLabel = ENT_LABEL[ent] || ent

  return (
    <>
      {points.map(pt => {
        const z = (pt.value - mean) / sd
        const color = colorFromZ(z)
        const r = radiusFromZ(z)
        const sel = selectedDpa && pt.key === selectedDpa
        const dim = provFilter && pt.prov !== provFilter
        const clase = claseFromZ(z)
        const scope = module === 'carga' ? `${entLabel} · ${year}` : metricLabel

        return (
          <CircleMarker
            key={`hot-${pt.key}`}
            center={pt.latlng}
            radius={sel ? r + 2 : r}
            pathOptions={{
              fillColor:   color,
              fillOpacity: dim ? 0.2 : 0.82,
              color:       sel ? '#fbc400' : '#1a1b4a',
              weight:      sel ? 2.2 : 0.6,
              opacity:     dim ? 0.35 : 1,
            }}
            eventHandlers={{
              click: () => setSelected(pt.key, pt.props),
            }}
          >
            <Tooltip sticky direction="auto" opacity={0.95}>
              <div style={{ fontFamily: 'Inter, sans-serif', lineHeight: 1.3, minWidth: 200 }}>
                <div style={{ fontWeight: 600, color: '#1a1b4a' }}>{pt.label}</div>
                <div style={{ color: '#64748b', fontSize: 10.5, marginBottom: 4 }}>{scope}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#475569' }}>Valor</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#1a1b4a' }}>
                    {pt.value.toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#475569' }}>z-score</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#1a1b4a' }}>
                    {(z >= 0 ? '+' : '') + z.toFixed(2)}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 3, paddingTop: 3,
                    borderTop: '1px solid #e2e8f0',
                    fontSize: 10.5, fontWeight: 600,
                    color: clase.color,
                  }}
                >
                  {clase.txt}
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </>
  )
}
