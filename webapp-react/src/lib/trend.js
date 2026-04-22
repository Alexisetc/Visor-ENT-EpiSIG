// trend.js — utilidades para el análisis temporal del visor.
//
//   deltaYoY(current, previous) → { pct, arrow, dir }              · YoY pill
//   buildYearSeries(...)                                            · para gráfica
//   buildAggregateSeries(...)                                       · agregado
//   lookupTrend(entData, level, unitId, ent, metric, variant)       · NUEVO — Fase 5
//                                                                     lectura de
//                                                                     tendencia
//                                                                     MK+Sen+FDR
//                                                                     pre-computada
//   computeTrend(series, metric)                                    · DEPRECATED —
//                                                                     fallback OLS
//                                                                     solo para
//                                                                     ENT='todas'
//                                                                     (suma)
//
// Fase 5 (pipeline Python) pre-computa Mann-Kendall (τ) + Sen slope + FDR
// Benjamini-Hochberg y embebe la tendencia en `ent_parroquial.json` bajo
//
//   parroquias[dpa6].data.grupos[g].tendencia
//   parroquias[dpa6].data.subent[s].tendencia
//   tendencias_agg.nacional.grupos[g]
//   tendencias_agg.provincia[dpa2].grupos[g]
//
// lookupTrend() lee directamente del JSON (O(1), cero cálculos en cliente) y
// devuelve una forma compatible con el KPIBlock y TrendRow existentes.

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
 * Serie completa 2013→N para UNA parroquia.
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
 * Serie completa 2013→N agregada (nacional o provincial).
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
// lookupTrend — Fase 5
// Lee la tendencia Mann-Kendall + Sen + FDR pre-computada del JSON.
//
// Argumentos:
//   entData  objeto `ent_parroquial.json` cargado
//   level    'parroquia' | 'provincia' | 'nacional'
//   unitId   clave DPA — DPA6 para parroquia, DPA2 para provincia, ignorado para nacional
//   ent      'circulatorio' | 'neoplasia' | … | 'dm2' | … | 'todas'
//   metric   'morbilidad' | 'mortalidad'
//   variant  'serie_completa' | 'sin_pandemia'   (default 'serie_completa')
//
// Si ent === 'todas' → no hay tendencia pre-computada (es pseudo-agregado
// en el cliente); devolvemos { valid:false, reason:'todas' } y el llamador
// debe usar computeTrend(series) como fallback.
//
// Para parroquia el JSON guarda forma compacta (sin serie_tasa/poblacion).
// Para provincia/nacional incluye `serie_tasa` + `poblacion` + `p_raw`+`ljung_p`.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Lee la tendencia pre-computada (MK+Sen+FDR) del JSON Fase 5.
 *
 * @param  {object}  entData  JSON cargado
 * @param  {string}  level    'parroquia' | 'provincia' | 'nacional'
 * @param  {?string} unitId   DPA6/DPA2, null para nacional
 * @param  {string}  ent      id ENT ('circulatorio', 'dm2', 'todas', …)
 * @param  {string}  metric   'morbilidad' | 'mortalidad'
 * @param  {string}  variant  'serie_completa' | 'sin_pandemia'
 * @returns {{
 *   valid:bool, reason?:string, clase:string, dir:string, n:number,
 *   tau:number, pValue:?number, pRaw:?number, ljungP:?number,
 *   senSlope:number, annualPct:number, significant:bool,
 *   serieTasa?:number[], poblacion?:number, variant:string
 * }}
 */
