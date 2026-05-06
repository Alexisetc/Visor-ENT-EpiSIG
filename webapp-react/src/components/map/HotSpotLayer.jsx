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
//   2. Cuatro buckets (3 de dato × 1 de filtro territorial):
//        · observada  = pob > 0 ∧ casos > 0 (o valor > 0 en det/mcda).
//                       → alimenta el splat gaussiano + define mean/sd del
//                         z-score + entra al mask del KDE.
//        · interpolada= pob > 0 ∧ casos = 0. El valor "0" es ambiguo:
//                       puede ser cero epidemiológico real O parroquia
//                       creada por decreto CONALI después del año consultado
//                       (cartografía 2025 trae polígonos que no existían
//                       administrativamente en 2013-2023). Para no engañar
//                       al usuario pintando falsos cold-spots, se usa
//                       IDW k=5 sobre los centroides de las observadas.
//                       → NO alimenta splat; SÍ entra al mask.
//        · sinDato    = pob = 0 (zonas sin censo CPV 2022: Shuar Pastaza,
//                       Sevilla Don Bosco, Sinaí-Cuchaentza, etc.).
//                       → NO mask KDE, render gris dashed (estándar OMS).
//        · fueraProv  = fuera del provFilter → opacity 0, no se dibuja.
//
//   Rationale de IDW: el KDE gaussiano ya es un estimador Nadaraya-Watson
//   (k-NN con peso continuo) que pinta colores interpolados sobre toda la
//   zona del mask. IDW k=5 discreto se usa adicionalmente SOLO para producir
//   un valor numérico por-parroquia consumible en el tooltip — más
//   defendible estadísticamente que "leer el pixel del centroide", y más
//   interpretable ("promedio de 5 vecinas más cercanas con dato").
//   3. z-score nacional = (valor − μ) / σ  (solo sobre conDato)
//   4. Splat gaussiano (σ ≈ 20 px) sobre un canvas 900 px
//   5. pixel_z = Σ(z_i · w_i) / Σ(w_i); pixels con Σw < 0.04 → alpha 0
//   6. p2, p98 empíricos del pixel_z → normalizar t = (z − p2) / (p98 − p2)
//      clamp [0, 1] → TURBO_LUT (Mikhailov A-grade — SIN grises en la rampa)
//   7. Máscara evenodd SOLO con polígonos conDato — destination-in
//   8. Alpha de píxel = 255 dentro del canvas (color puro, sin blending
//      intra-pixel que desature el Turbo). Opacidad del overlay = 0.82
//      para dejar ver el base-map. Opacidad efectiva ≈ 0.82.
//   9. dataURL → L.imageOverlay en pane 'kde-pane' (z 350)
//  10. Encima: GeoJSON transparente con stroke fino para conDato, y fill
//      gris `#e2e8f0` + stroke `#94a3b8` dashed para sinDato (estándar
//      OMS / CDC Wonder / Eurostat para "insufficient data").
//
// Tratamiento de parroquias sin dato (documentado en leyenda):
//   · Excluidas del KDE → no contaminan el promedio ni el gradiente.
//   · Renderizadas con relleno gris claro + borde punteado → el usuario
//     distingue visualmente "no hay información" de "valor bajo real".
//   · Se cuentan por separado en el dataset (no se borran); aparecen en
//     tooltip como "Sin datos" en vez de un valor numérico 0 que engañe.
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
import { generateData, getPob } from '../../lib/rates'
import { TURBO_LUT, ENT_LABEL, DETS_FULL } from '../../lib/colors'

// ───── Parámetros del KDE ─────
const KDE_WIDTH_MAX   = 900   // px del lado mayor del canvas
const KDE_SIGMA_PX    = 20    // σ del kernel gaussiano (radio de influencia)
const KDE_WEIGHT_MIN  = 0.04  // peso mínimo para considerar un pixel "con dato"
const KDE_ALPHA       = 255   // alpha del pixel — opaco puro dentro del canvas
                              // (la transparencia la controla L.imageOverlay
                              //  con opacity ~0.82, evitando blending intra-pixel
                              //  que desaturaría el Turbo a grisáceo)
const KDE_OVERLAY_OP  = 0.82  // opacity del L.imageOverlay (ver tile base debajo)

// ───── Parámetros de la interpolación IDW ─────
const IDW_K       = 5       // nº de vecinos más cercanos
const IDW_POWER   = 2       // exponente de la distancia (2 = estándar GIS)
const IDW_EPS     = 1e-9    // evita división por cero si distancia == 0

