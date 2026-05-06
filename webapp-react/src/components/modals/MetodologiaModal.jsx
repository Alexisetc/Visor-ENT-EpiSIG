// MetodologiaModal — Texto de metodología (qué es real, qué es simulación
// estructurada). Replica el modal naranja del legacy. Activado desde Header.

import { useEffect } from 'react'
import { X, FlaskConical } from 'lucide-react'
import { useStore } from '../../store'
import Cite from '../ficha/Cite'

// URL canónica de la referencia [1] — clasificación de ENT y metodología
// de tendencias usadas en este visor.
const REF_1_URL   = 'https://www.inspilip.gob.ec/index.php/inspi/article/view/853'
const REF_1_TITLE = 'Evolución de la mortalidad por enfermedades no transmisibles en Ecuador (2017-2023)'

export default function MetodologiaModal() {
  const modalOpen = useStore(s => s.modalOpen)
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
      <div className="max-h-[85vh] w-[640px] max-w-[92vw] overflow-y-auto rounded-lg bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-amber-50 to-white px-5 py-3">
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-amber-600" />
            <h2 className="font-display text-base font-semibold text-inspi-navy">
              Metodología · qué es real, qué es simulación estructurada
            </h2>
          </div>
          <button onClick={closeModal} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={16} />
          </button>
        </header>

        <div className="space-y-3 px-5 py-4 text-sm leading-relaxed text-slate-700">
          <p>
            Las tres capas analíticas de este visor combinan <b>datos reales</b> y
            <b> simulaciones defendibles</b>. Esta nota documenta cada una para uso institucional.
          </p>

          <div>
            <h3 className="font-display text-sm font-semibold text-inspi-navy">Egresos hospitalarios y defunciones 2013–2024</h3>
            <p className="text-xs">
              <b>Reales.</b> Microdato crudo INEC (EGH + EDG) procesado por el pipeline
              Python <code>scripts/ent_pipeline/</code> (Fases 0-5, reemplaza el
              <code> CONSOLIDADO_egresos.xlsx</code> opaco). Clasificación CIE-10 según los
              5 grupos del estudio<Cite n={1} href={REF_1_URL} title={REF_1_TITLE} />
              {' '}(circulatorio I00-I99, neoplasias C00-D48, metabólicas E00-E90,
              respiratorio J00-J99, nervioso G00-G99). Tendencias con Mann-Kendall (τ) +
              pendiente de Sen + FDR Benjamini-Hochberg.
            </p>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold text-inspi-navy">Determinantes parroquiales</h3>
            <p className="text-xs">
              <b>Simulados.</b> Valor provincial base (ENSANUT-ECU 2018, STEPS-OMS, GBD 2021,
              CPV 2022) × factor urbano/rural × ruido gaussiano σ=8%. Acceso a salud:
              distancia euclidiana al centroide de la cabecera cantonal (EPSG:32717).
            </p>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold text-inspi-navy">Priorización MCDA</h3>
            <p className="text-xs">
              <b>Simulada.</b> Suma ponderada (Marsh/ISPOR 2016, Baltussen 2006) con 6 criterios:
              mortalidad (0.30), egresos (0.20), AVAD-GBD (0.15), tendencia CAGR (0.15),
              costo-sistema (0.10), brecha urbano-rural (0.10). Parroquias con &lt;10 casos
              heredan el ranking cantonal.
            </p>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold text-inspi-navy">MGWR local</h3>
            <p className="text-xs">
              <b>Simulada.</b> Regresión geográficamente ponderada multiescala (Oshan 2020):
              β nacional × kernel gaussiano anclado en focos reales (Quito/Guayaquil para PM2.5;
              Amazonía para pobreza; Costa urbana para obesidad).
            </p>
          </div>

          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs">
            <b>Reemplazo planeado:</b> resultados reales del Proyecto Econométrico Espacial
            INSPI F-I+D+i-075 (Duque-ESPE 2026-2027) y del Proyecto de Priorización MCDA
            (Núñez-UTE 2026-2028) cuando estén disponibles.
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold text-inspi-navy">Referencias</h3>
            <ol className="list-decimal space-y-1 pl-5 text-xs">
              <li id="ref-1">
                {REF_1_TITLE}. Revista INSPILIP.{' '}
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
      </div>
    </div>
  )
}
