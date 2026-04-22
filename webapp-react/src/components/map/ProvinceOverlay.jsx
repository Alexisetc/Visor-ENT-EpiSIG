// ProvinceOverlay — Bordes de las 24 provincias. Dos modos:
//   · Sin provFilter     → todas en amarillo suave y delgado (referencia)
//   · Con provFilter set → todas en gris muy tenue EXCEPTO la seleccionada,
//     que se dibuja con borde amarillo grueso y relleno traslúcido para que
//     "sepas qué provincia estás señalando".
//
// El overlay es no-interactivo: los clics pasan a las parroquias debajo.

import { GeoJSON } from 'react-leaflet'
import { useMemo } from 'react'
import { useStore } from '../../store'

function provCode(p) {
  return String(p.DPA_PROVIN ?? p.dpa_provin ?? p.PROV_CODE ?? p.code ?? '').padStart(2, '0')
}

export default function ProvinceOverlay() {
  const geoProv    = useStore(s => s.geoProv)
  const provFilter = useStore(s => s.provFilter)

  // Recalcula un key para forzar re-render del GeoJSON cuando cambia provFilter
  const key = useMemo(() => `prov-${provFilter || 'nac'}`, [provFilter])

  if (!geoProv) return null

  const styleFn = (feat) => {
    const p = feat.properties || {}
    const code = provCode(p)
    const isSelected = provFilter && code === provFilter

    if (!provFilter) {
      return {
        fillOpacity: 0,
        color: '#fbc400',
        weight: 1.2,
        opacity: 0.7,
      }
    }
    if (isSelected) {
      return {
        fillOpacity: 0.08,
        fillColor: '#fbc400',
        color: '#fbc400',
        weight: 3.5,
        opacity: 1,
        dashArray: null,
      }
    }
    // No seleccionada, con filtro activo
    return {
      fillOpacity: 0,
      color: '#94a3b8',
      weight: 0.8,
      opacity: 0.35,
    }
  }

  return (
    <GeoJSON
      key={key}
      data={geoProv}
      style={styleFn}
      interactive={false}
    />
  )
}
