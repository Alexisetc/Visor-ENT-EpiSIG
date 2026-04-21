// Cálculo dinámico de quintiles por (disease, year) — portado desde
// Visualizador ENT.html L.831-872. Cachea resultados para evitar recomputo
// en cada render del mapa (hay 1053 features × 5 ENT × 11 años potenciales).

import { LIMITS_SIM, colorScales } from './colors'
import { getParroquiaKey } from './parroquia'
import { generateData } from './rates'

const LIMITS_CACHE = new Map()

export function clearQuintilesCache() {
  LIMITS_CACHE.clear()
}

export function computeQuintiles(disease, year, geojsonData, entData, pobData) {
  const cacheKey = `${disease}|${year}`
  if (LIMITS_CACHE.has(cacheKey)) return LIMITS_CACHE.get(cacheKey)
  if (!entData || !geojsonData) return LIMITS_SIM[disease] || LIMITS_SIM.todas

  const vals = []
  for (const f of geojsonData.features) {
    const key = getParroquiaKey(f.properties)
    const d = generateData(key, disease, year, entData, pobData)
    if (d.rate > 0) vals.push(d.rate)
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
export function colorForRate(rate, disease, year, geojsonData, entData, pobData) {
  const limits = computeQuintiles(disease, year, geojsonData, entData, pobData)
  return getColor(rate, disease, limits)
}
