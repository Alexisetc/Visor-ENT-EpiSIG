// WelcomeModal — Mensaje de bienvenida al prototipo EpiSIG.
//
// Se abre automáticamente la primera vez que el usuario visita el visor
// (controlado por localStorage). Después se puede reabrir desde el botón
// "Bienvenida" del Header. Patrón visual idéntico a MetodologiaModal.

import { useEffect } from 'react'
import { X, Sparkles, Lightbulb, Activity, Flame, Play } from 'lucide-react'
import { useStore } from '../../store'

export const WELCOME_LS_KEY = 'episig:welcome-seen-v1'

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
      <div className="max-h-[85vh] w-[640px] max-w-[92vw] overflow-y-auto rounded-lg bg-white shadow-2xl">
        {/* Cabecera */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-inspi-navy to-violet-700 px-5 py-3 text-white">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-inspi-yellow" />
            <h2 className="font-display text-base font-semibold">
              Bienvenido a EpiSIG · Global Health Platform
            </h2>
          </div>
          <button
            onClick={dismiss}
            className="rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="Cerrar bienvenida"
          >
            <X size={16} />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4 text-sm leading-relaxed text-slate-700">
          {/* Descripción del prototipo */}
          <p>
            Esta es una <b>versión prototipo</b> de <b>EpiSIG · Global Health Platform</b>,
            una plataforma geoespacial diseñada para fortalecer la toma de decisiones en
            salud pública y la vigilancia epidemiológica en el Ecuador. Integra datos
            territoriales, indicadores de carga de enfermedad y análisis multicriterio
            con el fin de comprender los patrones espaciales de las{' '}
            <b>enfermedades no transmisibles (ENT)</b> y orientar acciones priorizadas
            sobre el territorio.
          </p>

          {/* Recordatorio de prototipo */}
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Algunos módulos consumen <b>datos simulados estructurados</b> mientras
            avanzan los proyectos científicos asociados. Encontrarás esa marca como
            etiqueta <span className="font-semibold uppercase tracking-wider">simulación</span>{' '}
            junto al nombre del módulo en el panel izquierdo.
          </div>

          {/* Tip rápido */}
          <div className="rounded-lg border-2 border-violet-200 bg-violet-50/60 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-violet-800">
              <Lightbulb size={13} /> Tip rápido — animación de evolución temporal
            </div>
            <p className="text-xs leading-relaxed text-slate-700">
              Para visualizar la transición espacial y temporal de una ENT en el
              Ecuador continental:
            </p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-xs">
              <li>
                Ingrese al módulo{' '}
                <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 font-medium text-rose-700">
                  <Activity size={11} /> Carga de Enfermedad
                </span>{' '}
                en el panel izquierdo.
              </li>
              <li>
                Seleccione la visualización{' '}
                <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-1.5 py-0.5 font-medium text-orange-700">
                  <Flame size={11} /> Hot Spot
                </span>.
              </li>
              <li>
                En la barra inferior haga clic en{' '}
                <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700">
                  <Play size={11} /> Reproducir evolución temporal
                </span>.
              </li>
            </ol>
            <p className="mt-2 text-[11px] italic text-violet-800">
              La animación recorre la serie 2013–2024 mostrando cómo se difunde la
              enfermedad seleccionada a lo largo del territorio.
            </p>
          </div>
        </div>

        {/* Footer con CTA */}
        <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            onClick={dismiss}
            className="rounded bg-inspi-navy px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-inspi-navy-2"
          >
            Empezar a explorar
          </button>
        </footer>
      </div>
    </div>
  )
}
