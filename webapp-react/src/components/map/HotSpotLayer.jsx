// HotSpotLayer — Superficie continua interpolada por KDE (kernel density
// estimation) con paleta TURBO, renderizada a canvas y proyectada sobre el
// mapa como L.ImageOverlay. Replica el look clásico de "mapa de valor de
// densidad" tipo QGIS (blue→cyan→yellow→red continuo).
//
// Pipeline:
//   1. Para cada parroquia: valor (módulo-consciente) + centroide geométrico
//   2. Exclusión: valor 0, null o NaN → se ignora (no cuenta en mean/sd ni en KDE)
//   3. z-score = (valor - media_nacional) / sd_nacional
//   4. KDE: splatting gaussiano (σ ≈ 24 px) de los z-scores en un canvas 900 px
//   5. Máscara: destination-in con los polígonos parroquiales (o solo provincia
//      filtrada) → el KDE solo aparece sobre tierra ecuatoriana
//   6. Coloreo píxel a píxel usando TURBO_LUT con t = (z + Z_MAX) / (2·Z_MAX),
//      Z_MAX=3 → z=+3 rojo, z=0 amarillo-verde, z=-3 azul oscuro
//   7. dataURL → L.ImageOverlay sobre el bounding box geográfico
//
// Además: CircleMarker pequeño e interactivo por centroide para clic/hover
// (el tooltip revela el valor y clase exactos; la superficie de KDE da la
// lectura regional).
//
// Métricas por módulo (idénticas a versiones previas):
//   · carga         → tasa /100k del ENT activo (morb OR mort según mapMetric)
//   · determinantes → índice de vulnerabilidad (avg normalizado de 7 dets)
//   · mcda          → score MCDA total (suma de 5 ENT ranking scores)

import { useEffect, useMemo, useRef } from 'react'
import { useMap, CircleMarker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { useStore } from '../../store'
import {
  getParroquiaKey, getParroquiaLabel, getParroquiaProvKey,
} from '../../lib/parroquia'
import { generateData } from '../../lib/rates'
import { TURBO_LUT, ENT_LABEL, DETS_FULL } from '../../lib/colors'

// ───── Parámetros del KDE ─────
const KDE_WIDTH_MAX   = 900   // px del lado mayor del canvas
const KDE_SIGMA_PX    = 24    // σ del kernel gaussiano (≈ "radio de influencia")
const KDE_WEIGHT_MIN  = 0.03  // peso mínimo para considerar un pixel "con dato"
const KDE_ALPHA       = 210   // alpha del píxel con dato (0..255)
const Z_MAX           = 3     // |z| clamp — valores extremos se mapean al extremo de la paleta

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

// ───── centroide (Multi)Polygon ─────
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

// ───── color turbo desde LUT ─────
function turboRGB(t) {
  const i = Math.max(0, Math.min(255, Math.floor(t * 255))) * 3
  return [TURBO_LUT[i], TURBO_LUT[i + 1], TURBO_LUT[i + 2]]
}

// ───── clasificación textual para tooltip ─────
function claseFromZ(z) {
  if (!Number.isFinite(z)) return { txt: 'Sin datos',         color: '#94a3b8' }
  if (z >=  1.5)           return { txt: 'Hot-spot fuerte',   color: '#b2182b' }
  if (z >=  0.5)           return { txt: 'Hot-spot leve',     color: '#ea6e3a' }
  if (z <= -1.5)           return { txt: 'Cold-spot fuerte',  color: '#2166ac' }
  if (z <= -0.5)           return { txt: 'Cold-spot leve',    color: '#4393c3' }
  return                          { txt: 'Cerca de la media', color: '#64748b' }
}

// ───── dibuja geometría (polygon|multipolygon) en contexto 2D ─────
function addGeomPath(ctx, geom, ll2px) {
  const polygon = (rings) => {
    for (const ring of rings) {
      if (!ring.length) continue
      const [lng0, lat0] = ring[0]
      const [px0, py0] = ll2px(lat0, lng0)
      ctx.moveTo(px0, py0)
      for (let i = 1; i < ring.length; i++) {
        const [lng, lat] = ring[i]
        const [px, py] = ll2px(lat, lng)
        ctx.lineTo(px, py)
      }
      ctx.closePath()
    }
  }
  if (geom.type === 'Polygon')       polygon(geom.coordinates)
  else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) polygon(poly)
  }
}

