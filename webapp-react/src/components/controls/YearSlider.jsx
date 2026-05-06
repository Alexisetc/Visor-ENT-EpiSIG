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
    <div className="space-y-2 rounded-[3px] border border-inspi-line bg-white p-2.5">
      <div className="flex items-center gap-2.5">
        <button
          onClick={togglePlay}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-inspi-red text-white shadow-md transition hover:brightness-110"
          title={playing ? 'Pausar animación' : 'Reproducir evolución temporal 2013→2024'}
          aria-label={playing ? 'Pausar' : 'Reproducir'}
        >
          {playing ? <Pause size={15} strokeWidth={2.4} /> : <Play size={15} strokeWidth={2.4} className="ml-0.5" />}
        </button>
        <div className="flex-1 text-right leading-tight">
          <div className="font-mono text-[24px] font-bold text-inspi-navy tnum">{year}</div>
          <div className="font-display text-[9px] font-semibold uppercase tracking-[0.1em] text-inspi-muted">
            Serie {YEARS[0]}–{YEARS[YEARS.length - 1]}
          </div>
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
      <div className="flex justify-between font-mono text-[9.5px] font-medium text-inspi-muted tnum">
        <span>{YEARS[0]}</span>
        <span>{YEARS[YEARS.length - 1]}</span>
      </div>
    </div>
  )
}
