// trend.js — utilidades para calcular variación interanual (YoY), series
// temporales completas y análisis de tendencia estadística siguiendo la
// metodología Morales (regresión lineal OLS + test t bilateral).
//
//   deltaYoY(current, previous) → { pct, arrow, dir }
//   buildYearSeries(geoKey, disease, entData, pobData) → [{year, rate, mortRate}...]
//   buildAggregateSeries(features, disease, entData, pobData, provFilter)
//     → [{year, rate, mortRate}...]  usado para agregado nacional o provincial
//   computeTrend(series, metric) → {valid, slope, annualPct, pValue, r2, clase, …}

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

// ════════════════════════════════════════════════════════════════════════════
// ANÁLISIS DE TENDENCIA — metodología Morales (OLS + test t)
// Replica sobre la serie parroquial/provincial/nacional 2013-2023 el mismo
// procedimiento que el estudio ENT 2017-2023: regresión lineal simple de
// tasa vs. año, test t bilateral de la pendiente (H0: β1=0) y clasificación:
//   · p < 0.05 & slope > 0  → 'Ascendente'
//   · p < 0.05 & slope < 0  → 'Descendente'
//   · p ≥ 0.05              → 'Estable'
// El p-valor se calcula con la CDF exacta de Student's t vía la función beta
// incompleta regularizada (no aproximación normal — es correcta para df=9).
// ════════════════════════════════════════════════════════════════════════════

/** log Γ(x) · aproximación Lanczos (precisión ~10⁻¹⁴ para x>0) */
function lngamma(x) {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ]
  let y = x
  let t = x + 5.5
  t -= (x + 0.5) * Math.log(t)
  let sum = 1.000000000190015
  for (let j = 0; j < 6; j++) sum += cof[j] / ++y
  return -t + Math.log(2.5066282746310005 * sum / x)
}

/** Continued-fraction de la función beta incompleta (Numerical Recipes §6.4) */
function betacf(a, b, x) {
  const MAX_ITER = 100, EPS = 3e-7, FPMIN = 1e-30
  const qab = a + b, qap = a + 1, qam = a - 1
  let c = 1
  let d = 1 - qab * x / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

/** I_x(a,b) — función beta incompleta regularizada */
function betainc(a, b, x) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(
    lngamma(a + b) - lngamma(a) - lngamma(b) +
    a * Math.log(x) + b * Math.log(1 - x)
  )
  if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a
  return 1 - bt * betacf(b, a, 1 - x) / b
}

/** p-valor bilateral exacto para Student's t con df grados de libertad */
export function tPValue(t, df) {
  if (df <= 0 || !isFinite(t)) return 1
  const x = df / (df + t * t)
  return betainc(df / 2, 0.5, x)
}

/** t-crítico bilateral α=0.05 — tabla compacta con interpolación lineal */
function tCritical95(df) {
  const T = { 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306,
              9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179, 15: 2.131,
              20: 2.086, 30: 2.042, 60: 2.000, 120: 1.980 }
  if (df >= 120) return 1.96
  if (df <= 3)   return T[3]
  const ks = Object.keys(T).map(Number).sort((a, b) => a - b)
  for (let i = 0; i < ks.length - 1; i++) {
    if (df >= ks[i] && df < ks[i + 1]) {
      const w = (df - ks[i]) / (ks[i + 1] - ks[i])
      return T[ks[i]] + (T[ks[i + 1]] - T[ks[i]]) * w
    }
  }
  return T[ks[ks.length - 1]]
}

/**
 * Análisis de tendencia 2013-2023 — metodología Morales.
 *
 * @param series  [{year, rate, mortRate}]  de buildYearSeries / buildAggregateSeries
 * @param metric  'rate' (morbilidad hospitalaria) | 'mortRate' (mortalidad)
 * @returns {
 *   valid:      bool
 *   slope:      β₁ (tasa /100k por año)
 *   annualPct:  variación porcentual anual relativa a la media (decision-maker friendly)
 *   pValue:     p-valor bilateral del test t de β₁ = 0 (exacto, no normal)
 *   r2:         coeficiente de determinación
 *   tStat:      estadístico t
 *   ic95:       [low, high] intervalo de confianza 95% de la pendiente
 *   significant:pValue < 0.05
 *   dir:        'up' | 'down' | 'flat'
 *   clase:      'Ascendente' | 'Descendente' | 'Estable'
 *   n:          nº de puntos con dato válido
 * }
 */
export function computeTrend(series, metric = 'rate') {
  const pts = (series || []).filter(p => p && Number.isFinite(p[metric]) && p[metric] > 0)
  const n = pts.length
  if (n < 3) return { valid: false, reason: 'n<3', n }

  const xs = pts.map(p => p.year)
  const ys = pts.map(p => p[metric])
  const xMean = xs.reduce((a, b) => a + b, 0) / n
  const yMean = ys.reduce((a, b) => a + b, 0) / n

  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMean, dy = ys[i] - yMean
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy
  }
  if (sxx === 0) return { valid: false, reason: 'sxx=0', n }

  const slope = sxy / sxx
  const intercept = yMean - slope * xMean

  let ssRes = 0
  for (let i = 0; i < n; i++) {
    const yhat = intercept + slope * xs[i]
    ssRes += (ys[i] - yhat) ** 2
  }
  const df = n - 2
  const se2 = df > 0 ? ssRes / df : 0
  const seSlope = sxx > 0 ? Math.sqrt(se2 / sxx) : 0
  const tStat = seSlope > 0 ? slope / seSlope : 0
  const r2 = syy > 0 ? 1 - ssRes / syy : 0
  const pValue = seSlope > 0 ? tPValue(tStat, df) : 1

  const annualPct = yMean > 0 ? (slope / yMean) * 100 : 0
  const tCrit = tCritical95(df)
  const ic95 = [slope - tCrit * seSlope, slope + tCrit * seSlope]

  const significant = pValue < 0.05
  let dir, clase
  if (!significant) {
    dir = 'flat'; clase = 'Estable'
  } else if (slope > 0) {
    dir = 'up'; clase = 'Ascendente'
  } else {
    dir = 'down'; clase = 'Descendente'
  }

  return {
    valid: true,
    slope: Number(slope.toFixed(3)),
    intercept: Number(intercept.toFixed(3)),
    annualPct: Number(annualPct.toFixed(2)),
    r2: Number(r2.toFixed(3)),
    tStat: Number(tStat.toFixed(2)),
    pValue: Number(pValue.toFixed(4)),
    significant, dir, clase,
    ic95: [Number(ic95[0].toFixed(3)), Number(ic95[1].toFixed(3))],
    n,
  }
}