// ───── helpers: métricas por módulo ─────
// Cada helper devuelve { value, status } donde:
//   · status='data'    → observación directa: alimenta splat del KDE.
//   · status='interp'  → casos=0 con pob>0 — se interpolará por IDW.
//                        El value devuelto es 0 (placeholder; el IDW
//                        lo reemplaza después con promedio de vecinos).
//   · status='nodata'  → ausencia real de información (pob=0 o sin entrada).
// Módulos determinantes/mcda no usan 'interp' (sus valores=0 son ausencia).

function carga_value(key, { ent, year, entData, pobData, isMort }) {
  // Si la parroquia no está en entData (no figura en los egresos
  // hospitalarios INEC) PERO tiene población válida en pobData
  // (parroquia phantom — creada por CONALI post-INEC, o cantón nuevo
  // como Sevilla Don Bosco 1413), la marcamos para INTERPOLACIÓN IDW
  // desde sus vecinas observadas, en vez de pintarla gris "sin dato".
  // Solo se considera nodata real cuando tampoco hay población.
  if (!entData?.parroquias?.[key]) {
    const pobP = getPob(pobData, key, year)
    if (pobP > 0) return { value: 0, status: 'interp' }
    return { value: null, status: 'nodata' }
  }
  // Denominador anual log-share (Fase 6); cae al snapshot 2022 si la serie
  // anual no está presente para este DPA6.
  const pob = getPob(pobData, key, year)
  if (pob <= 0) return { value: null, status: 'nodata' }
  const d = generateData(key, ent, year, entData, pobData)
  const v = isMort ? d.mortRate : d.rate
  const n = isMort ? d.muertes : d.casos
  if (!Number.isFinite(v)) return { value: null, status: 'nodata' }
  // casos = 0 pero pob > 0 → ambiguo (puede ser cero epi real O parroquia
  // creada por decreto CONALI posterior al año consultado). Se marca para
  // interpolación IDW desde las vecinas observadas.
  if (n === 0 || v === 0) return { value: 0, status: 'interp' }
  return { value: v, status: 'data' }
}

function det_vuln_value(key, { detData }) {
  const row = detData?.parroquias?.[key]
  if (!row) return { value: null, status: 'nodata' }
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
  if (n === 0) return { value: null, status: 'nodata' }
  return { value: sum / n, status: 'data' }
}

function mcda_total_value(key, { mcdaData }) {
  const row = mcdaData?.parroquias?.[key]
  if (!row) return { value: null, status: 'nodata' }
  const ranking = row.ranking || []
  if (ranking.length === 0) return { value: null, status: 'nodata' }
  let sum = 0, n = 0
  for (const r of ranking) {
    const s = Number(r.score)
    if (Number.isFinite(s)) { sum += s; n++ }
  }
  if (n === 0) return { value: null, status: 'nodata' }
  return { value: sum, status: 'data' }
}

