// MapView — Contenedor base react-leaflet. Renderiza tile, provincias y la
// capa activa según el módulo analítico + layerType:
//
//   module='carga'         layer='coropleta' → ChoroplethLayer  (tasa /100k por quintiles)
//                          layer='heatmap'   → HotSpotLayer     (bipolar z-score de la tasa)
//   module='determinantes' layer='coropleta' → DeterminantesLayer (determinante dominante categórico)
//                          layer='heatmap'   → HotSpotLayer     (bipolar z-score del índice de vulnerabilidad)
//   module='mcda'          layer='coropleta' → MCDALayer        (ENT #1 categórica)
//                          layer='heatmap'   → HotSpotLayer     (bipolar z-score del score MCDA total)
//
// HotSpotLayer es el reemplazo universal del antiguo KDE unipolar: aplica una
// escala diverging RdBu invertida (rojo=hot / blanco=neutral / azul=cold),
// estilo Getis-Ord Gi* / LISA clásico.
//
// Centro inicial: Ecuador continental (-1.6, -78.3) zoom 7.
// Tile: CartoDB Positron NO LABELS — mapa base neutro sin nombres de ciudades.
//
// ZoomControls se monta FUERA del MapContainer: si se renderiza dentro, Leaflet
// reorganiza los hijos y los botones se superponen. Usamos ref={setMap} para
// capturar la instancia y se la pasamos al overlay como prop.

import { MapContainer, TileLayer, AttributionControl, useMap } from 'react-leaflet'
import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import ChoroplethLayer     from './ChoroplethLayer'
import DeterminantesLayer  from './DeterminantesLayer'
import MCDALayer           from './MCDALayer'
import HotSpotLayer        from './HotSpotLayer'
import ProvinceOverlay     from './ProvinceOverlay'
import ZoomControls        from './ZoomControls'
import Legend              from './Legend'

// --- helper: hace fitBounds a la provincia seleccionada (o a Ecuador entero) ---
function FitToProvince() {
  const map        = useMap()
  const geoProv    = useStore(s => s.geoProv)
  const provFilter = useStore(s => s.provFilter)

  useEffect(() => {
    if (!geoProv) return
    if (!provFilter) {
      map.setView([-1.8, -78.4], 6, { animate: true })
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
  const module    = useStore(s => s.module)
  const geoParr   = useStore(s => s.geoParr)
  const [map, setMap] = useState(null)

  const ready = !!geoParr

  // Selector de layer por módulo + tipo. Si el layer es "heatmap" siempre
  // cae a HotSpotLayer (bipolar z-score); si es "coropleta" elige el layer
  // categórico/cuantitativo propio del módulo.
  const renderLayer = () => {
    if (!ready) return null
    if (layerType === 'heatmap') return <HotSpotLayer />
    switch (module) {
      case 'determinantes': return <DeterminantesLayer />
      case 'mcda':          return <MCDALayer />
      default:              return <ChoroplethLayer />
    }
  }

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[-1.8, -78.4]}
        zoom={6}
        scrollWheelZoom
        zoomControl={false}
        attributionControl={false}
        ref={setMap}
        className="h-full w-full"
        style={{ background: '#eef3f7' }}
      >
        {/* Atribución reposicionada a bottom-left para no chocar con la leyenda
            (que vive en bottom-right). Default Leaflet la coloca en bottom-right. */}
        <AttributionControl position="bottomleft" prefix={false} />

        {/* Basemap SIN nombres de ciudades (light_nolabels) */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a> · OSM'
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        />

        {renderLayer()}

        <ProvinceOverlay />
        <FitToProvince />
      </MapContainer>

      {/* Overlays DOM sobre el mapa (fuera del leaflet-container) */}
      <ZoomControls map={map} />

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
