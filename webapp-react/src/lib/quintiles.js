// Cálculo dinámico de quintiles por (disease, year, metric) — portado desde
// Visualizador ENT.html L.831-872. Cachea resultados para evitar recomputo
// en cada render del mapa (hay 1053 features × 5 ENT × 11 años × 2 métricas
// potenciales = ~58 k combinaciones teóricas, típicamente <20 calculadas).
//
// El parámetro `metric` decide si los cortes vienen de `rate` (morbilidad
// hospitalaria) o `mortRate` (mortalidad). Esto mantiene las coropletas
// calibradas a la distribución real de la métrica activa, en vez de
// colorear tasas de mortalidad (~5-50 /100k) contra cortes de morbilidad
// (~100-1000 /100k) que las aplastarían al quintil más bajo.

import { LIMITS_SIM, colorScales } from './colors'
import { getParroquiaKey } from './parroquia'
import { generateData } from './rates'

const LIMITS_CACHE = new Map()

export function clearQuintilesCache() {
  LIMITS_CACHE.clear()
}

export function computeQuintiles(disease, year, geojsonData, entData, pobData, metric = 'morbilidad') {
  const cacheKey = `${disease}|${year}|${metric}`
  if (LIMITS_CACHE.has(cacheKey)) return LIMITS_CACHE.get(cacheKey)
  if (!entData || !geojsonData) return LIMITS_SIM[disease] || LIMITS_SIM.todas

  const field = metric === 'mortalidad' ? 'mortRate' : 'rate'
  const vals = []
  for (const f of geojsonData.features) {
    const key = getParroquiaKey(f.properties)
    const d = generateData(key, disease, year, entData, pobData)
    const v = d[field]
    if (v > 0) vals.push(v)
  }
  if (vals.length < 5) {
    const fallback = LIMITS_SIM[disease] || LIMITS_SIM.todas
    LIMITS_CACHE.set(cacheKey, fallback)
    return fallback
  }
  vals.sort((a, b) => a - b)
  const q = p => vals[Math.floor(vals.length * p)]
  const lim = [q(0.25), q(0.5), q(0.75), q(0.9)]
  LIMITS_CACHE.set(cacheKey, lim)
  return lim
}

export function getColor(rate, disease, limits) {
  const scale = colorScales[disease] || colorScales.todas
  const l = limits || LIMITS_SIM[disease] || LIMITS_SIM.todas
  return rate > l[3] ? scale[4]
       : rate > l[2] ? scale[3]
       : rate > l[1] ? scale[2]
       : rate > l[0] ? scale[1]
       : scale[0]
}

// Helper conveniente: combina computeQuintiles + getColor en una llamada
export function colorForRate(rate, disease, year, geojsonData, entData, pobData, metric = 'morbilidad') {
  const limits = computeQuintiles(disease, year, geojsonData, entData, pobData, metric)
  return getColor(rate, disease, limits)
}
