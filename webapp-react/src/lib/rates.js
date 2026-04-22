// Cálculo de tasas por parroquia — portado desde Visualizador ENT.html (L.595-660)
// Devuelve {rate, mortRate, casos, muertes, pob, _real} usando ENT_DATA + POB_DATA
// (egresos reales 2013-2023) o fallback simulado si los JSONs no han cargado.
//   · rate     = tasa de prevalencia (egresos/100k)
//   · mortRate = tasa de mortalidad (muertes/100k)

import { ENT_MAP, ENTS } from './colors'
import { pseudoRandom } from './parroquia'

export function generateData(geoKey, disease, year, entData, pobData) {
  // ====== MODO DATOS REALES ======
  if (entData && ENT_MAP[disease]) {
    const parr = entData.parroquias[geoKey]
    const yi = entData.anios.indexOf(year)
    if (parr && yi >= 0) {
      const m = ENT_MAP[disease]
      let casos = 0, muertes = 0
      if (m.type === '__sum_grupos__') {
        const grupos = entData.grupos || ENTS
        for (const g of grupos) {
          const b = parr.data?.grupos?.[g]
          if (b) {
            casos   += b.casos[yi]   || 0
            muertes += b.muertes[yi] || 0
          }
        }
      } else {
        const bucket = parr.data?.[m.type]?.[m.key]
        casos   = bucket ? (bucket.casos[yi]   || 0) : 0
        muertes = bucket ? (bucket.muertes[yi] || 0) : 0
      }
      const pob = (pobData?.poblacion?.[geoKey]) || 0
      const rate     = pob > 0 ? (casos   / pob * 100000) : 0
      const mortRate = pob > 0 ? (muertes / pob * 100000) : 0
      return {
        rate:     Number(rate.toFixed(1)),
        mortRate: Number(mortRate.toFixed(1)),
        casos, muertes, pob,
        _real: true,
      }
    }
    const pob = (pobData?.poblacion?.[geoKey]) || 0
    return { rate: 0, mortRate: 0, casos: 0, muertes: 0, pob, _real: true }
  }

  // ====== MODO SIMULACIÓN (fallback) ======
  let seed = year * 131
  for (let i = 0; i < geoKey.length; i++) seed += geoKey.charCodeAt(i) * (i + 3)
  const bases = {
    todas: 750, circulatorio: 220, neoplasia: 110, metabolica: 150,
    respiratorio: 80, nervioso: 60,
    // Compatibilidad con IDs antiguos
    cardio: 220, diabetes: 150, cancer: 110, resp: 80,
  }
  let base = bases[disease] ?? 100
  const g = String(geoKey)
  if (g.includes('Tarqui') || g.includes('Ximena')) base *= 1.4
  if (g.includes('Iñaquito') || g.includes('Calderon') || g.includes('IÑAQUITO')) base *= 1.3
  const yearFactor = 1 + ((year - 2017) * 0.02)
  const noise = pseudoRandom(seed) * 0.4 + 0.8
  const rate = base * yearFactor * noise
  // Mortalidad simulada ≈ 30-45% de la prevalencia (Morales 2017-2023)
  const mortFactor = 0.30 + pseudoRandom(seed + 7) * 0.15
  return {
    rate:     Number(rate.toFixed(1)),
    mortRate: Number((rate * mortFactor).toFixed(1)),
    casos: 0, muertes: 0, pob: 0, _real: false,
  }
}
