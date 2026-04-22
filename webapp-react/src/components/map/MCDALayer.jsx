// MCDALayer — Coropleta categórica por "ENT prioritaria #1".
// Colorea cada parroquia con el color del grupo ENT que ocupa el rank 1
// en el ranking MCDA local. Responde visualmente "¿en cuál ENT invierto
// aquí primero?" a escala parroquial.
//
// Datos:
//   mcdaData.parroquias[DPA6].ranking[] → ordenado por score desc.
//     [{ ent, score, color, normalized{...}, rank }]
//
// Parroquias sin registro MCDA se pintan gris.
// Tooltip: top-3 ENT con sus scores.

import { GeoJSON } from 'react-leaflet'
import { useStore } from '../../store'
import { getParroquiaKey, getParroquiaLabel, getParroquiaProvKey } from '../../lib/parroquia'
import { ENT_COLOR, ENT_LABEL } from '../../lib/colors'

export default function MCDALayer() {
  const geoParr     = useStore(s => s.geoParr)
  const mcdaData    = useStore(s => s.mcdaData)
  const provFilter  = useStore(s => s.provFilter)
  const selectedDpa = useStore(s => s.selectedDpa)
  const setSelected = useStore(s => s.setSelected)

  const styleFn = (feature) => {
    const p = feature.properties || {}
    const key = getParroquiaKey(p)
    const provKey = getParroquiaProvKey(p)
    const dim = provFilter && provKey !== provFilter
    const sel = selectedDpa && key === selectedDpa
    const row = mcdaData?.parroquias?.[key]
    const top = row?.ranking?.[0]
    const fillColor = top ? (top.color || ENT_COLOR[top.ent] || '#cbd5e1') : '#e2e8f0'
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
    const row = mcdaData?.parroquias?.[key]
    const ranking = row?.ranking || []
    let body
    if (!ranking.length) {
      body = `<div style="color:#94a3b8;font-size:11px">Sin datos MCDA</div>`
    } else {
      const top3 = ranking.slice(0, 3).map((r, i) => `
        <div style="display:flex;align-items:center;gap:6px;margin-top:2px">
          <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${r.color || ENT_COLOR[r.ent] || '#94a3b8'}"></span>
          <span style="font-size:11px;color:#475569">#${i + 1} ${ENT_LABEL[r.ent] || r.ent}</span>
          <span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#1a1b4a">${Number(r.score || 0).toFixed(3)}</span>
        </div>`).join('')
      body = `<div style="font-size:10.5px;color:#64748b;margin-bottom:2px">ENT priorizadas (top-3)</div>${top3}`
    }
    layer.bindTooltip(
      `<div style="font-family:Inter,sans-serif;line-height:1.3;min-width:200px">
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

  const layerKey = `mcda|${provFilter || 'nat'}|${selectedDpa || 'none'}`
  return (
    <GeoJSON
      key={layerKey}
      data={geoParr}
      style={styleFn}
      onEachFeature={onEachFeature}
    />
  )
}