export function lookupTrend(entData, level, unitId, ent, metric = 'morbilidad',
                             variant = 'serie_completa') {
  if (!entData || !ENT_MAP[ent]) return { valid: false, reason: 'ent-invalido' }

  // 'todas' no tiene tendencia pre-computada → fallback OLS en el cliente
  if (ent === 'todas' || ENT_MAP[ent].type === '__sum_grupos__') {
    return { valid: false, reason: 'todas' }
  }

  const entType = ENT_MAP[ent].type   // 'grupos' | 'subent'
  const entKey  = ENT_MAP[ent].key

  let block = null
  let fullAgg = false   // nacional/provincia traen `serie_tasa` y `poblacion`

  if (level === 'parroquia') {
    const parr = entData.parroquias?.[unitId]
    block = parr?.data?.[entType]?.[entKey]?.tendencia
  } else if (level === 'provincia') {
    block = entData.tendencias_agg?.provincia?.[unitId]?.[entType]?.[entKey]
    fullAgg = true
  } else if (level === 'nacional') {
    block = entData.tendencias_agg?.nacional?.[entType]?.[entKey]
    fullAgg = true
  } else {
    return { valid: false, reason: 'level-invalido' }
  }

  if (!block) return { valid: false, reason: 'sin-datos' }

  const perMetric = block[metric]
  if (!perMetric) return { valid: false, reason: 'metric-missing' }

  const stat = perMetric[variant]
  if (!stat) return { valid: false, reason: 'variant-missing' }

  const n = Number(stat.n || 0)
  if (n < 6) {
    return {
      valid: false, reason: 'n<6', n,
      clase: stat.clase || 'Estable',
    }
  }

  const clase = stat.clase || 'Estable'
  const dir =
    clase === 'Ascendente'  ? 'up' :
    clase === 'Descendente' ? 'down' :
                              'flat'

  // annualPct: Sen slope relativo a la media de la serie_tasa.
  // Si fullAgg tenemos serie_tasa directo; si parroquia la reconstruimos.
  let serieMean = 0
  let serieTasa = null
  if (fullAgg) {
    serieTasa = perMetric.serie_tasa || []
    const validPts = serieTasa.filter(v => Number.isFinite(v) && v > 0)
    serieMean = validPts.length
      ? validPts.reduce((a, b) => a + b, 0) / validPts.length
      : 0
  }
  const senSlope = Number(stat.sen_slope || 0)
  const annualPct = serieMean > 0 ? (senSlope / serieMean) * 100 : 0

  return {
    valid: true,
    clase, dir, n,
    tau:        Number(stat.tau || 0),
    pValue:     stat.p_adj ?? null,
    pRaw:       stat.p_raw ?? null,
    ljungP:     stat.ljung_p ?? null,
    senSlope:   Number(senSlope.toFixed(3)),
    annualPct:  Number(annualPct.toFixed(2)),
    significant: (stat.p_adj != null) && stat.p_adj < 0.05,
    serieTasa: serieTasa || undefined,
    poblacion: fullAgg ? Number(perMetric.poblacion || 0) : undefined,
    variant,
  }
}

/**
 * Calcula annualPct para parroquia (que no trae serie_tasa precomputada)
 * desde una serie local construida con buildYearSeries.
 *
 * Útil cuando lookupTrend() devolvió un trend válido pero con annualPct=0
 * porque no tenía serie_mean (caso parroquia).
 */
export function enrichAnnualPct(trend, series, metric = 'rate') {
  if (!trend?.valid || trend.annualPct !== 0) return trend
  const vals = (series || []).map(p => p?.[metric]).filter(v => Number.isFinite(v) && v > 0)
  if (vals.length < 3) return trend
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  if (!(mean > 0)) return trend
  const annualPct = Number(((trend.senSlope / mean) * 100).toFixed(2))
  return { ...trend, annualPct }
}

// ════════════════════════════════════════════════════════════════════════════
// computeTrend — DEPRECATED (Fase 5)
//
// Regresión lineal OLS + test t bilateral — metodología original del visor
// Sprint 2.2. Reemplazado por lookupTrend() en Fase 5 para los 5 grupos ENT
// Morales y 12 sub-ENT. Se MANTIENE solo como fallback para:
//
//   · ENT='todas' (suma de los 5 grupos, sin pre-cómputo en el backend)
//   · análisis ad-hoc off-pipeline
//
// NO usar para grupos/subent del JSON Fase 5 — los resultados son diferentes
// porque MK+Sen es más robusto (no asume linealidad ni normalidad) y MK
// aplica FDR-BH que OLS sin corrección no.
// ════════════════════════════════════════════════════════════════════════════

/** @deprecated Lanczos log Γ(x) */
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

/** @deprecated Continued-fraction beta incompleta */
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

/** @deprecated I_x(a,b) */
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

/** @deprecated p-valor bilateral exacto Student's t. Usar lookupTrend(). */
export function tPValue(t, df) {
  if (df <= 0 || !isFinite(t)) return 1
  const x = df / (df + t * t)
  return betainc(df / 2, 0.5, x)
}

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
 * @deprecated Reemplazado por lookupTrend() en Fase 5. Se conserva solo como
 * fallback para ENT='todas' (suma de grupos) y análisis off-pipeline.
 * Los resultados OLS/t **no coinciden** con Mann-Kendall+Sen+FDR del JSON.
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
    senSlope: Number(slope.toFixed(3)),     // alias por compatibilidad con lookupTrend
    intercept: Number(intercept.toFixed(3)),
    annualPct: Number(annualPct.toFixed(2)),
    r2: Number(r2.toFixed(3)),
    tStat: Number(tStat.toFixed(2)),
    tau: null,                               // OLS no tiene τ
    pValue: Number(pValue.toFixed(4)),
    significant, dir, clase,
    ic95: [Number(ic95[0].toFixed(3)), Number(ic95[1].toFixed(3))],
    n,
    variant: 'ols-deprecated',
  }
}
