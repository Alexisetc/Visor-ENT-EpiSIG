// HeatLayer — Hot Spots KDE qgis2web. Usa L.heatLayer (no nativo en react-leaflet)
// vía useMap() + useEffect. Replica gradient YlOrRd 9-stop, radius=8, blur=12 del
// preset "Hot Spot OVITRAMPAS Pacto 2020" (legacy L.1018-1100).
//
// Cada parroquia aporta un punto en su centroide con peso = casos (intensity).

import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet.heat'
import { useMap } from 'react-leaflet'
import { useStore } from '../../store'
import { getParroquiaKey, getParroquiaProvKey } from '../../lib/parroquia'
import { generateData } from '../../lib/rates'
import { GRADIENT_QGIS } from '../../lib/colors'

// Centroide rápido (promedio de coords). Suficiente para puntos KDE.
function centroidOf(geometry) {
  const acc = { x: 0, y: 0, n: 0 }
  const walk = c => {
    if (typeof c[0] === 'number') { acc.x += c[0]; acc.y += c[1]; acc.n++ }
    else c.forEach(walk)
  }
  walk(geometry.coordinates)
  return acc.n ? [acc.y / acc.n, acc.x / acc.n] : null
}

export default function HeatLayer() {
  const map        = useMap()
  const geoParr    = useStore(s => s.geoParr)
  const entData    = useStore(s => s.entData)
  const pobData    = useStore(s => s.pobData)
  const ent        = useStore(s => s.ent)
  const year       = useStore(s => s.year)
  const mapMetric  = useStore(s => s.mapMetric)
  const provFilter = useStore(s => s.provFilter)

  useEffect(() => {
    if (!geoParr || typeof L.heatLayer !== 'function') return

    const isMort = mapMetric === 'mortalidad'

    const points = []
    let maxW = 1
    for (const f of geoParr.features) {
      const p = f.properties || {}
      const provKey = getParroquiaProvKey(p)
      if (provFilter && provKey !== provFilter) continue
      const c = centroidOf(f.geometry)
      if (!c) continue
      const key = getParroquiaKey(p)
      const d = generateData(key, ent, year, entData, pobData)
      // Peso = conteo absoluto de la métrica activa (casos o muertes).
      // Fallback a la tasa /100k solo si no tenemos conteos (modo simulación).
      const count = isMort ? d.muertes : d.casos
      const rate  = isMort ? d.mortRate : d.rate
      const w = count > 0 ? count : (rate > 0 ? rate : 0)
      if (w > 0) {
        points.push([c[0], c[1], w])
        if (w > maxW) maxW = w
      }
    }

    const layer = L.heatLayer(points, {
      radius: 14,
      blur: 18,
      maxZoom: 12,
      max: maxW,
      gradient: GRADIENT_QGIS,
      minOpacity: 0.35,
    })
    layer.addTo(map)
    return () => { map.removeLayer(layer) }
  }, [map, geoParr, entData, pobData, ent, year, mapMetric, provFilter])

  return null
}
