// ProvinceOverlay — Bordes amarillos de las 24 provincias (referencia visual).
// Siempre visible encima de cualquier capa. Sin interactividad (clic pasa a parroquias).

import { GeoJSON } from 'react-leaflet'
import { useStore } from '../../store'

const STYLE = {
  fillOpacity: 0,
  color: '#fbc400',
  weight: 1.2,
  opacity: 0.7,
  interactive: false,
}

export default function ProvinceOverlay() {
  const geoProv = useStore(s => s.geoProv)
  if (!geoProv) return null
  return <GeoJSON data={geoProv} style={STYLE} interactive={false} />
}
