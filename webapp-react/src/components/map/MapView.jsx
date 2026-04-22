// MapView — Contenedor base react-leaflet. Renderiza tile, provincias y la
// capa activa (Choropleth | Heatmap). La priorización usa coropletas también,
// así que se colapsa sobre el mismo layer type.
//
// Centro inicial: Ecuador continental (-1.6, -78.3) zoom 7.
// Tile: CartoDB Positron NO LABELS — mapa base neutro sin nombres de ciudades
// (el usuario pidió eliminarlos porque distraen y compiten con las coropletas).

import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import { useStore } from '../../store'
import ChoroplethLayer from './ChoroplethLayer'
import HeatLayer from './HeatLayer'
import ProvinceOverlay from './ProvinceOverlay'
import ZoomControls from './ZoomControls'
import Legend from './Legend'

// --- helper: hace fitBounds a la provincia seleccionada (o a Ecuador entero) ---
function FitToProvince() {
  const map        = useMap()
  const geoProv    = useStore(s => s.geoProv)
  const provFilter = useStore(s => s.provFilter)

  useEffect(() => {
    if (!geoProv) return
    if (!provFilter) {
      map.setView([-1.6, -78.3], 7, { animate: true })
      return
    }
    const f = (geoProv.features || []).find(ft => {
      const p = ft.properties || {}
      const code = String(p.DPA_PROVIN ?? p.dpa_provin ?? p.PROV_CODE ?? p.code ?? '').padStart(2, '0')
      return code === provFilter
    })
    if (!f) return
    const coords = []
    const walk = c => {
      if (typeof c[0] === 'number') coords.push([c[1], c[0]])
      else c.forEach(walk)
    }
    walk(f.geometry.coordinates)
    if (coords.length) {
      const lats = coords.map(c => c[0])
      const lngs = coords.map(c => c[1])
      map.fitBounds([[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]], {
        padding: [20, 20], animate: true,
      })
    }
  }, [provFilter, geoProv, map])

  return null
}

export default function MapView() {
  const layerType = useStore(s => s.layerType)
  const geoParr   = useStore(s => s.geoParr)

  const ready = !!geoParr

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[-1.6, -78.3]}
        zoom={7}
        scrollWheelZoom
        zoomControl={false}
        className="h-full w-full"
        style={{ background: '#eef3f7' }}
      >
        {/* Basemap SIN nombres de ciudades (light_nolabels) */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a> · OSM'
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        />

        {ready && layerType === 'coropleta' && <ChoroplethLayer />}
        {ready && layerType === 'heatmap'   && <HeatLayer />}

        <ProvinceOverlay />
        <ZoomControls />
        <FitToProvince />
      </MapContainer>

      {!ready && (
        <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center bg-white/70">
          <div className="rounded-lg bg-white px-4 py-2 text-xs text-slate-600 shadow">
            Cargando capa parroquial OTP…
          </div>
        </div>
      )}

      <Legend />
    </div>
  )
}
