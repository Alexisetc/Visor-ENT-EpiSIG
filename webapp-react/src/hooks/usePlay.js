// usePlay — Timer que avanza el año 2013→2023 cíclicamente cuando state.playing
// es true. Replica el botón Play del visor legacy (~400 ms por año).

import { useEffect } from 'react'
import { useStore } from '../store'

export const YEARS = Array.from({ length: 11 }, (_, i) => 2013 + i)  // 2013..2023
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
