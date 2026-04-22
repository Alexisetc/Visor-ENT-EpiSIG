// ZoomControls — Tres botones flotantes (acercar, alejar, restablecer) que
// reemplazan el control de zoom por defecto de Leaflet.
//
// Se monta FUERA de <MapContainer> (como overlay hermano del mapa) y recibe
// la instancia de Leaflet por prop `map`. Montarlo dentro del MapContainer
// provocaba que Leaflet se metiera con el flujo absoluto y los botones se
// renderizaran superpuestos.
//
// "Restablecer" lleva a:
//   · Vista nacional Ecuador continental (-1.6, -78.3 z=7) si no hay provFilter
//   · Bounds de la provincia activa si provFilter está set

import { ZoomIn, ZoomOut, Home } from 'lucide-react'
import { useStore } from '../../store'

const DEFAULT_CENTER = [-1.6, -78.3]
const DEFAULT_ZOOM   = 7

export default function ZoomControls({ map }) {
  const geoProv    = useStore(s => s.geoProv)
  const provFilter = useStore(s => s.provFilter)

  if (!map) return null

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

  const btn = 'flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-md transition hover:bg-inspi-navy hover:text-white hover:border-inspi-navy'

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-[500]">
      <div className="pointer-events-auto flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => map.zoomIn()}
          className={btn}
          title="Acercar zoom"
          aria-label="Acercar zoom"
        >
          <ZoomIn size={15} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={() => map.zoomOut()}
          className={btn}
          title="Alejar zoom"
          aria-label="Alejar zoom"
        >
          <ZoomOut size={15} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={reset}
          className={btn}
          title="Restablecer zoom"
          aria-label="Restablecer zoom"
        >
          <Home size={15} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}
