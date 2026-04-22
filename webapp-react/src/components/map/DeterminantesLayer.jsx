// DeterminantesLayer — Coropleta categórica por "determinante dominante".
// Colorea cada parroquia con el color del determinante cuyo |β| MGWR es
// el más alto para la ENT activa. Cuando ent='todas', usa el promedio de
// |β| sobre las 5 ENT.
//
// Datos:
//   mgwrData.parroquias[DPA6].betas[ENT][det] → coeficiente β local
//
// Para parroquias sin registro MGWR (~2%), se pinta gris claro.
// Tooltip muestra el top-3 de determinantes con sus |β|.

import { GeoJSON } from 'react-leaflet'
import { useStore } from '../../store'
import { getParroquiaKey, getParroquiaLabel, getParroquiaProvKey } from '../../lib/parroquia'
import { DET_COLOR, DET_LABEL, DETS, ENT_LABEL, ENTS } from '../../lib/colors'

// Calcula ranking de determinantes para una parroquia + ENT (o promedio todas)
function rankDeterminants(mgwrRow, ent) {
  if (!mgwrRow?.betas) return []
  const scores = {}
  if (ent === 'todas') {
    // Promedio de |β| sobre las 5 ENT
    for (const d of DETS) {
      let sum = 0, n = 0
      for (const e of ENTS) {
        const b = mgwrRow.betas[e]?.[d]
        if (Number.isFinite(b)) { sum += Math.abs(b); n++ }
      }
      scores[d] = n > 0 ? sum / n : 0
    }
  } else {
    const betas = mgwrRow.betas[ent] || {}
    for (const d of DETS) {
      scores[d] = Math.abs(Number(betas[d] || 0))
    }
  }
  return Object.entries(scores)
    .map(([det, score]) => ({ det, score }))
    .sort((a, b) => b.score - a.score)
}

export default function DeterminantesLayer() {
  const geoParr     = useStore(s => s.geoParr)
  const mgwrData    = useStore(s => s.mgwrData)
  const ent         = useStore(s => s.ent)
  const provFilter  = useStore(s => s.provFilter)
  const selectedDpa = useStore(s => s.selectedDpa)
  const setSelected = useStore(s => s.setSelected)

  const styleFn = (feature) => {
    const p = feature.properties || {}
    const key = getParroquiaKey(p)
    const provKey = getParroquiaProvKey(p)
    const dim = provFilter && provKey !== provFilter
    const sel = selectedDpa && key === selectedDpa
    const row = mgwrData?.parroquias?.[key]
    const ranking = rankDeterminants(row, ent)
    const top = ranking[0]
    const fillColor = top && top.score > 0
      ? (DET_COLOR[top.det] || '#cbd5e1')
      : '#e2e8f0'                                      // sin datos MGWR → gris
    return {
      fillColor,
      weight: sel ? 2.5 : 0.4,
      color: sel ? '#fbc400' : '#374151',
      fillOpacity: dim ? 0.15 : 0.78,
      opacity: dim ? 0.4 : 1,
    }
  }

  const onEachFeature = (feature, layer) => {
    const p = feature.properties || {}
    const key = getParroquiaKey(p)
    const label = getParroquiaLabel(p)
    const row = mgwrData?.parroquias?.[key]
    const ranking = rankDeterminants(row, ent)
    const entLabel = ENT_LABEL[ent] || ent
    let body
    if (!ranking.length || ranking[0].score === 0) {
      body = `<div style="color:#94a3b8;font-size:11px">Sin datos MGWR</div>`
    } else {
      const top3 = ranking.slice(0, 3).map((r, i) => `
        <div style="display:flex;align-items:center;gap:6px;margin-top:2px">
          <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${DET_COLOR[r.det] || '#94a3b8'}"></span>
          <span style="font-size:11px;color:#475569">${i + 1}. ${DET_LABEL[r.det] || r.det}</span>
          <span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#1a1b4a">|β|=${r.score.toFixed(2)}</span>
        </div>`).join('')
      body = `<div style="font-size:10.5px;color:#64748b;margin-bottom:2px">Determinantes · ${entLabel}</div>${top3}`
    }
    layer.bindTooltip(
      `<div style="font-family:Inter,sans-serif;line-height:1.3;min-width:190px">
         <div style="font-weight:600;color:#1a1b4a;margin-bottom:4px">${label}</div>
         ${body}
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
          weight: sel ? 2.5 : 0.4,
          color: sel ? '#fbc400' : '#374151',
          opacity: dim ? 0.4 : 1,
        })
      },
    })
  }

  const layerKey = `det|${ent}|${provFilter || 'nat'}|${selectedDpa || 'none'}`
  return (
    <GeoJSON
      key={layerKey}
      data={geoParr}
      style={styleFn}
      onEachFeature={onEachFeature}
    />
  )
}
