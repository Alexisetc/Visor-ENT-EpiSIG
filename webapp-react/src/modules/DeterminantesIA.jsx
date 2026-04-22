// DeterminantesIA — Módulo "determinantes sociales + MGWR local".
//
// Ficha derecha (tomadores de decisiones · explica QUÉ conduce la ENT aquí):
//   · Encabezado con unidad (parroquia/provincia/nacional) + ENT activo
//   · R² local MGWR — qué tanto explican los 6 determinantes la ENT en esta unidad
//   · Ranking de β MGWR — los 6 determinantes ordenados por peso para la ENT activa
//   · Valores brutos de los 7 determinantes parroquiales (pobreza, NBI, PM2.5,
//     tabaquismo, obesidad, sedentarismo, acceso a salud km)
//
// Datos:
//   · mgwrData.parroquias[DPA6]  → {r2_local, betas[ent][det]}
//   · detData.parroquias[DPA6]   → {pobreza, nbi, pm25, tabaquismo, obesidad,
//                                   sedentarismo, acceso_salud_km}
//
// Agregación: para provincia/nacional se calcula la media simple de las
// parroquias del filtro (para MGWR) y la media ponderada por población
// cuando está disponible (para los raw determinantes). Es una simulación
// estructurada (ver MetodologiaModal) — cuando el Proyecto Econométrico
// Espacial INSPI F-I+D+i-075 arroje resultados reales, este módulo los
// consume drop-in (mismo schema).

import { useMemo } from 'react'
import { Crosshair, X, BrainCircuit, Gauge, FlaskConical } from 'lucide-react'
import { useStore } from '../store'
import { ENT_LABEL, ENTS, DETS, DET_LABEL } from '../lib/colors'
import { getParroquiaKey, getParroquiaLabel, getParroquiaProvKey } from '../lib/parroquia'

// Rangos tipicos observados en los datasets (para normalizar bars 0..100 %)
// Revisados contra percentil 95 de detData: pobreza 40, NBI 90, PM2.5 45,
// tabaquismo 30, obesidad 40, sedentarismo 70, acceso 12 km.
const DET_META = {
  pobreza:         { max: 50,  unit: '%',    color: '#a50f15', label: 'Pobreza'       },
  nbi:             { max: 100, unit: '%',    color: '#de2d26', label: 'NBI'           },
  pm25:            { max: 50,  unit: 'µg/m³', color: '#7f8c8d', label: 'PM2.5'         },
  tabaquismo:      { max: 35,  unit: '%',    color: '#8c564b', label: 'Tabaquismo'    },
  obesidad:        { max: 45,  unit: '%',    color: '#ea1d2c', label: 'Obesidad'      },
  sedentarismo:    { max: 75,  unit: '%',    color: '#fbc400', label: 'Sedentarismo'  },
  acceso_salud_km: { max: 15,  unit: 'km',   color: '#3b82f6', label: 'Acceso salud'  },
}
const DET_ORDER = ['pobreza', 'nbi', 'pm25', 'tabaquismo', 'obesidad', 'sedentarismo', 'acceso_salud_km']

