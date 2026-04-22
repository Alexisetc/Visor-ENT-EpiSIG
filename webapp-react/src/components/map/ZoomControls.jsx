// ZoomControls — Tres botones flotantes (acercar, alejar, restablecer) que
// reemplazan el control de zoom por defecto de Leaflet. Se renderiza fuera del
// <MapContainer> pero recibe la instancia del mapa vía useMap() si está dentro,
// o vía ref externa. Aquí lo colocamos DENTRO del MapContainer para acceder
// directamente a useMap().
//
// "Restablecer" lleva a:
//   · Vista nacional Ecuador continental (-1.6, -78.3 z=7) si no hay provFilter
//   · Bounds de la provincia activa si provFilter está set

import { useMap } from 'react-leaflet'
import { ZoomIn, ZoomOut, Home } from 'lucide-react'
import { useStore } from '../../store'

const DEFAULT_CENTER = [-1.6, -78.3]
const DEFAULT_ZOOM   = 7

export default function ZoomControls() {
  const map        = useMap()
  const geoProv    = useStore(s => s.geoProv)
  const provFilter = useStore(s => s.provFilter)

  const reset = () => {
    if (provFilter && geoProv) {
      const f = (geoProv.features || []).find(ft => {
        const p = ft.properties || {}
        const code = String(p.DPA_PROVIN ?? p.dpa_provin ?? p.PROV_CODE ?? p.code ?? '').padStart(2, '0')
        return code === provFilter
      })
      if (f) {
        const coords = []
        const walk = c => {
          if (typeof c[0] === 'number') coords.push([c[1], c[0]])
          else c.forEach(walk)
        }
        walk(f.geometry.coordinates)
        if (coords.length) {
          const lats = coords.map(c => c[0])
          const lngs = coords.map(c => c[1])
          map.fitBounds(
            [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
            { padding: [20, 20], animate: true }
          )
          return
        }
      }
    }
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true })
  }

  return (
    <div className="absolute left-3 top-3 z-[500] flex flex-col gap-1">
      <button
        onClick={() => map.zoomIn()}
        className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white/95 text-slate-700 shadow-md backdrop-blur transition hover:bg-inspi-navy hover:text-white"
        title="Acercar zoom"
        aria-label="Acercar zoom"
      >
        <ZoomIn size={14} strokeWidth={2.2} />
      </button>
      <button
        onClick={() => map.zoomOut()}
        className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white/95 text-slate-700 shadow-md backdrop-blur transition hover:bg-inspi-navy hover:text-white"
        title="Alejar zoom"
        aria-label="Alejar zoom"
      >
        <ZoomOut size={14} strokeWidth={2.2} />
      </button>
      <button
        onClick={reset}
        className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white/95 text-slate-700 shadow-md backdrop-blur transition hover:bg-inspi-navy hover:text-white"
        title="Restablecer zoom"
        aria-label="Restablecer zoom"
      >
        <Home size={14} strokeWidth={2.2} />
      </button>
    </div>
  )
}
