// trend.js — utilidades para calcular variación interanual (YoY) y series
// temporales completas del visor Carga de Enfermedad.
//
//   deltaYoY(current, previous) → { pct, arrow, dir }
//   buildYearSeries(geoKey, disease, entData, pobData) → [{year, rate, mortRate}...]
//   buildAggregateSeries(features, disease, entData, pobData, provFilter)
//     → [{year, rate, mortRate}...]  usado para agregado nacional o provincial

import { ENT_MAP, ENTS } from './colors'
import { getParroquiaKey, getParroquiaProvKey } from './parroquia'

/**
 * Variación porcentual respecto al año anterior.
 * @returns null si prev==0/undefined; { pct, arrow, dir } en caso contrario
 *          arrow: '↑' | '↓' | '='   dir: 'up' | 'down' | 'flat'
 */
export function deltaYoY(current, previous) {
  if (previous === null || previous === undefined || previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  const rounded = Number(pct.toFixed(1))
  if (Math.abs(rounded) < 0.1) return { pct: 0, arrow: '=', dir: 'flat' }
  return {
    pct: rounded,
    arrow: rounded > 0 ? '↑' : '↓',
    dir:   rounded > 0 ? 'up' : 'down',
  }
}

/**
 * Serie completa 2013→2023 para UNA parroquia.
 * Devuelve [{year, rate, mortRate, casos, muertes, pob}]
 */
export function buildYearSeries(geoKey, disease, entData, pobData) {
  if (!entData || !ENT_MAP[disease]) return []
  const anios = entData.anios || []
  const parr = entData.parroquias?.[geoKey]
  const pob = pobData?.poblacion?.[geoKey] || 0
  const m = ENT_MAP[disease]
  const out = []
  for (let yi = 0; yi < anios.length; yi++) {
    let casos = 0, muertes = 0
    if (parr) {
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
        const b = parr.data?.[m.type]?.[m.key]
        casos   = b ? (b.casos[yi]   || 0) : 0
        muertes = b ? (b.muertes[yi] || 0) : 0
      }
    }
    const rate     = pob > 0 ? (casos   / pob * 100000) : 0
    const mortRate = pob > 0 ? (muertes / pob * 100000) : 0
    out.push({
      year: anios[yi],
      rate: Number(rate.toFixed(1)),
      mortRate: Number(mortRate.toFixed(1)),
      casos, muertes, pob,
    })
  }
  return out
}

/**
 * Serie completa 2013→2023 agregada (nacional o provincial).
 * Suma casos y pob de todas las parroquias del provFilter (null = nacional).
 */
export function buildAggregateSeries(features, disease, entData, pobData, provFilter) {
  if (!entData || !features || !ENT_MAP[disease]) return []
  const anios = entData.anios || []
  const m = ENT_MAP[disease]
  const years = anios.map(y => ({ year: y, casos: 0, muertes: 0, pob: 0 }))

  for (const f of features) {
    const p = f.properties || {}
    const provKey = getParroquiaProvKey(p)
    if (provFilter && provKey !== provFilter) continue
    const key = getParroquiaKey(p)
    const parr = entData.parroquias?.[key]
    const pob = pobData?.poblacion?.[key] || 0
    for (let yi = 0; yi < anios.length; yi++) {
      let casos = 0, muertes = 0
      if (parr) {
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
          const b = parr.data?.[m.type]?.[m.key]
          casos   = b ? (b.casos[yi]   || 0) : 0
          muertes = b ? (b.muertes[yi] || 0) : 0
        }
      }
      years[yi].casos   += casos
      years[yi].muertes += muertes
      years[yi].pob     += pob
    }
  }

  return years.map(y => ({
    year: y.year,
    rate:     y.pob > 0 ? Number((y.casos   / y.pob * 100000).toFixed(1)) : 0,
    mortRate: y.pob > 0 ? Number((y.muertes / y.pob * 100000).toFixed(1)) : 0,
    casos: y.casos,
    muertes: y.muertes,
    pob: y.pob,
  }))
}
