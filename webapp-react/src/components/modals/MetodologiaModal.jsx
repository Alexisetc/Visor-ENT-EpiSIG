// MetodologiaModal — Documenta qué es real y qué es simulación estructurada
// en cada capa del visor. Manual de Diseño v2: header navy + barra roja,
// secciones con pill REAL/SIMULADO de alto contraste.

import { useEffect } from 'react'
import { X, FlaskConical, Database, BookOpen } from 'lucide-react'
import { useStore } from '../../store'
import Cite from '../ficha/Cite'

const REF_1_URL   = 'https://www.inspilip.gob.ec/index.php/inspi/article/view/853'
const REF_1_TITLE = 'Evolución de la mortalidad por enfermedades no transmisibles en Ecuador (2017-2023)'

// Pill REAL / SIMULADO con tratamiento contrastado.
function StatusPill({ status }) {
  const isReal = status === 'real'
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-display text-[9.5px] font-bold uppercase tracking-[0.08em] ${
        isReal
          ? 'bg-inspi-green/12 text-inspi-green ring-1 ring-inspi-green/25'
          : 'bg-inspi-amber/15 text-inspi-amber ring-1 ring-inspi-amber/30'
      }`}
    >
      <span className={`block h-1.5 w-1.5 rounded-full ${isReal ? 'bg-inspi-green' : 'bg-inspi-amber'}`} />
      {isReal ? 'Datos reales' : 'Simulado'}
    </span>
  )
}

// Sección de capa con encabezado destacado + pill de estado.
function Section({ title, status, children }) {
  return (
    <div className="rounded-[4px] border border-inspi-line bg-inspi-paper">
      <div className="flex items-center justify-between gap-2 border-b border-inspi-line bg-inspi-slate-50 px-3.5 py-2">
        <h3 className="font-display text-[12.5px] font-bold text-inspi-navy">
          {title}
        </h3>
        <StatusPill status={status} />
      </div>
      <div className="px-3.5 py-2.5 text-[11.5px] leading-[1.55] text-slate-700">
        {children}
      </div>
    </div>
  )
}

export default function MetodologiaModal() {
  const modalOpen  = useStore(s => s.modalOpen)
  const closeModal = useStore(s => s.closeModal)

  useEffect(() => {
    if (modalOpen !== 'metodologia') return
    const onKey = e => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen, closeModal])

  if (modalOpen !== 'metodologia') return null

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) closeModal() }}
    >
      <div className="max-h-[88vh] w-[700px] max-w-[92vw] overflow-y-auto rounded-[4px] bg-inspi-paper shadow-2xl">
        {/* === Header navy con barra roja superior === */}
        <header className="relative bg-inspi-navy px-5 py-3.5 text-white">
          <span className="absolute left-0 right-0 top-0 h-[2px] bg-inspi-red" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-white/10">
                <FlaskConical size={16} className="text-inspi-red" />
              </div>
              <div className="leading-tight">
                <div className="font-display text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/55">
                  Documentación técnica
                </div>
                <h2 className="mt-0.5 font-display text-[15px] font-bold text-white">
                  Metodología — Qué es real, qué es simulación estructurada
                </h2>
              </div>
            </div>
            <button
              onClick={closeModal}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="h-[3px] w-full bg-inspi-red" />

        {/* === Body === */}
        <div className="space-y-3 px-5 py-4 text-[12.5px] leading-relaxed text-slate-700">
          {/* Resumen ejecutivo */}
          <p className="border-l-[3px] border-inspi-red bg-inspi-bone/40 px-3 py-2 text-[12px]">
            Las tres capas analíticas de geoENT combinan{' '}
            <b className="text-inspi-navy">datos reales</b> de fuentes oficiales y{' '}
            <b className="text-inspi-navy">simulaciones estructuradas defendibles</b>.
            Esta nota documenta el origen y el método de cada una para uso institucional.
          </p>

          {/* Cuatro capas */}
          <Section title="Egresos hospitalarios y defunciones · 2013–2024" status="real">
            Microdato crudo <b>INEC</b> (EGH + EDG) procesado por el pipeline Python{' '}
            <code className="rounded bg-inspi-slate-50 px-1 py-px font-mono text-[10.5px] text-inspi-navy">scripts/ent_pipeline/</code>{' '}
            (Fases 0-5). Clasificación CIE-10 según los 5 grupos del estudio
            <Cite n={1} href={REF_1_URL} title={REF_1_TITLE} />{' '}
            (circulatorio I00-I99, neoplasias C00-D48, metabólicas E00-E90,
            respiratorio J00-J99, nervioso G00-G99). Tendencias con{' '}
            <b>Mann-Kendall</b> (τ) + <b>pendiente de Sen</b> + <b>FDR Benjamini-Hochberg</b>.
          </Section>

          <Section title="Determinantes parroquiales · MGWR" status="simulado">
            Valor provincial base (<b>ENSANUT-ECU 2018</b>, <b>STEPS-OMS</b>, <b>GBD 2021</b>,
            <b> CPV 2022</b>) × factor urbano/rural × ruido gaussiano σ=8%.
            Acceso a salud: distancia euclidiana al centroide de la cabecera cantonal
            (EPSG:32717).
          </Section>

          <Section title="Priorización MCDA" status="simulado">
            Suma ponderada (<b>Marsh/ISPOR 2016</b>, <b>Baltussen 2006</b>) con 6 criterios:
            mortalidad (0.30), egresos (0.20), AVAD-GBD (0.15), tendencia CAGR (0.15),
            costo-sistema (0.10), brecha urbano-rural (0.10). Parroquias con &lt;10 casos
            heredan el ranking cantonal.
          </Section>

          <Section title="MGWR local — coeficientes β espaciales" status="simulado">
            Regresión geográficamente ponderada multiescala (<b>Oshan 2020</b>): β nacional ×
            kernel gaussiano anclado en focos reales (Quito/Guayaquil para PM2.5; Amazonía
            para pobreza; Costa urbana para obesidad).
          </Section>

          {/* Reemplazo planeado destacado */}
          <div className="rounded-[4px] border border-inspi-navy/30 bg-inspi-navy/[0.04] p-3.5">
            <div className="mb-1.5 flex items-center gap-1.5 font-display text-[10px] font-bold uppercase tracking-[0.08em] text-inspi-navy">
              <Database size={11} strokeWidth={2.4} />
              Reemplazo planeado
            </div>
            <p className="text-[11.5px] leading-[1.55] text-slate-700">
              Cuando estén disponibles, los datos simulados serán reemplazados por
              resultados reales del{' '}
              <b className="text-inspi-navy">Proyecto Econométrico Espacial INSPI F-I+D+i-075</b>{' '}
              (Duque-ESPE 2026-2027) y del{' '}
              <b className="text-inspi-navy">Proyecto de Priorización MCDA</b>{' '}
              (Núñez-UTE 2026-2028). El esquema de datos se mantiene drop-in.
            </p>
          </div>

          {/* Referencias */}
          <div className="rounded-[4px] border border-inspi-line bg-inspi-paper">
            <div className="flex items-center gap-1.5 border-b border-inspi-line bg-inspi-slate-50 px-3.5 py-2 font-display text-[10px] font-bold uppercase tracking-[0.08em] text-inspi-navy">
              <BookOpen size={11} strokeWidth={2.4} />
              Referencias
            </div>
            <ol className="list-decimal space-y-1.5 px-3.5 py-2.5 pl-9 text-[11.5px] marker:font-bold marker:text-inspi-red">
              <li id="ref-1">
                {REF_1_TITLE}. <i>Revista INSPILIP</i>.{' '}
                <a
                  href={REF_1_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-inspi-navy underline-offset-2 hover:text-inspi-red hover:underline"
                >
                  inspilip.gob.ec/index.php/inspi/article/view/853
                </a>
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-2 border-t border-inspi-line bg-inspi-bone px-5 py-2.5">
          <span className="font-display text-[10px] font-medium uppercase tracking-[0.08em] text-inspi-muted">
            Documento técnico · revisión {new Date().toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={closeModal}
            className="rounded-[3px] bg-inspi-navy px-4 py-1.5 font-display text-[12px] font-semibold text-white hover:brightness-125"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  )
}
