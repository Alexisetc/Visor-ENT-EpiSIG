// HotSpotLayer — Superficie continua tipo "Valor densidad" (QGIS-style).
// Renderiza un KDE (kernel density estimation) de los z-scores de cada
// parroquia sobre un canvas, proyectado en el mapa como L.ImageOverlay
// bajo un pane propio (z-index 350), con la paleta Turbo (Mikhailov 2019)
// y **normalización empírica por percentiles p2..p98** del output del KDE
// — así el extremo rojo siempre aparece donde realmente están los hot-spots,
// incluso con distribuciones muy sesgadas como las tasas ENT.
//
// Encima del KDE se dibujan los polígonos parroquiales con stroke fino
// (overlayPane, z-index 400) que sirven a la vez de delimitación visual
// y de target de interacción (click + tooltip) — sin dots.
//
// Pipeline:
//   1. Para cada parroquia: valor módulo-consciente + centroide geométrico
//   2. Exclusión: v ≤ 0, null, NaN → se ignora (no cuenta en mean/sd ni KDE)
//   3. z-score nacional = (valor − μ) / σ
//   4. Splat gaussiano (σ ≈ 20 px) sobre un canvas 900 px
//   5. Cada pixel_z = Σ(z_i · w_i) / Σ(w_i); pixels con Σw < 0.04 → transparente
//   6. p2, p98 empíricos del pixel_z → normalizar t = (z − p2) / (p98 − p2)
//      clamp [0, 1] → turbo LUT
//   7. Máscara evenodd con polígonos parroquiales (provFilter respetado)
//   8. dataURL → L.imageOverlay en pane 'kde-pane' (z 350)
//   9. Encima: GeoJSON transparente con stroke fino (interacción + boundaries)
//
// Métricas por módulo (idénticas a versiones previas):
//   · carga         → tasa /100k del ENT activo (morb OR mort según mapMetric)
//   · determinantes → índice de vulnerabilidad (avg normalizado de 7 dets)
//   · mcda          → score MCDA total (suma de 5 ENT ranking scores)

import { useEffect, useMemo, useRef } from 'react'
import { useMap, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import { useStore } from '../../store'
import {
  getParroquiaKey, getParroquiaLabel, getParroquiaProvKey,
} from '../../lib/parroquia'
import { generateData } from '../../lib/rates'
import { TURBO_LUT, ENT_LABEL, DETS_FULL } from '../../lib/colors'

// ───── Parámetros del KDE ─────
const KDE_WIDTH_MAX   = 900   // px del lado mayor del canvas
const KDE_SIGMA_PX    = 20    // σ del kernel gaussiano (radio de influencia)
const KDE_WEIGHT_MIN  = 0.04  // peso mínimo para considerar un pixel "con dato"
const KDE_ALPHA       = 225   // alpha del pixel con dato (0..255)

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

// ───── centroide (Multi)Polygon — promedio simple de vertices ─────
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

// ───── clasificación textual para tooltip ─────
function claseFromZ(z) {
  if (!Number.isFinite(z)) return { txt: 'Sin datos',         color: '#94a3b8' }
  if (z >=  1.5)           return { txt: 'Hot-spot fuerte',   color: '#b2182b' }
  if (z >=  0.5)           return { txt: 'Hot-spot leve',     color: '#ea6e3a' }
  if (z <= -1.5)           return { txt: 'Cold-spot fuerte',  color: '#2166ac' }
  if (z <= -0.5)           return { txt: 'Cold-spot leve',    color: '#4393c3' }
  return                          { txt: 'Cerca de la media', color: '#64748b' }
}

// ───── dibuja (Multi)Polygon en contexto 2D ─────
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
  if (geom.type === 'Polygon')           polygon(geom.coordinates)
  else if (geom.type === 'MultiPolygon') { for (const poly of geom.coordinates) polygon(poly) }
}