// ───── render KDE → HTMLCanvasElement ─────
function renderKDECanvas({ points, mean, sd, maskFeatures, bounds }) {
  const lngMin = bounds.west, lngMax = bounds.east
  const latMin = bounds.south, latMax = bounds.north
  const dLng = lngMax - lngMin
  const dLat = latMax - latMin
  // Aspect ratio basado en ángulos (Leaflet trata ImageOverlay equirectangular;
  // a latitud ecuatorial la distorsión Mercator es despreciable).
  const aspect = dLng / dLat
  const WIDTH  = aspect >= 1 ? KDE_WIDTH_MAX : Math.round(KDE_WIDTH_MAX * aspect)
  const HEIGHT = aspect >= 1 ? Math.round(KDE_WIDTH_MAX / aspect) : KDE_WIDTH_MAX
  const ll2px = (lat, lng) => [
    ((lng - lngMin) / dLng) * WIDTH,
    ((latMax - lat) / dLat) * HEIGHT,
  ]

  // 1) acumuladores
  const sum    = new Float32Array(WIDTH * HEIGHT)
  const weight = new Float32Array(WIDTH * HEIGHT)
  const sigma2 = KDE_SIGMA_PX * KDE_SIGMA_PX
  const rad    = Math.ceil(KDE_SIGMA_PX * 3)

  // 2) splat gaussiano por cada punto
  for (const pt of points) {
    const [cx, cy] = ll2px(pt.latlng[0], pt.latlng[1])
    const z = (pt.value - mean) / sd
    const x0 = Math.max(0, Math.floor(cx - rad))
    const x1 = Math.min(WIDTH, Math.ceil(cx + rad))
    const y0 = Math.max(0, Math.floor(cy - rad))
    const y1 = Math.min(HEIGHT, Math.ceil(cy + rad))
    for (let y = y0; y < y1; y++) {
      const dy = y - cy
      for (let x = x0; x < x1; x++) {
        const dx = x - cx
        const d2 = dx * dx + dy * dy
        if (d2 > rad * rad) continue
        const w = Math.exp(-d2 / (2 * sigma2))
        const idx = y * WIDTH + x
        sum[idx]    += z * w
        weight[idx] += w
      }
    }
  }

  // 3) canvas RGBA
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(WIDTH, HEIGHT)
  const data = img.data

  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    const w = weight[i]
    if (w < KDE_WEIGHT_MIN) { data[i * 4 + 3] = 0; continue }
    const z = sum[i] / w
    const t = Math.max(0, Math.min(1, (z + Z_MAX) / (2 * Z_MAX)))
    const lutIdx = Math.floor(t * 255) * 3
    data[i * 4 + 0] = TURBO_LUT[lutIdx]
    data[i * 4 + 1] = TURBO_LUT[lutIdx + 1]
    data[i * 4 + 2] = TURBO_LUT[lutIdx + 2]
    data[i * 4 + 3] = KDE_ALPHA
  }
  ctx.putImageData(img, 0, 0)

  // 4) máscara por polígonos → destination-in
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = WIDTH
  maskCanvas.height = HEIGHT
  const mctx = maskCanvas.getContext('2d')
  mctx.fillStyle = '#000'
  mctx.beginPath()
  for (const f of maskFeatures) addGeomPath(mctx, f.geometry, ll2px)
  mctx.fill('evenodd')
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(maskCanvas, 0, 0)
  ctx.globalCompositeOperation = 'source-over'

  return canvas
}

// ───── componente ─────

