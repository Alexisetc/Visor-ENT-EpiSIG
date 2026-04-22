// usePlay — Timer que avanza el año 2013→2024 cíclicamente cuando state.playing
// es true. Replica el botón Play del visor legacy (~600 ms por año).
//
// Rango actualizado a 2024 tras Fase 3 del pipeline Python (se agregó el año
// 2024 con microdatos abiertos INEC: egresos_hospitalarios_2024.csv y
// EDG_2024.csv).

import { useEffect } from 'react'
import { useStore } from '../store'

export const YEARS = Array.from({ length: 12 }, (_, i) => 2013 + i)  // 2013..2024
const STEP_MS = 600

export function usePlay() {
  const playing = useStore(s => s.playing)
  const setYear = useStore(s => s.setYear)
  const year    = useStore(s => s.year)

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      const i = YEARS.indexOf(year)
      const next = YEARS[(i + 1) % YEARS.length]
      setYear(next)
    }, STEP_MS)
    return () => clearInterval(t)
  }, [playing, year, setYear])
}
