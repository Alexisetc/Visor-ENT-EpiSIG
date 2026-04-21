// ChoroplethLayer — Capa de coropletas parroquiales por quintil.
// Replica parroquiaStyle (legacy L.886-940). Aplica:
//   - color de fillColor según quintil (computeQuintiles)
//   - dimming (opacity 0.3) para parroquias fuera de provFilter
//   - highlight (yellow border) para selectedDpa
//   - popup hover + click → store.setSelected
//
// Truco react-leaflet: usamos `key` derivada de (ent, year, layerType, provFilter)
// para forzar remount cuando cambian; así evitamos imperativo setStyle.

import { useMemo } from 'react'
import { GeoJSON } from 'react-leaflet'
import { useStore } from '../../store'
import { getParroquiaKey, getParroquiaLabel, getParroquiaProvKey } from '../../lib/parroquia'
import { generateData } from '../../lib/rates'
import { computeQuintiles, getColor } from '../../lib/quintiles'
import { ENT_LABEL } from '../../lib/colors'

export default function ChoroplethLayer() {
  const geoParr     = useStore(s => s.geoParr)
  const entData     = useStore(s => s.entData)
  const pobData     = useStore(s => s.pobData)
  const ent         = useStore(s => s.ent)
  const year        = useStore(s => s.year)
  const provFilter  = useStore(s => s.provFilter)
  const selectedDpa = useStore(s => s.selectedDpa)
  const setSelected = useStore(s => s.setSelected)

  const limits = useMemo(
    () => computeQuintiles(ent, year, geoParr, entData, pobData),
    [ent, year, geoParr, entData, pobData]
  )

  const styleFn = (feature) => {
    const p = feature.properties || {}
    const key = getParroquiaKey(p)
    const provKey = getParroquiaProvKey(p)
    const dim = provFilter && provKey !== provFilter
    const sel = selectedDpa && key === selectedDpa
    const d = generateData(key, ent, year, entData, pobData)
    const fillColor = getColor(d.rate, ent, limits)
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
    const d = generateData(key, ent, year, entData, pobData)
    layer.bindTooltip(
      `<div style="font-family:Inter,sans-serif;line-height:1.3">
         <div style="font-weight:600;color:#1a1b4a">${label}</div>
         <div style="color:#64748b;font-size:11px">${ENT_LABEL[ent] || ent} · ${year}</div>
         <div style="margin-top:4px;font-family:'JetBrains Mono',monospace">
           <b>${d.rate.toFixed(1)}</b> /100k · <b>${d.casos.toLocaleString('es')}</b> casos
         </div>
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

  // Forzar remount cuando cambia color/quintiles (evita imperativo setStyle masivo)
  const layerKey = `${ent}|${year}|${provFilter || 'nat'}|${selectedDpa || 'none'}`

  return (
    <GeoJSON
      key={layerKey}
      data={geoParr}
      style={styleFn}
      onEachFeature={onEachFeature}
    />
  )
}
