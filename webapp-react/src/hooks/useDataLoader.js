// useDataLoader — Carga los 8 datasets del visor en paralelo y los inyecta
// al store zustand. Se ejecuta una sola vez al montar <App />.
//
// Datasets servidos desde /assets/* (ver vite.config.js legacyAssetsMiddleware):
//   ent_parroquial.json         Fase 5 del pipeline Python — egresos + defunciones
//                               INEC 2013-2024, 1056 parroquias, + tendencias
//                               MK+Sen+FDR embebidas por parroquia/provincia/nacional
//   pob_parroquial.json         denominadores CPV 2022, 1040 parroquias
//   parroquias_otp_simpl.geojson  1053 polígonos parroquiales (CONALI)
//   provincias_otp.geojson      24 polígonos provinciales (INEC)
//   priorizacion_mcda.json      ranking MCDA por parroquia (simulación)
//   mgwr_betas.json             β locales MGWR por parroquia (simulación)
//   determinantes_parroquial.json  7 determinantes por parroquia (simulación)
//   estudio_ent.json            estudio mortalidad ENT 2017-2023 (nacional)

import { useEffect } from 'react'
import { useStore } from '../store'

// === Estrategia de carga de datasets ===
//
// En DEV usamos `${BASE}assets/*` que va contra la copia local del repo
// (servida por Vite + el legacyAssetsMiddleware).
//
// En PROD el cache CDN de GitHub Pages (cache-bog) está siendo lento
// para esta región (~9 KB/s, 12 min para parroquias_otp_simpl.geojson).
// Cambiamos a jsDelivr (CDN gratuito que mirroreaba automáticamente
// el repo de GitHub) que sirve a ~175 KB/s desde cache-gig (Río de
// Janeiro), 18× más rápido. Cache-Control: max-age=604800 (1 semana)
// vs los 10 min de GitHub Pages. Mismo source of truth: los assets
// de webapp/assets/ del repo en master.
const BASE = import.meta.env.BASE_URL

// CDN jsDelivr para producción. En dev queda `null` y se usa BASE.
const PROD = import.meta.env.PROD
const CDN_BASE = PROD
  ? 'https://cdn.jsdelivr.net/gh/Alexisetc/Visor-ENT-EpiSIG@master/webapp/assets/'
  : `${BASE}assets/`

const DATASETS = [
  { key: 'entData',      file: 'ent_parroquial.json'        },
  { key: 'pobData',      file: 'pob_parroquial.json'        },
  { key: 'geoParr',      file: 'parroquias_otp_simpl.geojson' },
  { key: 'geoProv',      file: 'provincias_otp.geojson'     },
  { key: 'mcdaData',     file: 'priorizacion_mcda.json'     },
  { key: 'mgwrData',     file: 'mgwr_betas.json'            },
  { key: 'detData',      file: 'determinantes_parroquial.json' },
  { key: 'estudioData',  file: 'estudio_ent.json'           },
].map(d => ({ ...d, url: `${CDN_BASE}${d.file}` }))

async function fetchJSON(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`)
  return r.json()
}

export function useDataLoader() {
  const setDataset = useStore(s => s.setDataset)
  const setLoading = useStore(s => s.setLoading)
  const setError   = useStore(s => s.setError)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all(DATASETS.map(d =>
      fetchJSON(d.url)
        .then(json => ({ key: d.key, json }))
        .catch(err => {
          console.warn(`[EpiSIG] ${d.key} no disponible:`, err.message)
          return { key: d.key, json: null }
        })
    )).then(results => {
      if (cancelled) return
      const summary = []
      for (const { key, json } of results) {
        setDataset(key, json)
        if (json) {
          if (key === 'entData')  summary.push(`ent: ${Object.keys(json.parroquias || {}).length} parr × ${(json.anios || []).length} años`)
          if (key === 'pobData')  summary.push(`pob: ${Object.keys(json.poblacion || {}).length} parr`)
          if (key === 'geoParr')  summary.push(`geo: ${(json.features || []).length} polig.`)
          if (key === 'mcdaData') summary.push(`mcda: ${Object.keys(json.parroquias || {}).length} parr`)
          if (key === 'mgwrData') summary.push(`mgwr: ${Object.keys(json.parroquias || {}).length} parr`)
          if (key === 'detData')  summary.push(`det: ${Object.keys(json.parroquias || {}).length} parr`)
          if (key === 'estudioData') summary.push(`estudio: ${Object.keys(json.grupos || {}).length} grupos × ${(json.anios || []).length} años`)
        }
      }
      if (import.meta.env.DEV) {
        console.log('[EpiSIG] Datos cargados →', summary.join(' · '))
      }
      setLoading(false)
    }).catch(err => {
      if (cancelled) return
      console.error('[EpiSIG] Error cargando datos:', err)
      setError(err.message)
      setLoading(false)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