// ───── IDW: inverse distance weighting sobre top-k vecinos ─────
// target: [lat, lng] del punto a interpolar
// observed: array de { value, latlng: [lat, lng] }
// Retorna el valor interpolado (0 si no hay observaciones).
function idwInterpolate(target, observed, k = IDW_K, power = IDW_POWER) {
  if (!observed.length) return 0
  const dists = observed.map(pt => {
    const dLat = target[0] - pt.latlng[0]
    const dLng = target[1] - pt.latlng[1]
    return { v: pt.value, d2: dLat * dLat + dLng * dLng }
  })
  // Si un observado está exactamente en el target, devolver su valor
  for (const x of dists) if (x.d2 < IDW_EPS) return x.v
  dists.sort((a, b) => a.d2 - b.d2)
  const top = dists.slice(0, Math.min(k, dists.length))
  let num = 0, den = 0
  for (const { v, d2 } of top) {
    const w = 1 / Math.pow(Math.sqrt(d2), power)
    num += v * w
    den += w
  }
  return den > 0 ? num / den : 0
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
  //    Cuatro buckets:
  //      · observada (status='data')   → splat KDE + mean/sd + mask
  //      · interpolada (status='interp')→ mask KDE; valor IDW vecinos observados
  //      · sinDato (status='nodata')   → fuera del KDE, render gris
  //      · fueraProv                    → opacity 0
  const kdeData = useMemo(() => {
    if (!geoParr) return null
    const ctx = { ent, year, entData, pobData, isMort, detData, mcdaData }
    const raw = []                         // observadas → splat
    const interpCandidates = []            // [{ key, latlng, feature }]
    const maskFeatures = []                // observadas + interpoladas
    const noDataFeatures = []              // pob=0 / sin entrada
    const noDataKeys = new Set()
    const interpKeys = new Set()
    const observedValues = new Map()       // key → value observado

    for (const f of geoParr.features) {
      const p = f.properties || {}
      const key = getParroquiaKey(p)
      const provKey = getParroquiaProvKey(p)
      const inProv = !provFilter || provKey === provFilter

      let res
      if (module_ === 'determinantes')      res = det_vuln_value(key, ctx)
      else if (module_ === 'mcda')          res = mcda_total_value(key, ctx)
      else                                  res = carga_value(key, ctx)
      const { value: v, status } = res

      if (!inProv) continue
      const c = centroidOf(f.geometry)

      if (status === 'nodata' || !c) {
        // pob=0, sin entrada JSON, o centroide inválido → bucket gris
        noDataFeatures.push(f)
        noDataKeys.add(key)
        continue
      }

      if (status === 'data') {
        // Observación directa — alimenta splat + mask
        maskFeatures.push(f)
        observedValues.set(key, v)
        raw.push({ key, prov: provKey, value: v, latlng: c })
      } else {
        // status === 'interp' → requiere IDW desde vecinas observadas
        maskFeatures.push(f)
        interpKeys.add(key)
        interpCandidates.push({ key, latlng: c })
      }
    }
    if (raw.length === 0) return null

    const m = raw.reduce((a, b) => a + b.value, 0) / raw.length
    const variance = raw.reduce((a, b) => a + (b.value - m) ** 2, 0) / raw.length
    const s = Math.sqrt(variance) || 1

    // IDW: rellenar las parroquias marcadas 'interp' con el promedio
    // ponderado por 1/d^p de sus k=5 vecinas observadas más cercanas.
    const interpValues = new Map()
    for (const { key, latlng } of interpCandidates) {
      const vInterp = idwInterpolate(latlng, raw)
      interpValues.set(key, vInterp)
    }

    // Bounds: incluyen conDato + sinDato (para que el mapa no se corte
    // si una provincia tiene huecos de información en las orillas)
    const src = (maskFeatures.length + noDataFeatures.length > 0)
      ? [...maskFeatures, ...noDataFeatures]
      : geoParr.features
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

    return {
      points: raw,
      mean: m, sd: s,
      maskFeatures,
      noDataKeys,
      interpKeys,
      observedValues,
      interpValues,
      noDataCount: noDataFeatures.length,
      interpCount: interpCandidates.length,
      bounds,
      metricLabel: label,
    }
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
      opacity: KDE_OVERLAY_OP,
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
  //    Lookup de valor combina observadas + interpoladas en un solo Map.
  const valuesByKey = useMemo(() => {
    const m = new Map()
    if (!kdeData) return m
    for (const [k, v] of kdeData.observedValues) m.set(k, v)
    for (const [k, v] of kdeData.interpValues)   m.set(k, v)
    return m
  }, [kdeData])

  if (!kdeData) return null
  const { mean, sd, metricLabel, noDataKeys, interpKeys } = kdeData
  const entLabel = ENT_LABEL[ent] || ent

  // Helper: convierte un z-score normalizado a un color RGB Turbo.
  // Usado para rellenar el polígono de parroquias cuyos pixels en el
  // canvas KDE quedaron NaN (lejos de toda observación, peso bajo el
  // umbral). Sin esto, las parroquias grandes con vecinos lejanos
  // muestran huecos blancos visibles dentro del heatmap.
  const fillFromValue = (val) => {
    if (!Number.isFinite(val) || sd === 0) return null
    const z = (val - mean) / sd
    // Mapeo lineal a 0..1 en una banda razonable (-2.5..+2.5).
    const t = Math.max(0, Math.min(1, (z + 2.5) / 5))
    const idx = Math.floor(t * 255) * 3
    return `rgb(${TURBO_LUT[idx]},${TURBO_LUT[idx + 1]},${TURBO_LUT[idx + 2]})`
  }

  // Estilo:
  //  · fueraProv (dim)  → invisible (opacity 0)
  //  · sinDato (inProv) → fill gris + borde punteado (estándar sin-dato)
  //  · conDato/interp   → fill Turbo de respaldo (cubre huecos KDE) +
  //                        stroke fino oscuro
  //  · seleccionada     → fill o stroke amarillo
  const styleFn = (feature) => {
    const p = feature.properties || {}
    const key = getParroquiaKey(p)
    const provKey = getParroquiaProvKey(p)
    const dim = provFilter && provKey !== provFilter
    const sel = selectedDpa && key === selectedDpa
    const noData = noDataKeys.has(key)

    if (dim) {
      return { fillOpacity: 0, opacity: 0, weight: 0 }
    }
    if (noData) {
      // Patrón visual distintivo: gris claro + borde punteado (OMS / CDC)
      return {
        fillColor:   '#e2e8f0',
        fillOpacity: sel ? 0.85 : 0.55,
        color:       sel ? '#fbc400' : '#94a3b8',
        weight:      sel ? 2.5 : 0.7,
        opacity:     sel ? 1 : 0.8,
        dashArray:   sel ? null : '2 3',
      }
    }
    // Fill de respaldo: color Turbo derivado del valor de la parroquia.
    // El L.imageOverlay del KDE va en kde-pane (z=350) DEBAJO del
    // overlayPane (z=400) donde viven los polígonos. Por eso el polígono
    // se renderiza ENCIMA del canvas — para que el KDE siga siendo el
    // protagonista visual donde existe, este fill va en opacity baja
    // (0.45 sin selección). En zonas donde el KDE quedó transparente
    // (lejos de centroides), el fill compensa y la parroquia se ve
    // pintada de su color esperado.
    const v = valuesByKey.get(key)
    const fallbackFill = fillFromValue(v)
    return {
      fillColor:   fallbackFill || 'transparent',
      fillOpacity: fallbackFill ? (sel ? 0.85 : 0.45) : 0,
      color:       sel ? '#fbc400' : '#0f172a',
      weight:      sel ? 2.5 : 0.4,
      opacity:     sel ? 1 : 0.5,
    }
  }

  const onEachFeature = (feature, layer) => {
    const p = feature.properties || {}
    const key = getParroquiaKey(p)
    const label = getParroquiaLabel(p)
    const v = valuesByKey.get(key)
    const noData   = noDataKeys.has(key)
    const isInterp = interpKeys.has(key)
    const z = Number.isFinite(v) ? (v - mean) / sd : NaN
    const clase = noData
      ? { txt: 'Sin información poblacional', color: '#64748b' }
    : isInterp
      ? { txt: 'Interpolado (IDW k=5)',       color: '#6366f1' }
      : claseFromZ(z)
    const scope   = module_ === 'carga' ? `${entLabel} · ${year}` : metricLabel
    // v=0 es información válida (cero epidemiológico); 'N/D' sólo cuando pob=0
    const vTxt    = Number.isFinite(v) ? v.toFixed(2) : 'N/D'
    const zTxt    = Number.isFinite(z) ? (z >= 0 ? '+' : '') + z.toFixed(2) : '—'
    const valueLbl = isInterp ? 'Valor (IDW)' : 'Valor'
    const valueCol = noData ? '#94a3b8' : isInterp ? '#6366f1' : '#1a1b4a'
    layer.bindTooltip(
      `<div style="font-family:Inter,sans-serif;line-height:1.3;min-width:200px">
         <div style="font-weight:600;color:#1a1b4a">${label}</div>
         <div style="color:#64748b;font-size:10.5px;margin-bottom:4px">${scope}</div>
         <div style="display:flex;justify-content:space-between;font-size:11px">
           <span style="color:#475569">${valueLbl}</span>
           <span style="font-family:'JetBrains Mono',monospace;color:${valueCol}">${vTxt}</span>
         </div>
         <div style="display:flex;justify-content:space-between;font-size:11px">
           <span style="color:#475569">z-score</span>
           <span style="font-family:'JetBrains Mono',monospace;color:${valueCol}">${zTxt}</span>
         </div>
         <div style="margin-top:3px;padding-top:3px;border-top:1px solid #e2e8f0;font-size:10.5px;font-weight:600;color:${clase.color}">${clase.txt}</div>
         ${noData  ? '<div style="margin-top:2px;font-size:9.5px;color:#94a3b8;font-style:italic">Pob. CPV 2022 = 0 · sin denominador</div>' : ''}
         ${isInterp ? '<div style="margin-top:2px;font-size:9.5px;color:#6366f1;font-style:italic">Sin reporte INEC directo · estimado desde 5 vecinas observadas</div>' : ''}
       </div>`,
      { sticky: true, direction: 'auto', opacity: 0.95 }
    )
    layer.on({
      click: () => setSelected(key, p),
      mouseover: e => {
        e.target.setStyle(noData
          ? { weight: 1.6, color: '#475569', opacity: 1, fillOpacity: 0.75 }
          : { weight: 1.6, color: '#0f172a', opacity: 1 }
        )
      },
      mouseout:  e => {
        const provKey = getParroquiaProvKey(p)
        const dim = provFilter && provKey !== provFilter
        const sel = selectedDpa && key === selectedDpa
        if (dim) {
          e.target.setStyle({ fillOpacity: 0, opacity: 0, weight: 0 })
        } else if (noData) {
          e.target.setStyle({
            weight:      sel ? 2.5 : 0.7,
            color:       sel ? '#fbc400' : '#94a3b8',
            opacity:     sel ? 1 : 0.8,
            fillOpacity: sel ? 0.85 : 0.55,
            dashArray:   sel ? null : '2 3',
          })
        } else {
          e.target.setStyle({
            weight:  sel ? 2.5 : 0.4,
            color:   sel ? '#fbc400' : '#0f172a',
            opacity: sel ? 1 : 0.5,
          })
        }
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
