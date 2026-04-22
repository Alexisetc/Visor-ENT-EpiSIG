// HotSpotLayer — Coropleta bipolar rojo-azul (estilo Getis-Ord Gi* / LISA).
// Para cada parroquia computa un z-score contra la media/desv. estándar
// nacional de la métrica activa del módulo, y pinta con la escala
// HOTSPOT_BIPOLAR (9 stops RdBu invertida):
//   z ≥ +2.5 → rojo oscuro · z ≈ 0 → blanco · z ≤ -2.5 → azul oscuro.
//
// Métricas por módulo:
//   · carga         → tasa /100k del ENT activo (morb OR mort según mapMetric)
//   · determinantes → "índice de vulnerabilidad compuesto" — suma
//                     estandarizada de los 7 determinantes, todos orientados
//                     a "mayor = peor" (acceso_salud_km también es peor si es
//                     alto porque indica lejanía al servicio).
//   · mcda          → score MCDA total (suma de los 5 ENT ranking scores)
//
// Nota: no es Gi* estricto (sin matriz de pesos espaciales), pero preserva
// la semántica visual del hot-spot clásico. Gi* exacto queda como TODO en
// Sprint 4 vía pysal.

import { useMemo } from 'react'
import { GeoJSON } from 'react-leaflet'
import { useStore } from '../../store'
import {
  getParroquiaKey, getParroquiaLabel, getParroquiaProvKey,
} from '../../lib/parroquia'
import { generateData } from '../../lib/rates'
import {
  HOTSPOT_BIPOLAR, HOTSPOT_BREAKS, ENT_LABEL, DETS_FULL, ENTS,
} from '../../lib/colors'

// ───── helpers: métricas por módulo ─────

function carga_value(key, { ent, year, entData, pobData, isMort }) {
  const d = generateData(key, ent, year, entData, pobData)
  return isMort ? d.mortRate : d.rate
}

function det_vuln_value(key, { detData }) {
  const row = detData?.parroquias?.[key]
  if (!row) return null
  // Suma ponderada (equi-pesos) de los 7 determinantes normalizados contra
  // un max plausible de cada uno. Mayor = peor. acceso_salud_km mayor = peor
  // (más lejos del servicio). Todos ya están en unidades "mayor = peor".
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
  return n > 0 ? sum / n : null  // promedio normalizado 0..1
}

function mcda_total_value(key, { mcdaData }) {
  const row = mcdaData?.parroquias?.[key]
  if (!row) return null
  const ranking = row.ranking || []
  if (ranking.length === 0) return null
  // Suma de scores de las 5 ENT — proxy de "carga priorizada total"
  let sum = 0, n = 0
  for (const r of ranking) {
    const s = Number(r.score)
    if (Number.isFinite(s)) { sum += s; n++ }
  }
  return n > 0 ? sum : null
}

// ───── color por z-score ─────

