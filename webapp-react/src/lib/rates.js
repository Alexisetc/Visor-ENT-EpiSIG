// Cálculo de tasas por parroquia — portado desde Visualizador ENT.html (L.595-660)
// Devuelve {rate, mortRate, casos, muertes, pob, _real} usando ENT_DATA + POB_DATA
// (egresos + defunciones INEC 2013-2024) o fallback simulado si los JSONs no han cargado.
//   · rate     = tasa de prevalencia (egresos/100k)
//   · mortRate = tasa de mortalidad (muertes/100k)
//
// Denominador poblacional (Fase 6):
//   · Formato NUEVO: pobData.poblacion_anual[dpa6] = [p_2013, ..., p_2024]
//     derivado de interpolación log-share CPV 2010 → CPV 2022 × proyecciones
//     cantonales INEC Rev. 2024. Se indexa con pobData.anios.indexOf(year).
//   · Formato LEGACY (retrocompat): pobData.poblacion[dpa6] = N (snapshot 2022).
//     Usado como fallback si poblacion_anual no está presente, o si el año
//     solicitado está fuera del rango de la serie.

import { ENT_MAP, ENTS } from './colors'
import { pseudoRandom } from './parroquia'

// Devuelve la población parroquial para un (dpa6, año), priorizando la serie
// anual log-share interpolada; cae al snapshot 2022 como fallback.
export function getPob(pobData, geoKey, year) {
  if (!pobData || !geoKey) return 0
  const anual = pobData.poblacion_anual?.[geoKey]
  const anios = pobData.anios
  if (Array.isArray(anual) && Array.isArray(anios)) {
    const yi = anios.indexOf(year)
    if (yi >= 0 && yi < anual.length) {
      const v = Number(anual[yi])
      if (Number.isFinite(v) && v > 0) return v
    }
  }
  // Fallback: snapshot 2022 (formato legacy)
  return Number(pobData.poblacion?.[geoKey]) || 0
}

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
      const pob = getPob(pobData, geoKey, year)
      const rate     = pob > 0 ? (casos   / pob * 100000) : 0
      const mortRate = pob > 0 ? (muertes / pob * 100000) : 0
      return {
        rate:     Number(rate.toFixed(1)),
        mortRate: Number(mortRate.toFixed(1)),
        casos, muertes, pob,
        _real: true,
      }
    }
    const pob = getPob(pobData, geoKey, year)
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
