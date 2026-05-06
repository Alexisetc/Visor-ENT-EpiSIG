// WelcomeModal — Mensaje de bienvenida al prototipo del Visor ENT.
//
// Layout matching del Manual de Diseño v2 (versión revisada por el usuario):
//   - Header navy con barra roja superior 2 px, iso EpiSIG (bricks),
//     overline "INSPI · VISOR PARROQUIAL", título grande.
//   - Body: párrafo institucional + callout navy de "datos simulados" +
//     tip card con borde rojo izquierdo + lista numerada.
//   - CTA grande rojo "Empezar a explorar".
//
// Se abre automáticamente la primera vez (controlado por localStorage)
// y se reabre desde el botón "Bienvenida" del Header.

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../../store'
import EpiLogo from '../brand/EpiLogo'

// Bumpeada a v4 al renovar el wordmark del header (logo SVG real).
export const WELCOME_LS_KEY = 'episig:welcome-seen-v4'

export default function WelcomeModal() {
  const modalOpen  = useStore(s => s.modalOpen)
  const closeModal = useStore(s => s.closeModal)

  useEffect(() => {
    if (modalOpen !== 'welcome') return
    const onKey = e => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen, closeModal])

  if (modalOpen !== 'welcome') return null

  function dismiss() {
    try { localStorage.setItem(WELCOME_LS_KEY, '1') } catch { /* sin localStorage: igual cerramos */ }
    closeModal()
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) dismiss() }}
    >
      <div className="max-h-[85vh] w-[680px] max-w-[92vw] overflow-y-auto rounded-[4px] bg-inspi-paper shadow-2xl">
        {/* === Header navy con barra roja superior y iso === */}
        <header className="relative bg-inspi-navy px-5 pb-4 pt-4 text-white">
          {/* Barra roja superior 2 px (eco del wordmark). */}
          <span className="absolute left-0 right-0 top-0 h-[2px] bg-inspi-red" />

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 rounded-[3px] bg-white px-2 py-0.5">
                <EpiLogo width={90} />
              </div>
              <div>
                <div className="font-display text-[9.5px] font-semibold uppercase tracking-[0.1em] text-white/60">
                  INSPI · Visor parroquial
                </div>
                <h2 className="mt-1 font-display text-[16px] font-bold leading-tight text-white">
                  Bienvenido al Visor de Enfermedades No Transmisibles
                </h2>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-slate-300 hover:bg-white/10 hover:text-white"
              aria-label="Cerrar bienvenida"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Línea acento rojo 3px bajo el header (eco del Header global). */}
        <div className="h-[3px] w-full bg-inspi-red" />

        {/* === Body === */}
        <div className="space-y-3 px-5 py-4 text-[13px] leading-relaxed text-slate-700">
          {/* Párrafo institucional */}
          <p>
            Esta es una <b>versión prototipo</b> del visor parroquial de Enfermedades
            No Transmisibles (ENT) del <b>EpiSIG · INSPI</b>. Integra datos territoriales,
            indicadores de carga de enfermedad y análisis multicriterio para orientar
            decisiones priorizadas en salud pública.
          </p>

          {/* Callout: datos simulados — borde navy (estandarizado) */}
          <div className="rounded-[3px] border border-inspi-navy/30 bg-inspi-navy/5 px-3 py-2 text-[12px] text-inspi-navy">
            Algunos módulos consumen{' '}
            <b>datos simulados estructurados</b> (ENSANUT-ECU, STEPS-OMS, GBD 2021)
            marcados con la etiqueta{' '}
            <span className="inline-flex items-center rounded-[3px] border border-inspi-line bg-inspi-bone px-1.5 py-px font-display text-[10px] font-bold uppercase tracking-[0.07em] text-inspi-navy">
              Simulación
            </span>.
          </div>

          {/* Tip card con borde rojo izquierdo */}
          <div className="rounded-[3px] border border-inspi-line bg-inspi-bone/40">
            <div className="border-l-[3px] border-inspi-red px-3 py-2.5">
              <div className="mb-1.5 flex items-center gap-1.5 font-display text-[11px] font-bold uppercase tracking-[0.07em] text-inspi-red">
                ▶ Tip rápido — Animación temporal
              </div>
              <ol className="list-decimal space-y-0.5 pl-5 text-[12.5px] text-slate-700 marker:font-semibold marker:text-inspi-navy">
                <li>Active el módulo <b>Carga de enfermedad</b>.</li>
                <li>Seleccione visualización <b>Hot Spots</b>.</li>
                <li>Pulse <b>▶ Reproducir</b> en el panel temporal para recorrer 2013–2024.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* === Footer con CTA grande rojo === */}
        <footer className="flex items-center justify-end gap-2 border-t border-inspi-line bg-inspi-bone px-5 py-3">
          <button
            onClick={dismiss}
            className="rounded-[3px] bg-inspi-red px-5 py-2 font-display text-[13px] font-bold text-white shadow-sm transition hover:brightness-110"
          >
            Empezar a explorar
          </button>
        </footer>
      </div>
    </div>
  )
}