function colorFromZ(z) {
  if (!Number.isFinite(z)) return '#e2e8f0'
  // HOTSPOT_BREAKS tiene 10 thresholds → 9 stops en HOTSPOT_BIPOLAR
  for (let i = 0; i < HOTSPOT_BREAKS.length; i++) {
    if (z <= HOTSPOT_BREAKS[i]) return HOTSPOT_BIPOLAR[Math.min(i, HOTSPOT_BIPOLAR.length - 1)]
  }
  return HOTSPOT_BIPOLAR[HOTSPOT_BIPOLAR.length - 1]
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

  // 1) Calcula el valor crudo por parroquia
  // 2) Mean + sd global (todo el país, no solo la provincia visible — la
  //    comparación z es "contra la media nacional")
  // 3) z-score por parroquia → color
  const { values, mean, sd, metricLabel } = useMemo(() => {
    const vals = new Map()
    if (!geoParr) return { values: vals, mean: 0, sd: 1, metricLabel: '' }
    const ctx = { ent, year, entData, pobData, isMort, detData, mcdaData }
    for (const f of geoParr.features) {
      const p = f.properties || {}
      const key = getParroquiaKey(p)
      let v = null
      if (module === 'determinantes')       v = det_vuln_value(key, ctx)
      else if (module === 'mcda')           v = mcda_total_value(key, ctx)
      else                                  v = carga_value(key, ctx)
      if (Number.isFinite(v)) vals.set(key, v)
    }
    const arr = Array.from(vals.values()).filter(v => Number.isFinite(v) && v > 0)
    if (arr.length === 0) return { values: vals, mean: 0, sd: 1, metricLabel: '' }
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length
    const sd = Math.sqrt(variance) || 1
    const label =
      module === 'determinantes' ? 'Índice de vulnerabilidad (determinantes)'
    : module === 'mcda'          ? 'Score MCDA total'
    :                              (isMort ? 'Tasa mortalidad /100k' : 'Tasa morbilidad /100k')
    return { values: vals, mean, sd, metricLabel: label }
  }, [geoParr, module, ent, year, entData, pobData, detData, mcdaData, isMort])

  const styleFn = (feature) => {
    const p = feature.properties || {}
    const key = getParroquiaKey(p)
    const provKey = getParroquiaProvKey(p)
    const dim = provFilter && provKey !== provFilter
    const sel = selectedDpa && key === selectedDpa
    const v = values.get(key)
    const z = Number.isFinite(v) ? (v - mean) / sd : NaN
    const fillColor = colorFromZ(z)
    return {
      fillColor,
      weight: sel ? 2.5 : 0.3,
      color: sel ? '#fbc400' : '#334155',
      fillOpacity: dim ? 0.12 : 0.82,
      opacity: dim ? 0.4 : 1,
    }
  }

  const onEachFeature = (feature, layer) => {
    const p = feature.properties || {}
    const key = getParroquiaKey(p)
    const label = getParroquiaLabel(p)
    const v = values.get(key)
    const z = Number.isFinite(v) ? (v - mean) / sd : NaN
    const entLabel = ENT_LABEL[ent] || ent
    const clase =
      !Number.isFinite(z)    ? { txt: 'Sin datos',      color: '#94a3b8' }
    : z >= 1.5               ? { txt: 'Hot-spot fuerte', color: '#b2182b' }
    : z >= 0.5               ? { txt: 'Hot-spot leve',   color: '#f4a582' }
    : z <= -1.5              ? { txt: 'Cold-spot fuerte',color: '#2166ac' }
    : z <= -0.5              ? { txt: 'Cold-spot leve',  color: '#92c5de' }
    :                          { txt: 'Cerca de la media', color: '#64748b' }
    const scope = module === 'carga' ? `${entLabel} · ${year}` : metricLabel
    layer.bindTooltip(
      `<div style="font-family:Inter,sans-serif;line-height:1.3;min-width:200px">
         <div style="font-weight:600;color:#1a1b4a">${label}</div>
         <div style="color:#64748b;font-size:10.5px;margin-bottom:4px">${scope}</div>
         <div style="display:flex;justify-content:space-between;font-size:11px">
           <span style="color:#475569">Valor</span>
           <span style="font-family:'JetBrains Mono',monospace;color:#1a1b4a">${Number.isFinite(v) ? v.toFixed(2) : '—'}</span>
         </div>
         <div style="display:flex;justify-content:space-between;font-size:11px">
           <span style="color:#475569">z-score</span>
           <span style="font-family:'JetBrains Mono',monospace;color:#1a1b4a">${Number.isFinite(z) ? (z >= 0 ? '+' : '') + z.toFixed(2) : '—'}</span>
         </div>
         <div style="margin-top:3px;padding-top:3px;border-top:1px solid #e2e8f0;font-size:10.5px;font-weight:600;color:${clase.color}">${clase.txt}</div>
       </div>`,
      { sticky: true, direction: 'auto', opacity: 0.95 }
    )
    layer.on({
      click: () => setSelected(key, p),
      mouseover: e => e.target.setStyle({ weight: 2, color: '#1a1b4a' }),
      mouseout:  e => {
        const sel = key === selectedDpa
        const provKey = getParroquiaProvKey(p)
        const dim = provFilter && provKey !== provFilter
        e.target.setStyle({
          weight: sel ? 2.5 : 0.3,
          color: sel ? '#fbc400' : '#334155',
          opacity: dim ? 0.4 : 1,
        })
      },
    })
  }

  // remount clave por módulo/ent/year/métrica para evitar setStyle manual
  const layerKey = `hot|${module}|${ent}|${year}|${isMort ? 'M' : 'B'}|${provFilter || 'nat'}|${selectedDpa || 'none'}`

  return (
    <GeoJSON
      key={layerKey}
      data={geoParr}
      style={styleFn}
      onEachFeature={onEachFeature}
    />
  )
}
