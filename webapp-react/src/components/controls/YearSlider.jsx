// YearSlider — Slider 2013→2024 + botón Play (toggle de animación).
// Rango actualizado tras Fase 3 del pipeline Python (2024 agregado).
// El timer real vive en hooks/usePlay.js que se monta una vez en CargaEnfermedad.

import { Play, Pause } from 'lucide-react'
import { useStore } from '../../store'
import { YEARS } from '../../hooks/usePlay'

export default function YearSlider() {
  const year       = useStore(s => s.year)
  const setYear    = useStore(s => s.setYear)
  const playing    = useStore(s => s.playing)
  const togglePlay = useStore(s => s.togglePlay)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <button
          onClick={togglePlay}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-inspi-red text-white shadow hover:brightness-110"
          title={playing ? 'Pausar animación' : 'Reproducir 2013→2024'}
          aria-label={playing ? 'Pausar' : 'Reproducir'}
        >
          {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>
        <div className="flex-1 text-right font-display text-2xl font-semibold leading-none text-inspi-navy">
          {year}
        </div>
      </div>
      <input
        type="range"
        min={YEARS[0]}
        max={YEARS[YEARS.length - 1]}
        step={1}
        value={year}
        onChange={e => setYear(Number(e.target.value))}
        className="w-full accent-inspi-red"
        aria-label="Año"
      />
      <div className="flex justify-between font-mono text-[10px] text-slate-400">
        <span>{YEARS[0]}</span>
        <span>{YEARS[YEARS.length - 1]}</span>
      </div>
    </div>
  )
}
