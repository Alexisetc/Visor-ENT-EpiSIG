// PriorizacionMCDA — Módulo "priorización multi-criterio MCDA".
//
// Ficha derecha (tomadores de decisiones · responde "¿en cuál ENT invierto
// aquí primero?"):
//   · Encabezado con unidad + badge de la ENT top
//   · ENT prioritaria (score destacado + ranking 1)
//   · Ranking completo — 5 ENTs ordenadas por score con barra horizontal
//   · Breakdown por criterio — los 6 criterios MCDA con su peso y aporte
//     normalizado para la ENT top-ranked
//   · Nota de pesos + fuentes metodológicas
//
// Datos:
//   mcdaData.criterios[]       → 6 criterios {id, peso, nombre}
//   mcdaData.ent_factores[ent] → {letalidad, avad, costo, color}
//   mcdaData.parroquias[DPA6]  → {nombre, cant, prov, pob_2022, casos_total,
//                                 ranking[{ent, score, color, normalized{...}, rank}]}
//
// Agregación provincia/nacional: media PONDERADA POR POBLACIÓN (pob_2022)
// por ENT del score normalizado, re-rankeado. El score final se interpreta
// como "prioridad MCDA promedio, donde cada parroquia pesa según su población".
// Una parroquia con 300 k hab. pesa 150× más que una de 2 k hab. — coherente
// con criterios de priorización de salud pública (carga por habitante).

import { useMemo } from 'react'
import { Crosshair, X, Star, Award, FlaskConical } from 'lucide-react'
import { useStore } from '../store'
import { ENT_LABEL, ENT_COLOR, ENTS } from '../lib/colors'
import { getParroquiaKey, getParroquiaLabel, getParroquiaLabelShort, getParroquiaProvKey, getProvLabel } from '../lib/parroquia'

