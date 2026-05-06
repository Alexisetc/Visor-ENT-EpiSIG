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
import GeoEntLogo from '../brand/GeoEntLogo'

// Bumpeada a v6 al renovar el pitch (propuesta de valor en 2 columnas).
export const WELCOME_LS_KEY = 'episig:welcome-seen-v6'

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
      <div className="max-h-[88vh] w-[700px] max-w-[92vw] overflow-y-auto rounded-[4px] bg-inspi-paper shadow-2xl">
        {/* === Header navy con barra roja superior y EpiSIG mark === */}
        <header className="relative bg-inspi-navy px-5 pb-3.5 pt-4 text-white">
          <span className="absolute left-0 right-0 top-0 h-[2px] bg-inspi-red" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 rounded-[3px] bg-white px-2 py-1">
                <EpiLogo width={88} />
              </div>
              <div>
                <div className="font-display text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/55">
                  INSPI · Centro de Investigación EpiSIG
                </div>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Cerrar bienvenida"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Línea acento rojo 3px bajo el header (eco del Header global). */}
        <div className="h-[3px] w-full bg-inspi-red" />

        {/* === Hero: logo geoENT centrado + saludo === */}
        <div className="border-b border-inspi-line bg-gradient-to-b from-inspi-slate-50 to-inspi-paper px-5 pb-4 pt-5 text-center">
          <div className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-inspi-muted">
            Bienvenido a
          </div>
          <div className="mx-auto mt-3 flex items-center justify-center">
            <GeoEntLogo width={300} showTagline />
          </div>
        </div>

        {/* === Body === */}
        <div className="space-y-3.5 px-6 py-4 text-[13px] leading-[1.6] text-slate-700">
          <p>
            <b className="text-inspi-navy">geoENT</b> es la plataforma de investigación
            espacial en Enfermedades No Transmisibles del{' '}
            <b className="text-inspi-navy">Centro de Investigación EpiSIG · INSPI</b>.
            Une dos preguntas críticas de la salud pública territorial en una sola
            interfaz —{' '}
            <span className="text-inspi-red">¿qué condiciones del territorio</span>{' '}
            están conduciendo la carga de enfermedad, y{' '}
            <span className="text-inspi-red">¿dónde concentrar las acciones</span>{' '}
            de mayor impacto— sobre las{' '}
            <span className="font-mono tnum">1.049</span> parroquias del Ecuador
            continental.
          </p>

          {/* Mini-grid de propuesta de valor: dos columnas con los dos
              enfoques que sustentan al visor (sin nombrar los proyectos
              específicos), centrados en el "para qué" institucional. */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[3px] border border-inspi-line bg-inspi-paper p-3">
              <div className="font-display text-[9.5px] font-bold uppercase tracking-[0.08em] text-inspi-red">
                Comprender
              </div>
              <div className="mt-1 font-display text-[11.5px] font-semibold leading-[1.35] text-inspi-navy">
                Determinantes territoriales de las ENT
              </div>
              <div className="mt-1 font-display text-[10.5px] leading-[1.45] text-inspi-muted">
                Modelado econométrico espacial para detectar qué factores
                (pobreza, ambiente, hábitos, acceso a salud) explican la carga
                local de enfermedad en cada parroquia.
              </div>
            </div>
            <div className="rounded-[3px] border border-inspi-line bg-inspi-paper p-3">
              <div className="font-display text-[9.5px] font-bold uppercase tracking-[0.08em] text-inspi-red">
                Priorizar
              </div>
              <div className="mt-1 font-display text-[11.5px] font-semibold leading-[1.35] text-inspi-navy">
                Decisiones de inversión en salud pública
              </div>
              <div className="mt-1 font-display text-[10.5px] leading-[1.45] text-inspi-muted">
                Análisis multicriterio que combina mortalidad, carga de
                enfermedad, costos y equidad para señalar dónde y en qué
                ENT actuar primero.
              </div>
            </div>
          </div>

          <p className="text-[12px] text-inspi-muted">
            Una sola plataforma para pasar de la <b className="text-inspi-navy">evidencia
            espacial</b> a la <b className="text-inspi-navy">decisión territorial</b>{' '}
            en salud pública.
          </p>

          {/* Callout: datos simulados — borde navy (estandarizado). */}
          <div className="rounded-[3px] border border-inspi-navy/25 bg-inspi-navy/[0.04] px-3.5 py-2.5 text-[12px] text-inspi-navy">
            Algunos módulos consumen{' '}
            <b>datos simulados estructurados</b> (ENSANUT-ECU, STEPS-OMS, GBD 2021)
            marcados con la etiqueta{' '}
            <span className="inline-flex items-center rounded-[3px] border border-inspi-line bg-inspi-paper px-1.5 py-px font-display text-[10px] font-bold uppercase tracking-[0.07em] text-inspi-navy">
              Simulación
            </span>{' '}
            mientras avanzan los proyectos de investigación asociados.
          </div>

          {/* Tip card con borde rojo izquierdo. */}
          <div className="rounded-[3px] border border-inspi-line bg-inspi-bone/40">
            <div className="border-l-[3px] border-inspi-red px-3.5 py-2.5">
              <div className="mb-1.5 flex items-center gap-1.5 font-display text-[10.5px] font-bold uppercase tracking-[0.08em] text-inspi-red">
                ▸ Tip rápido — Animación temporal
              </div>
              <ol className="list-decimal space-y-0.5 pl-5 text-[12.5px] text-slate-700 marker:font-semibold marker:text-inspi-navy">
                <li>Active el módulo <b>Carga de enfermedad</b>.</li>
                <li>Seleccione la visualización <b>Hot Spots</b>.</li>
                <li>Pulse <b>▶ Reproducir</b> para recorrer la serie 2013–2024.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* === Footer con CTA grande rojo === */}
        <footer className="flex items-center justify-between gap-2 border-t border-inspi-line bg-inspi-bone px-5 py-3">
          <span className="font-display text-[10px] font-medium uppercase tracking-[0.08em] text-inspi-muted">
            v0.1.0 · Prototipo institucional
          </span>
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