export default function DeterminantesIA() {
  const ent           = useStore(s => s.ent)
  const provFilter    = useStore(s => s.provFilter)
  const selectedDpa   = useStore(s => s.selectedDpa)
  const selectedProps = useStore(s => s.selectedProps)
  const clearSelected = useStore(s => s.clearSelected)
  const geoParr       = useStore(s => s.geoParr)
  const mgwrData      = useStore(s => s.mgwrData)
  const detData       = useStore(s => s.detData)

  // ENT efectiva para mostrar βs — si está "todas", tomamos la primera
  // circulatoria como default visual (siempre hay que mostrar algo).
  const effectiveEnt = ent === 'todas' ? 'circulatorio' : ent

  // Agregado: (a) parroquia seleccionada, (b) media provincia, (c) media nacional
  const aggregated = useMemo(() => {
    if (!mgwrData || !detData) return null

    // (a) parroquia específica
    if (selectedDpa && selectedProps) {
      const key = getParroquiaKey(selectedProps)
      const mgwr = mgwrData.parroquias?.[key] || null
      const det  = detData.parroquias?.[key]  || null
      return { mgwr, det, n: mgwr || det ? 1 : 0, level: 'parroquia' }
    }

    // (b)+(c): media de parroquias que pertenecen al filtro
    if (!geoParr) return null
    const keys = geoParr.features
      .filter(f => {
        if (!provFilter) return true
        return getParroquiaProvKey(f.properties || {}) === provFilter
      })
      .map(f => getParroquiaKey(f.properties || {}))

    // Media simple de R² y βs MGWR
    let r2Sum = 0, r2N = 0
    const betasAgg = {}
    for (const e of ENTS) {
      betasAgg[e] = {}
      for (const d of DETS) betasAgg[e][d] = { sum: 0, n: 0 }
    }
    for (const k of keys) {
      const m = mgwrData.parroquias?.[k]
      if (!m) continue
      if (Number.isFinite(m.r2_local)) { r2Sum += m.r2_local; r2N++ }
      for (const e of ENTS) {
        const row = m.betas?.[e]
        if (!row) continue
        for (const d of DETS) {
          const v = row[d]
          if (Number.isFinite(v)) { betasAgg[e][d].sum += v; betasAgg[e][d].n++ }
        }
      }
    }
    const betas = {}
    for (const e of ENTS) {
      betas[e] = {}
      for (const d of DETS) {
        const a = betasAgg[e][d]
        betas[e][d] = a.n > 0 ? a.sum / a.n : 0
      }
    }
    const r2_local = r2N > 0 ? r2Sum / r2N : 0
    const mgwr = r2N > 0 ? { r2_local, betas } : null

    // Media simple de determinantes crudos (simulación)
    const detAgg = {}
    for (const d of DET_ORDER) detAgg[d] = { sum: 0, n: 0 }
    for (const k of keys) {
      const row = detData.parroquias?.[k]
      if (!row) continue
      for (const d of DET_ORDER) {
        const v = row[d]
        if (Number.isFinite(v)) { detAgg[d].sum += v; detAgg[d].n++ }
      }
    }
    const det = {}
    let detN = 0
    for (const d of DET_ORDER) {
      const a = detAgg[d]
      det[d] = a.n > 0 ? a.sum / a.n : 0
      if (a.n > 0) detN = Math.max(detN, a.n)
    }

    return {
      mgwr,
      det: detN > 0 ? det : null,
      n: Math.max(r2N, detN),
      level: provFilter ? 'provincia' : 'nacional',
    }
  }, [mgwrData, detData, selectedDpa, selectedProps, provFilter, geoParr])

  const unitLabel = useMemo(() => {
    if (selectedDpa && selectedProps) {
      return {
        title: getParroquiaLabel(selectedProps),
        sub:   provFilter ? `Provincia ${provFilter}` : 'Detalle parroquial',
      }
    }
    if (provFilter) {
      const nParr = aggregated?.n || 0
      return { title: `Provincia ${provFilter} (agregado)`, sub: `${nParr} parroquias` }
    }
    return {
      title: 'Nacional · Ecuador continental',
      sub:   `${aggregated?.n || 0} parroquias`,
    }
  }, [selectedDpa, selectedProps, provFilter, aggregated])

  const hasMgwr = Boolean(aggregated?.mgwr)
  const hasDet  = Boolean(aggregated?.det)
  const betas   = hasMgwr ? aggregated.mgwr.betas[effectiveEnt] : null
  const r2raw   = hasMgwr ? aggregated.mgwr.r2_local : null
  const r2      = Number.isFinite(r2raw) ? r2raw : null

  // Orden descendente por β para la ENT activa (top determinante arriba).
  // useMemo SIEMPRE debe llamarse antes de cualquier return condicional.
  const betaRanking = useMemo(() => {
    if (!betas) return []
    return DETS
      .map(d => ({ id: d, beta: Number(betas[d] || 0) }))
      .sort((a, b) => b.beta - a.beta)
  }, [betas])

  if (!mgwrData || !detData) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-xs text-slate-400">
        Cargando datasets MGWR y determinantes…
      </div>
    )
  }

  // Parroquia sin datos MGWR ni determinantes (caso raro: DPA fuera de los
  // 1048-1049 de la simulación). Mostramos mensaje claro en lugar de una
  // ficha vacía con solo header + footer.
  const hasAnyData = hasMgwr || hasDet

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Header */}
      <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-violet-700 to-inspi-navy p-3 text-white">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-inspi-yellow">
              <BrainCircuit size={11} /> Determinantes · MGWR
            </div>
            <div className="truncate font-display text-base font-semibold">
              {unitLabel.title}
            </div>
            {unitLabel.sub && (
              <div className="text-[11px] text-slate-300">{unitLabel.sub}</div>
            )}
            <div className="mt-1 inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white">
              ENT: {ENT_LABEL[effectiveEnt]}
              {ent === 'todas' && <span className="ml-1 opacity-70">(default)</span>}
            </div>
          </div>
          {selectedDpa && (
            <button
              onClick={clearSelected}
              className="flex-shrink-0 rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white"
              title="Volver al agregado"
              aria-label="Deseleccionar parroquia y volver al agregado"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {!selectedDpa && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-300">
            <Crosshair size={10} /> Click en una parroquia del mapa para ver detalle
          </div>
        )}
      </div>

      {/* Mensaje de "sin datos" si la parroquia no está en ningún dataset */}
      {!hasAnyData && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] italic text-slate-400 shadow-sm">
          Esta parroquia no tiene datos MGWR ni de determinantes en la simulación
          actual. Volver al agregado provincial o nacional para ver los promedios.
        </div>
      )}

      {/* R² local MGWR */}
      {hasMgwr && r2 != null && (
        <section className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 shadow-sm">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <Gauge size={11} /> R² local MGWR
          </div>
          <div className="flex items-baseline gap-2">
            <div className="font-display text-3xl font-bold leading-none text-violet-700">
              {(r2 * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-400">ajuste local</div>
          </div>
          <R2Bar r2={r2} />
          <div className="mt-1 text-[10px] text-slate-500">
            Los 6 determinantes modelados explican el {(r2 * 100).toFixed(0)}% de la
            variabilidad local en {ENT_LABEL[effectiveEnt].toLowerCase()}{' '}
            {aggregated.level === 'parroquia' ? 'de esta parroquia' :
             aggregated.level === 'provincia' ? 'de la provincia (media)' :
                                                 'a nivel nacional (media)'}.
          </div>
        </section>
      )}

      {/* Ranking MGWR — determinantes por β descendente */}
      {hasMgwr && betaRanking.length > 0 && (
        <section>
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <span className="flex items-center gap-1.5 truncate">
              <BrainCircuit size={11} className="flex-shrink-0" />
              <span className="truncate">Peso de cada determinante (β)</span>
            </span>
            <span className="flex-shrink-0 font-normal normal-case tracking-normal text-slate-400">
              {ENT_LABEL[effectiveEnt]}
            </span>
          </div>
          <div className="space-y-1.5 rounded border border-slate-200 bg-white p-2.5 shadow-sm">
            {betaRanking.map(({ id, beta }) => (
              <BetaRow
                key={id}
                label={DET_LABEL[id] || id}
                value={beta}
                max={1}
                color={DET_META[id]?.color || '#7c3aed'}
              />
            ))}
            <div className="border-t border-slate-100 pt-1 text-[9px] italic text-slate-400">
              β normalizado 0–1 · mayor β = determinante más influyente en esta unidad.
            </div>
          </div>
        </section>
      )}

      {/* Valores brutos de los 7 determinantes */}
      {hasDet && (
        <section>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <FlaskConical size={11} />
            Determinantes parroquiales
            {aggregated.level !== 'parroquia' && (
              <span className="ml-auto text-[9px] font-normal normal-case tracking-normal text-slate-400">
                media de {aggregated.n} parroquias
              </span>
            )}
          </div>
          <div className="space-y-1.5 rounded border border-slate-200 bg-white p-2.5 shadow-sm">
            {DET_ORDER.map(d => {
              const meta = DET_META[d]
              const v = Number(aggregated.det[d] || 0)
              return (
                <DetRow
                  key={d}
                  label={DET_LABEL[d] || meta.label}
                  value={v}
                  max={meta.max}
                  unit={meta.unit}
                  color={meta.color}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* Footer */}
      <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-800">
        <div className="mb-0.5 flex items-center gap-1 font-semibold">
          <FlaskConical size={10} /> Simulación estructurada
        </div>
        ENSANUT-ECU 2018 + STEPS-OMS + CPV 2022 + GBD 2021 ajustado por factor
        urbano/rural y ruido σ=8%. MGWR: β nacional × kernel gaussiano anclado
        en focos reales. Reemplazable por Proyecto INSPI F-I+D+i-075
        (Núñez-ESPE 2026-2027).
      </div>
    </div>
  )
}

// ───── Subcomponentes ─────

function R2Bar({ r2 }) {
  const pct = Math.max(0, Math.min(100, r2 * 100))
  // Colores discretos por rango (R² > 0.7 = fuerte, 0.5-0.7 = moderado, <0.5 = débil)
  const color =
    r2 >= 0.7 ? '#5a279f' :
    r2 >= 0.5 ? '#7c3aed' :
                '#a78bfa'
  return (
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

function BetaRow({ label, value, max, color }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-[10.5px]">
        <span className="truncate font-medium text-slate-600">{label}</span>
        <span className="flex-shrink-0 font-mono text-slate-700">
          β={Number(value || 0).toFixed(2)}
        </span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

function DetRow({ label, value, max, unit, color }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const formatted = unit === '%'
    ? `${value.toFixed(1)} %`
    : unit === 'km'
      ? `${value.toFixed(2)} km`
      : `${value.toFixed(1)} ${unit}`
  return (
    <div>
      <div className="flex items-center justify-between text-[10.5px]">
        <span className="truncate font-medium text-slate-600">{label}</span>
        <span className="flex-shrink-0 font-mono text-slate-700">{formatted}</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}
