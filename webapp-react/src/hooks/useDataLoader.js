// useDataLoader — Carga los datasets del visor en dos olas:
//
//   1. CRÍTICOS — al montar <App />: lo que la vista por defecto
//      (Carga de Enfermedad + mapa) necesita para ser usable. Sin
//      estos el visor no tiene sentido. ~3.3 MB gzip.
//
//   2. POR MÓDULO — bajo demanda cuando el usuario activa el módulo
//      correspondiente. Determinantes y Priorización MCDA tienen sus
//      datasets propios que no cargan hasta que el usuario los pide.
//      ~630 KB gzip distribuidos entre los dos módulos.
//
// Beneficio: la primera carga descarga ~16% menos peso (~630 KB) y,
// más importante, evita parsear ~2.2 MB de JSON adicional en el
// thread principal mientras el visor se inicializa.

import { useEffect } from 'react'
import { useStore } from '../store'

const BASE = import.meta.env.BASE_URL
const PROD = import.meta.env.PROD

// CDN jsDelivr en prod (mucho más rápido que GitHub Pages para LATAM),
// fallback al asset local en dev (Vite middleware).
const CDN_BASE = PROD
  ? 'https://cdn.jsdelivr.net/gh/Alexisetc/Visor-ENT-EpiSIG@master/webapp/assets/'
  : `${BASE}assets/`

function url(file) { return `${CDN_BASE}${file}` }

// === Datasets críticos (siempre se cargan al montar la app) ===
// Carga de Enfermedad + capa parroquial + provincias + estudio nacional.
const CRITICAL = [
  { key: 'entData',     url: url('ent_parroquial.json')        },
  { key: 'pobData',     url: url('pob_parroquial.json')        },
  { key: 'geoParr',     url: url('parroquias_otp_simpl.geojson') },
  { key: 'geoProv',     url: url('provincias_otp.geojson')     },
  { key: 'estudioData', url: url('estudio_ent.json')           },
]

// === Datasets diferidos por módulo ===
// Cada entrada se carga la primera vez que el usuario activa el módulo
// correspondiente, y queda cacheada en el store para visitas siguientes
// dentro de la misma sesión.
export const MODULE_DATASETS = {
  determinantes: [
    { key: 'mgwrData', url: url('mgwr_betas.json')            },
    { key: 'detData',  url: url('determinantes_parroquial.json') },
  ],
  mcda: [
    { key: 'mcdaData', url: url('priorizacion_mcda.json')     },
  ],
}

const FETCH_TIMEOUT_MS = 60_000

async function fetchJSON(url, { signal } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), FETCH_TIMEOUT_MS)
  if (signal) signal.addEventListener('abort', () => ctrl.abort(signal.reason))
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`)
    return await r.json()
  } finally {
    clearTimeout(timer)
  }
}

// Hook principal — solo carga los datasets críticos. Los módulos
// diferidos los pide useModuleDataLoader cuando corresponde.
export function useDataLoader() {
  const setDataset = useStore(s => s.setDataset)
  const setLoading = useStore(s => s.setLoading)
  const setError   = useStore(s => s.setError)

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    let okCount = 0

    const promises = CRITICAL.map(d =>
      fetchJSON(d.url, { signal: ctrl.signal })
        .then(json => {
          if (ctrl.signal.aborted) return
          setDataset(d.key, json)
          okCount += 1
        })
        .catch(err => {
          if (ctrl.signal.aborted) return
          console.warn(`[EpiSIG] ${d.key} no disponible:`, err.message)
          setDataset(d.key, null)
        })
    )

    Promise.allSettled(promises).then(() => {
      if (ctrl.signal.aborted) return
      setLoading(false)
      if (okCount === 0) {
        setError('No se pudo cargar ningún dataset crítico (timeout o red).')
      }
    })

    return () => { ctrl.abort() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

// === Hook secundario: useModuleDataLoader(moduleId) ===
//
// Se monta dentro de cada módulo (Determinantes, MCDA) y dispara la
// carga de los datasets que ese módulo necesita SI todavía no están
// en el store. Idempotente: si ya están cargados, no hace nada.

const moduleFetchInFlight = new Set()

export function useModuleDataLoader(moduleId) {
  const setDataset       = useStore(s => s.setDataset)
  const setModuleLoading = useStore(s => s.setModuleLoading)
  const datasets = MODULE_DATASETS[moduleId]

  useEffect(() => {
    if (!datasets) return
    // Lo que no esté ya en el store y no esté en flight ahora mismo.
    const missing = datasets.filter(d => {
      const current = useStore.getState()[d.key]
      return current == null && !moduleFetchInFlight.has(d.key)
    })
    if (missing.length === 0) return

    missing.forEach(d => moduleFetchInFlight.add(d.key))
    setModuleLoading(moduleId, true)

    const ctrl = new AbortController()
    const promises = missing.map(d =>
      fetchJSON(d.url, { signal: ctrl.signal })
        .then(json => {
          if (ctrl.signal.aborted) return
          setDataset(d.key, json)
        })
        .catch(err => {
          if (ctrl.signal.aborted) return
          console.warn(`[EpiSIG·${moduleId}] ${d.key} no disponible:`, err.message)
          setDataset(d.key, null)
        })
        .finally(() => moduleFetchInFlight.delete(d.key))
    )

    Promise.allSettled(promises).then(() => {
      if (ctrl.signal.aborted) return
      setModuleLoading(moduleId, false)
    })

    return () => { ctrl.abort() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId])
}