// ───── render KDE → HTMLCanvasElement ─────
function renderKDECanvas({ points, mean, sd, maskFeatures, bounds }) {
  const lngMin = bounds.west, lngMax = bounds.east
  const latMin = bounds.south, latMax = bounds.north
  const dLng = lngMax - lngMin
  const dLat = latMax - latMin
  const aspect = dLng / dLat
  const WIDTH  = aspect >= 1 ? KDE_WIDTH_MAX : Math.round(KDE_WIDTH_MAX * aspect)
  const HEIGHT = aspect >= 1 ? Math.round(KDE_WIDTH_MAX / aspect) : KDE_WIDTH_MAX
  const ll2px = (lat, lng) => [
    ((lng - lngMin) / dLng) * WIDTH,
    ((latMax - lat) / dLat) * HEIGHT,
  ]

  const N = WIDTH * HEIGHT
  const sum    = new Float32Array(N)
  const weight = new Float32Array(N)
  const sigma2 = KDE_SIGMA_PX * KDE_SIGMA_PX
  const rad    = Math.ceil(KDE_SIGMA_PX * 3)

  // 1) splat gaussiano
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

  // 2) pixel_z y conteo de válidos
  const pixelZ = new Float32Array(N)
  let validCount = 0
  for (let i = 0; i < N; i++) {
    if (weight[i] < KDE_WEIGHT_MIN) { pixelZ[i] = NaN; continue }
    pixelZ[i] = sum[i] / weight[i]
    validCount++
  }

  // 3) percentiles empíricos p2, p98 del output KDE — normalización robusta
  //    que garantiza utilización plena del rango Turbo aun con distribuciones
  //    muy sesgadas (tasas ENT típicamente lognormal).
  let pLo = -1, pHi = 1
  if (validCount > 0) {
    const valid = new Float32Array(validCount)
    let j = 0
    for (let i = 0; i < N; i++) if (!Number.isNaN(pixelZ[i])) valid[j++] = pixelZ[i]
    valid.sort() // typed-array sort in-place (fast)
    pLo = valid[Math.floor(validCount * 0.02)]
    pHi = valid[Math.floor(validCount * 0.98)]
    if (pHi - pLo < 1e-6) pHi = pLo + 1e-6
  }
  const range = pHi - pLo

  // 4) canvas RGBA con paleta Turbo
  const canvas = document.createElement('canvas')
  canvas.width  = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(WIDTH, HEIGHT)
  const data = img.data
  for (let i = 0; i < N; i++) {
    const z = pixelZ[i]
    if (Number.isNaN(z)) { data[i * 4 + 3] = 0; continue }
    const t = Math.max(0, Math.min(1, (z - pLo) / range))
    const lutIdx = Math.floor(t * 255) * 3
    data[i * 4 + 0] = TURBO_LUT[lutIdx]
    data[i * 4 + 1] = TURBO_LUT[lutIdx + 1]
    data[i * 4 + 2] = TURBO_LUT[lutIdx + 2]
    data[i * 4 + 3] = KDE_ALPHA
  }
  ctx.putImageData(img, 0, 0)

  // 5) máscara por polígonos → destination-in
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width  = WIDTH
  maskCanvas.height = HEIGHT
  const mctx = maskCanvas.getContext('2d')
  mctx.fillStyle = '#000'
  mctx.beginPath()
  for (const f of maskFeatures) addGeomPath(mctx, f.geometry, ll2px)
  mctx.fill('evenodd')
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(maskCanvas, 0, 0)
  ctx.globalCompositeOperation = 'source-over'

  return { canvas, pLo, pHi }
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

  // Crea pane dedicado para el KDE (debajo de boundaries, encima de tiles)
  useEffect(() => {
    if (!map.getPane('kde-pane')) {
      map.createPane('kde-pane')
      const pane = map.getPane('kde-pane')
      pane.style.zIndex = 350
      pane.style.pointerEvents = 'none' // los clicks los recibe el GeoJSON encima
    }
  }, [map])

  // 1) Puntos + mean/sd nacionales + máscara por provFilter + bounds
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
      if (inProv) maskFeatures.push(f)

      let v = null
      if (module_ === 'determinantes')      v = det_vuln_value(key, ctx)
      else if (module_ === 'mcda')          v = mcda_total_value(key, ctx)
      else                                  v = carga_value(key, ctx)
      if (!Number.isFinite(v) || v <= 0) continue
      const c = centroidOf(f.geometry)
      if (!c) continue
      raw.push({ key, prov: provKey, value: v, latlng: c })
    }
    if (raw.length === 0) return null

    const m = raw.reduce((a, b) => a + b.value, 0) / raw.length
    const variance = raw.reduce((a, b) => a + (b.value - m) ** 2, 0) / raw.length
    const s = Math.sqrt(variance) || 1

    // Bounds de la máscara (provincia o todo el país) con pad ligero
    const src = maskFeatures.length ? maskFeatures : geoParr.features
    let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity
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
    const pad = Math.max(north - south, east - west) * 0.02
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

  // 2) Render canvas → L.ImageOverlay en kde-pane (side effect)
  useEffect(() => {
    if (overlayRef.current) {
      map.removeLayer(overlayRef.current)
      overlayRef.current = null
    }
    if (!kdeData) return
    const { canvas } = renderKDECanvas(kdeData)
    const url = canvas.toDataURL('image/png')
    const b = kdeData.bounds
    const llBounds = L.latLngBounds([b.south, b.west], [b.north, b.east])
    overlayRef.current = L.imageOverlay(url, llBounds, {
      pane: 'kde-pane',
      opacity: 0.88,
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

  // 3) Boundaries parroquiales — GeoJSON transparente con stroke fino
  //    sobre overlayPane (z 400), encima del KDE. Recibe clicks + hover.
  const valuesByKey = useMemo(() => {
    const m = new Map()
    if (kdeData) for (const pt of kdeData.points) m.set(pt.key, pt.value)
    return m
  }, [kdeData])

  if (!kdeData) return null
  const { mean, sd, metricLabel } = kdeData
  const entLabel = ENT_LABEL[ent] || ent

  const styleFn = (feature) => {
    const p = feature.properties || {}
    const key = getParroquiaKey(p)
    const provKey = getParroquiaProvKey(p)
    const dim = provFilter && provKey !== provFilter
    const sel = selectedDpa && key === selectedDpa
    return {
      fillColor:   'transparent',
      fillOpacity: 0,
      color:       sel ? '#fbc400' : '#0f172a',
      weight:      sel ? 2.5 : 0.35,
      opacity:     dim ? 0 : (sel ? 1 : 0.45),
    }
  }

  const onEachFeature = (feature, layer) => {
    const p = feature.properties || {}
    const key = getParroquiaKey(p)
    const label = getParroquiaLabel(p)
    const v = valuesByKey.get(key)
    const z = Number.isFinite(v) ? (v - mean) / sd : NaN
    const clase = claseFromZ(z)
    const scope = module_ === 'carga' ? `${entLabel} · ${year}` : metricLabel
    const vTxt = Number.isFinite(v) ? v.toFixed(2) : '—'
    const zTxt = Number.isFinite(z) ? (z >= 0 ? '+' : '') + z.toFixed(2) : '—'
    layer.bindTooltip(
      `<div style="font-family:Inter,sans-serif;line-height:1.3;min-width:200px">
         <div style="font-weight:600;color:#1a1b4a">${label}</div>
         <div style="color:#64748b;font-size:10.5px;margin-bottom:4px">${scope}</div>
         <div style="display:flex;justify-content:space-between;font-size:11px">
           <span style="color:#475569">Valor</span>
           <span style="font-family:'JetBrains Mono',monospace;color:#1a1b4a">${vTxt}</span>
         </div>
         <div style="display:flex;justify-content:space-between;font-size:11px">
           <span style="color:#475569">z-score</span>
           <span style="font-family:'JetBrains Mono',monospace;color:#1a1b4a">${zTxt}</span>
         </div>
         <div style="margin-top:3px;padding-top:3px;border-top:1px solid #e2e8f0;font-size:10.5px;font-weight:600;color:${clase.color}">${clase.txt}</div>
       </div>`,
      { sticky: true, direction: 'auto', opacity: 0.95 }
    )
    layer.on({
      click: () => setSelected(key, p),
      mouseover: e => e.target.setStyle({ weight: 1.6, color: '#0f172a', opacity: 1 }),
      mouseout:  e => {
        const provKey = getParroquiaProvKey(p)
        const dim = provFilter && provKey !== provFilter
        const sel = selectedDpa && key === selectedDpa
        e.target.setStyle({
          weight: sel ? 2.5 : 0.35,
          color:  sel ? '#fbc400' : '#0f172a',
          opacity: dim ? 0 : (sel ? 1 : 0.45),
        })
      },
    })
  }

  return (
    <GeoJSON
      key={`hot-bounds|${module_}|${ent}|${year}|${isMort ? 'M' : 'B'}|${provFilter || 'nat'}|${selectedDpa || 'none'}`}
      data={geoParr}
      style={styleFn}
      onEachFeature={onEachFeature}
    />
  )
}