export default function PriorizacionMCDA() {
  const provFilter      = useStore(s => s.provFilter)
  const setProvFilter   = useStore(s => s.setProvFilter)
  const selectedDpa     = useStore(s => s.selectedDpa)
  const selectedProps   = useStore(s => s.selectedProps)
  const clearSelected   = useStore(s => s.clearSelected)
  const geoParr         = useStore(s => s.geoParr)
  const geoProv         = useStore(s => s.geoProv)
  const mcdaData        = useStore(s => s.mcdaData)

  // Unidad activa — (a) parroquia específica, (b) provincia agregada, (c) nacional agregado
  const unit = useMemo(() => {
    if (!mcdaData) return null

    if (selectedDpa && selectedProps) {
      const key = getParroquiaKey(selectedProps)
      const row = mcdaData.parroquias?.[key]
      if (!row) return { level: 'parroquia', key, ranking: [], n: 0 }
      return { level: 'parroquia', key, ranking: row.ranking || [], n: 1,
               pob: row.pob_2022 || 0, casos: row.casos_total || 0 }
    }

    if (!geoParr) return null
    const keys = geoParr.features
      .filter(f => {
        if (!provFilter) return true
        return getParroquiaProvKey(f.properties || {}) === provFilter
      })
      .map(f => getParroquiaKey(f.properties || {}))

    // Agregado: media PONDERADA POR POBLACIÓN de score + normalized por ENT.
    // Razón salud pública: una parroquia de 300 k hab. debe pesar más que una
    // de 2 k hab. al computar "prioridad promedio" provincial/nacional.
    // Fallback: si pob=0 o no disponible, ese entry pesa como 1 (equivalente a
    // contar el parroquia una vez — preserva comportamiento previo en edge cases).
    const agg = {}
    for (const e of ENTS) {
      agg[e] = {
        score_num:    0,   // Σ (score × w)
        score_w:      0,   // Σ w (pesos válidos)
        normalized: { mortalidad: 0, egresos: 0, avad: 0, tendencia: 0, costo: 0, equidad: 0 },
        norm_w:       0,   // Σ w para normalized
      }
    }
    let totalPob = 0, totalCasos = 0, hits = 0
    for (const k of keys) {
      const row = mcdaData.parroquias?.[k]
      if (!row) continue
      hits++
      const pob = Number(row.pob_2022 || 0)
      totalPob += pob
      totalCasos += Number(row.casos_total || 0)
      const w = pob > 0 ? pob : 1     // fallback equi-peso si pob no disponible
      for (const r of row.ranking || []) {
        const e = r.ent
        if (!agg[e]) continue
        const s = Number(r.score || 0)
        if (!Number.isFinite(s)) continue
        agg[e].score_num += s * w
        agg[e].score_w   += w
        const n = r.normalized || {}
        for (const cid of Object.keys(agg[e].normalized)) {
          const v = Number(n[cid] || 0)
          if (Number.isFinite(v)) agg[e].normalized[cid] += v * w
        }
        agg[e].norm_w += w
      }
    }

    // Construir ranking agregado (media ponderada)
    const ranking = ENTS
      .map(e => {
        const a = agg[e]
        const score = a.score_w > 0 ? a.score_num / a.score_w : 0
        const normalized = {}
        for (const cid of Object.keys(a.normalized)) {
          normalized[cid] = a.norm_w > 0 ? a.normalized[cid] / a.norm_w : 0
        }
        return {
          ent: e,
          score: Number(score.toFixed(4)),
          color: ENT_COLOR[e],
          normalized,
        }
      })
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({ ...r, rank: i + 1 }))

    return {
      level: provFilter ? 'provincia' : 'nacional',
      ranking,
      n: hits,
      pob: totalPob,
      casos: totalCasos,
    }
  }, [mcdaData, selectedDpa, selectedProps, provFilter, geoParr])

  const unitLabel = useMemo(() => {
    if (selectedDpa && selectedProps) {
      const provName = provFilter
        ? getProvLabel(provFilter, geoProv)
        : (selectedProps.DPA_DESPRO || '')
      return {
        title: getParroquiaLabelShort(selectedProps),
        sub:   provName ? `Provincia de ${provName}` : 'Detalle parroquial',
      }
    }
    if (provFilter) {
      return {
        title: `Provincia de ${getProvLabel(provFilter, geoProv)}`,
        sub:   `${unit?.n || 0} parroquias · agregado provincial`,
      }
    }
    return {
      title: 'Ecuador continental',
      sub:   `${unit?.n || 0} parroquias · agregado nacional`,
    }
  }, [selectedDpa, selectedProps, provFilter, geoProv, unit])

  if (!mcdaData) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-xs text-slate-400">
        Cargando dataset MCDA…
      </div>
    )
  }

  const criterios  = mcdaData.criterios || []
  const ranking    = unit?.ranking || []
  const top        = ranking[0] || null
  const maxScore   = ranking.length > 0 ? Math.max(...ranking.map(r => r.score), 0.0001) : 0.0001
  const hasRanking = ranking.length > 0 && top && Number.isFinite(top.score) && top.score > 0

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Header — yellow = módulo (Priorización MCDA), title = unidad
          espacial, sub = contexto. La X limpia parroquia → provincia →
          nacional, un nivel a la vez. */}
      <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-amber-700 to-inspi-navy p-3 text-white">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-inspi-red">
              <Star size={11} /> Priorización MCDA
            </div>
            <div className="truncate font-display text-base font-semibold">
              {unitLabel.title}
            </div>
            {unitLabel.sub && (
              <div className="text-[11px] text-slate-300">{unitLabel.sub}</div>
            )}
          </div>
          <div className="flex flex-shrink-0 items-start gap-1">
            {hasRanking && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-sm"
                style={{ background: top.color, color: 'white' }}
                title={`ENT prioritaria: ${ENT_LABEL[top.ent]}`}
              >
                #1 {ENT_LABEL[top.ent]}
              </span>
            )}
            {selectedDpa ? (
              <button
                onClick={clearSelected}
                className="rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white"
                title="Quitar selección de parroquia (vuelve a la provincia)"
                aria-label="Deseleccionar parroquia"
              >
                <X size={14} />
              </button>
            ) : provFilter ? (
              <button
                onClick={() => setProvFilter(null)}
                className="rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white"
                title="Quitar filtro de provincia (vuelve a vista nacional)"
                aria-label="Quitar filtro de provincia"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>
        {!selectedDpa && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-300">
            <Crosshair size={10} /> Click en una parroquia del mapa para ver detalle
          </div>
        )}
      </div>

      {/* Fallback: parroquia sin datos MCDA */}
      {!hasRanking && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">
          <div className="mb-1 flex items-center gap-1 font-semibold">
            <FlaskConical size={11} /> Sin datos MCDA para esta unidad
          </div>
          Esta parroquia no tiene registros en el dataset MCDA (menos de 10 casos
          totales y/o sin información suficiente para priorizar). Prueba con otra
          parroquia o vuelve al agregado provincial/nacional para ver el ranking.
        </div>
      )}

      {/* ENT prioritaria (top 1) */}
      {top && (
        <section
          className="rounded-lg border p-3 shadow-sm"
          style={{ borderColor: top.color + '33', background: top.color + '08' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <Award size={11} /> ENT prioritaria #1
            </div>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm"
              style={{ background: top.color }}
            >
              Rank {top.rank}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <div
              className="font-display text-2xl font-bold leading-none"
              style={{ color: top.color }}
            >
              {ENT_LABEL[top.ent]}
            </div>
            <div className="ml-auto text-right">
              <div className="font-mono text-xl font-bold text-slate-700">
                {top.score.toFixed(3)}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-slate-400">
                Score MCDA
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Ranking completo */}
      {ranking.length > 0 && (
        <section>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <Star size={11} /> Ranking de todos los grupos ENT
          </div>
          <div className="space-y-1.5 rounded border border-slate-200 bg-white p-2.5 shadow-sm">
            {ranking.map(r => (
              <RankRow
                key={r.ent}
                rank={r.rank}
                label={ENT_LABEL[r.ent]}
                score={r.score}
                maxScore={maxScore}
                color={r.color || ENT_COLOR[r.ent]}
              />
            ))}
            <div className="border-t border-slate-100 pt-1 text-[9px] italic text-slate-400">
              Score = Σ (normalizadoᵢ × pesoᵢ) · mayor score = mayor prioridad.
            </div>
          </div>
        </section>
      )}

      {/* Breakdown por criterio para la ENT top */}
      {top && criterios.length > 0 && (
        <section>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <FlaskConical size={11} />
            Criterios de la ENT prioritaria
            <span className="ml-auto text-[9px] font-normal normal-case tracking-normal text-slate-400">
              {ENT_LABEL[top.ent]}
            </span>
          </div>
          <div className="space-y-1.5 rounded border border-slate-200 bg-white p-2.5 shadow-sm">
            {criterios.map(c => {
              const norm = Number(top.normalized?.[c.id] || 0)
              const aporte = norm * (c.peso || 0)
              return (
                <CritRow
                  key={c.id}
                  label={c.nombre}
                  peso={c.peso}
                  value={norm}
                  aporte={aporte}
                  color={top.color}
                />
              )
            })}
            <div className="border-t border-slate-100 pt-1 text-[9px] italic text-slate-400">
              Peso × valor normalizado 0–1 · el aporte a la derecha suma el score total.
            </div>
          </div>
        </section>
      )}

      {/* Contexto de la unidad */}
      {unit && (unit.pob > 0 || unit.casos > 0) && (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Contexto (base CPV 2022)
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <Cifra label="Casos ENT" value={unit.casos} color="text-amber-700" />
            <Cifra label="Población"  value={unit.pob}   color="text-slate-700" />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-800">
        <div className="mb-0.5 flex items-center gap-1 font-semibold">
          <FlaskConical size={10} /> Simulación estructurada
        </div>
        Suma ponderada (Marsh/ISPOR 2016, Baltussen 2006) con pesos:
        mortalidad 0.30 · egresos 0.20 · AVAD-GBD 0.15 · tendencia CAGR 0.15 ·
        costo-sistema 0.10 · equidad urbano-rural 0.10. Parroquias con &lt;10 casos
        heredan el ranking cantonal.
        <div className="mt-1.5 border-t border-amber-200 pt-1.5 text-[9.5px]">
          <span className="font-semibold">Reemplazo planeado:</span> resultados reales
          del Proyecto Econométrico Espacial INSPI F-I+D+i-075 (Duque-ESPE 2026-2027)
          y del Proyecto de Priorización MCDA (Núñez-UTE 2026-2028) cuando estén
          disponibles.
        </div>
      </div>
    </div>
  )
}

// ───── Subcomponentes ─────

function RankRow({ rank, label, score, maxScore, color }) {
  const pct = maxScore > 0 ? Math.max(0, Math.min(100, (score / maxScore) * 100)) : 0
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[10.5px]">
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          <span
            className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[8.5px] font-bold text-white"
            style={{ background: color }}
          >
            {rank}
          </span>
          <span className="truncate font-medium text-slate-700">{label}</span>
        </span>
        <span className="flex-shrink-0 font-mono text-slate-700">{score.toFixed(3)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

function CritRow({ label, peso, value, aporte, color }) {
  const pct = Math.max(0, Math.min(100, value * 100))
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[10px]">
        <span className="truncate font-medium text-slate-600">
          {label}
          <span className="ml-1 font-normal text-slate-400">(×{peso})</span>
        </span>
        <span className="flex-shrink-0 font-mono text-slate-700">
          {value.toFixed(2)}
          <span className="ml-1 text-[9px] text-slate-400">→ {aporte.toFixed(3)}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

function Cifra({ label, value, color }) {
  return (
    <div className="min-w-0">
      <div className={`truncate font-mono text-lg font-semibold ${color}`}>
        {Number(value || 0).toLocaleString('es')}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  )
}