export default function HotSpotLayer() {
  const map = useMap()
  const overlayRef = useRef(null)

  const geoParr     = useStore(s => s.geoParr)
  const entData     = useStore(s => s.entData)
  const pobData     = useStore(s => s.pobData)
  const detData     = useStore(s => s.detData)
  const mcdaData    = useStore(s => s.mcdaData)
  const module_     = useStore(s => s.module)
  const ent         = useStore(s => s.ent)
  const year        = useStore(s => s.year)
  const mapMetric   = useStore(s => s.mapMetric)
  const provFilter  = useStore(s => s.provFilter)
  const selectedDpa = useStore(s => s.selectedDpa)
  const setSelected = useStore(s => s.setSelected)

  const isMort = mapMetric === 'mortalidad'

  // 1) Puntos + mean/sd (ALL Ecuador) + máscara por provFilter
  const kdeData = useMemo(() => {
    if (!geoParr) return null
    const ctx = { ent, year, entData, pobData, isMort, detData, mcdaData }
    const raw = []
    const maskFeatures = []
    for (const f of geoParr.features) {
      const p = f.properties || {}
      const key = getParroquiaKey(p)
      const provKey = getParroquiaProvKey(p)
      const inProv = !provFilter || provKey === provFilter
      // la máscara respeta provFilter (oculta KDE fuera de la provincia)
      if (inProv) maskFeatures.push(f)

      let v = null
      if (module_ === 'determinantes')      v = det_vuln_value(key, ctx)
      else if (module_ === 'mcda')          v = mcda_total_value(key, ctx)
      else                                  v = carga_value(key, ctx)
      if (!Number.isFinite(v) || v <= 0) continue
      const c = centroidOf(f.geometry)
      if (!c) continue
      raw.push({
        key,
        label: getParroquiaLabel(p),
        prov:  provKey,
        value: v,
        latlng: c,
        props: p,
      })
    }
    if (raw.length === 0) return null

    // mean/sd NACIONAL sobre todos los puntos válidos (no filtra por provincia
    // → los z-scores son comparables entre vistas)
    const m = raw.reduce((a, b) => a + b.value, 0) / raw.length
    const variance = raw.reduce((a, b) => a + (b.value - m) ** 2, 0) / raw.length
    const s = Math.sqrt(variance) || 1

    // Bounds geográficos de la máscara (prov filtrada o todo el país)
    const src = maskFeatures.length ? maskFeatures : geoParr.features
    let south =  Infinity, north = -Infinity, west =  Infinity, east = -Infinity
    const scanCoords = (c) => {
      if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') {
        const [lng, lat] = c
        if (lng < west)  west  = lng
        if (lng > east)  east  = lng
        if (lat < south) south = lat
        if (lat > north) north = lat
      } else if (Array.isArray(c)) {
        for (const x of c) scanCoords(x)
      }
    }
    for (const f of src) scanCoords(f.geometry.coordinates)
    // pad ligero para que el KDE no se corte en el borde
    const pad = Math.max((north - south), (east - west)) * 0.02
    const bounds = {
      south: south - pad, north: north + pad,
      west:  west  - pad, east:  east  + pad,
    }

    const label =
      module_ === 'determinantes' ? 'Índice de vulnerabilidad (determinantes)'
    : module_ === 'mcda'          ? 'Score MCDA total'
    :                               (isMort ? 'Tasa mortalidad /100k' : 'Tasa morbilidad /100k')

    return { points: raw, mean: m, sd: s, maskFeatures, bounds, metricLabel: label }
  }, [geoParr, module_, ent, year, entData, pobData, detData, mcdaData, isMort, provFilter])

  // 2) Render canvas → L.ImageOverlay (efecto side-only, no re-render React)
  useEffect(() => {
    if (overlayRef.current) {
      map.removeLayer(overlayRef.current)
      overlayRef.current = null
    }
    if (!kdeData) return
    const canvas = renderKDECanvas(kdeData)
    const url = canvas.toDataURL('image/png')
    const b = kdeData.bounds
    const llBounds = L.latLngBounds([b.south, b.west], [b.north, b.east])
    overlayRef.current = L.imageOverlay(url, llBounds, {
      opacity: 0.82,
      interactive: false,
      className: 'kde-overlay',
    }).addTo(map)
    return () => {
      if (overlayRef.current) {
        map.removeLayer(overlayRef.current)
        overlayRef.current = null
      }
    }
  }, [kdeData, map])

  // 3) Marcadores puntuales interactivos (click + tooltip) encima del KDE
  if (!kdeData) return null
  const { points, mean, sd, metricLabel } = kdeData
  const entLabel = ENT_LABEL[ent] || ent

  return (
    <>
      {points.map(pt => {
        if (provFilter && pt.prov !== provFilter) return null // fuera de vista
        const z = (pt.value - mean) / sd
        const sel = selectedDpa && pt.key === selectedDpa
        const clase = claseFromZ(z)
        const scope = module_ === 'carga' ? `${entLabel} · ${year}` : metricLabel
        return (
          <CircleMarker
            key={`hot-pt-${pt.key}`}
            center={pt.latlng}
            radius={sel ? 7 : 3}
            pathOptions={{
              fillColor: sel ? '#fbc400' : '#1a1b4a',
              fillOpacity: sel ? 0.9 : 0.15,
              color:      sel ? '#fbc400' : '#1a1b4a',
              weight:     sel ? 2 : 0.5,
              opacity:    sel ? 1 : 0.45,
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
