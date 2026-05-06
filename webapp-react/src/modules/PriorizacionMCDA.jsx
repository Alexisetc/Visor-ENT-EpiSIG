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
import { Crosshair, X, Star, Award, FlaskConical, Loader2 } from 'lucide-react'
import { useStore } from '../store'
import { useModuleDataLoader } from '../hooks/useDataLoader'
import { ENT_LABEL, ENT_COLOR, ENTS } from '../lib/colors'
import { getParroquiaKey, getParroquiaLabel, getParroquiaLabelShort, getParroquiaProvKey, getProvLabel } from '../lib/parroquia'

export default function PriorizacionMCDA() {
  // Lazy-load: dispara fetch de priorizacion_mcda.json la primera vez
  // que el usuario activa este módulo.
  useModuleDataLoader('mcda')

  const ent             = useStore(s => s.ent)
  const provFilter      = useStore(s => s.provFilter)
  const setProvFilter   = useStore(s => s.setProvFilter)
  const selectedDpa     = useStore(s => s.selectedDpa)
  const selectedProps   = useStore(s => s.selectedProps)
  const clearSelected   = useStore(s => s.clearSelected)
  const geoParr         = useStore(s => s.geoParr)
  const geoProv         = useStore(s => s.geoProv)
  const mcdaData        = useStore(s => s.mcdaData)
  const moduleLoading   = useStore(s => s.moduleLoading.mcda)

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
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        {moduleLoading ? (
          <>
            <Loader2 size={20} className="animate-spin text-inspi-red" strokeWidth={2.2} />
            <div className="font-display text-[12px] font-semibold text-inspi-navy">
              Cargando datos del módulo Priorización MCDA…
            </div>
            <div className="font-display text-[10.5px] text-inspi-muted">
              Ranking ponderado · 6 criterios
            </div>
          </>
        ) : (
          <div className="font-display text-[11px] italic text-inspi-muted">
            Datos del módulo no disponibles. Recargá la página o intentá más tarde.
          </div>
        )}
      </div>
    )
  }

  const criterios  = mcdaData.criterios || []
  const ranking    = unit?.ranking || []
  const top        = ranking[0] || null
  const maxScore   = ranking.length > 0 ? Math.max(...ranking.map(r => r.score), 0.0001) : 0.0001
  const hasRanking = ranking.length > 0 && top && Number.isFinite(top.score) && top.score > 0

  // === ENT en foco ===
  // Si el usuario filtró un grupo ENT específico en el sidebar, el panel
  // destaca ese grupo en lugar del #1 absoluto. Permite ver dónde quedó
  // ranqueada la ENT seleccionada y sus criterios.
  const focusEnt = ent === 'todas'
    ? top
    : (ranking.find(r => r.ent === ent) || top)
  const isFocusUserPick = ent !== 'todas' && focusEnt && focusEnt.ent === ent

  return (
    <div className="flex flex-col">
      {/* Header de panel — Manual de Diseño v2 (mismo patrón que Carga). */}
      <section className="border-b border-inspi-line bg-gradient-to-b from-inspi-slate-50 to-inspi-paper px-4 pb-3 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-display text-[9.5px] font-bold uppercase tracking-[0.08em] text-inspi-muted">
              <Star size={11} strokeWidth={2.4} className="text-inspi-red" />
              <span>Priorización MCDA</span>
            </div>
            <div className="mt-1 truncate font-display text-[17px] font-bold leading-[1.15] tracking-[-0.01em] text-inspi-navy">
              {unitLabel.title}
            </div>
            {unitLabel.sub && (
              <div className="mt-0.5 font-display text-[11px] font-medium text-inspi-muted">
                {unitLabel.sub}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {hasRanking && focusEnt && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-inspi-navy px-2 py-0.5 font-display text-[9.5px] font-bold uppercase tracking-[0.05em] text-white"
                  title={isFocusUserPick
                    ? `ENT seleccionada: ${ENT_LABEL[focusEnt.ent]} (rank #${focusEnt.rank})`
                    : `ENT prioritaria: ${ENT_LABEL[focusEnt.ent]}`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-[1px]"
                    style={{ background: focusEnt.color }}
                    aria-hidden="true"
                  />
                  #{focusEnt.rank} {ENT_LABEL[focusEnt.ent]}
                </span>
              )}
              <span className="rounded-full bg-inspi-amber/15 px-2 py-0.5 font-display text-[9.5px] font-bold uppercase tracking-[0.05em] text-inspi-amber">
                Simulación
              </span>
            </div>
          </div>
          {(selectedDpa || provFilter) && (
            <button
              onClick={selectedDpa ? clearSelected : () => setProvFilter(null)}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[3px] text-inspi-muted hover:bg-inspi-line hover:text-inspi-navy"
              title={selectedDpa ? 'Quitar selección de parroquia' : 'Quitar filtro de provincia'}
              aria-label={selectedDpa ? 'Deseleccionar parroquia' : 'Quitar filtro de provincia'}
            >
              <X size={14} />
            </button>
          )}
        </div>
        {!selectedDpa && (
          <div className="mt-2 flex items-center gap-1 font-display text-[10px] italic text-inspi-muted">
            <Crosshair size={10} /> Click en una parroquia del mapa para ver el detalle
          </div>
        )}
      </section>

      {/* Body del panel con padding propio. */}
      <div className="flex flex-col gap-3.5 px-4 py-3.5">

      {/* Fallback: parroquia sin datos MCDA */}
      {!hasRanking && (
        <div className="rounded-[3px] border border-inspi-navy/30 bg-inspi-navy/5 p-3 text-[11px] leading-relaxed text-inspi-navy">
          <div className="mb-1 flex items-center gap-1 font-semibold">
            <FlaskConical size={11} /> Sin datos MCDA para esta unidad
          </div>
          Esta parroquia no tiene registros en el dataset MCDA (menos de 10 casos
          totales y/o sin información suficiente para priorizar). Prueba con otra
          parroquia o vuelve al agregado provincial/nacional para ver el ranking.
        </div>
      )}

      {/* ENT en foco — la #1 del ranking, o la que el usuario filtró
          en el sidebar. Card institucional con borde rojo top + dot de
          la categoría como acento (sin dominar el color). */}
      {focusEnt && (
        <section className="relative rounded-[3px] border border-inspi-line bg-inspi-paper p-3 shadow-sm">
          <span className="absolute left-0 right-0 top-0 h-[2px] bg-inspi-red" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-display text-[10px] font-bold uppercase tracking-[0.07em] text-inspi-muted">
              <Award size={11} strokeWidth={2.4} className="text-inspi-red" />
              {isFocusUserPick ? 'ENT seleccionada' : 'ENT prioritaria #1'}
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-inspi-line bg-inspi-bone px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.05em] text-inspi-navy tnum">
              Rank {focusEnt.rank}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-[2px]"
              style={{ background: focusEnt.color }}
              title={`Categoría ENT: ${ENT_LABEL[focusEnt.ent]}`}
            />
            <div className="font-display text-[20px] font-bold leading-none text-inspi-navy">
              {ENT_LABEL[focusEnt.ent]}
            </div>
            <div className="ml-auto text-right">
              <div className="font-mono text-[20px] font-bold leading-none text-inspi-navy tnum">
                {focusEnt.score.toFixed(3)}
              </div>
              <div className="mt-0.5 font-display text-[9px] font-semibold uppercase tracking-[0.07em] text-inspi-muted">
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
                focused={isFocusUserPick && r.ent === ent}
              />
            ))}
            <div className="border-t border-slate-100 pt-1 text-[9px] italic text-slate-400">
              Score = Σ (normalizadoᵢ × pesoᵢ) · mayor score = mayor prioridad.
            </div>
          </div>
        </section>
      )}

      {/* Breakdown por criterio para la ENT en foco */}
      {focusEnt && criterios.length > 0 && (
        <section>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <FlaskConical size={11} />
            {isFocusUserPick ? 'Criterios de la ENT seleccionada' : 'Criterios de la ENT prioritaria'}
            <span className="ml-auto text-[9px] font-normal normal-case tracking-normal text-slate-400">
              {ENT_LABEL[focusEnt.ent]}
            </span>
          </div>
          <div className="space-y-1.5 rounded border border-slate-200 bg-white p-2.5 shadow-sm">
            {criterios.map(c => {
              const norm = Number(focusEnt.normalized?.[c.id] || 0)
              const aporte = norm * (c.peso || 0)
              return (
                <CritRow
                  key={c.id}
                  label={c.nombre}
                  peso={c.peso}
                  value={norm}
                  aporte={aporte}
                />
              )
            })}
            <div className="border-t border-slate-100 pt-1 text-[9px] italic text-slate-400">
              Peso × valor normalizado 0–1 · el aporte a la derecha suma el score total.
            </div>
          </div>
        </section>
      )}

      {/* Contexto de la unidad — base CPV 2022 */}
      {unit && (unit.pob > 0 || unit.casos > 0) && (
        <div>
          <div className="mb-1 font-display text-[10px] font-semibold uppercase tracking-[0.07em] text-inspi-muted">
            Contexto · base CPV 2022
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Cifra label="Casos ENT" value={unit.casos} />
            <Cifra label="Población" value={unit.pob} formatM />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="rounded-[3px] border border-inspi-navy/30 bg-inspi-navy/5 p-2 text-[10px] leading-relaxed text-inspi-navy">
        <div className="mb-0.5 flex items-center gap-1 font-semibold">
          <FlaskConical size={10} /> Simulación estructurada
        </div>
        Suma ponderada (Marsh/ISPOR 2016, Baltussen 2006) con pesos:
        mortalidad 0.30 · egresos 0.20 · AVAD-GBD 0.15 · tendencia CAGR 0.15 ·
        costo-sistema 0.10 · equidad urbano-rural 0.10. Parroquias con &lt;10 casos
        heredan el ranking cantonal.
        <div className="mt-1.5 border-t border-inspi-navy/20 pt-1.5 text-[9.5px]">
          <span className="font-semibold">Reemplazo planeado:</span> resultados reales
          del Proyecto Econométrico Espacial INSPI F-I+D+i-075 (Duque-ESPE 2026-2027)
          y del Proyecto de Priorización MCDA (Núñez-UTE 2026-2028) cuando estén
          disponibles.
        </div>
      </div>

      </div>
    </div>
  )
}

// ───── Subcomponentes ─────

// Gradient institucional navy → red (mismo lenguaje que Determinantes).
// Conservamos el `color` de la ENT solo para la pastilla del rank, así
// el ranking sigue siendo visualmente diferenciable por categoría sin
// que las barras compitan en hue.
const MCDA_GRADIENT = 'linear-gradient(90deg, #14213D 0%, #B81D24 100%)'

function RankRow({ rank, label, score, maxScore, color, focused = false }) {
  const pct = maxScore > 0 ? Math.max(0, Math.min(100, (score / maxScore) * 100)) : 0
  return (
    <div className={`rounded-[3px] transition-colors ${focused ? '-mx-1 bg-inspi-red/8 px-1 py-1 ring-1 ring-inspi-red/25' : ''}`}>
      <div className="mb-1 flex items-center justify-between gap-2 text-[10.5px]">
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          {/* Pill del rank: navy con dot pequeño de la categoría ENT
              al lado, en vez de fondo de color saturado. Mantiene el
              número en mono y el dot da diferenciación categórica
              sin dominar el panel. */}
          <span className="inline-flex h-[18px] flex-shrink-0 items-center gap-1 rounded-[3px] bg-inspi-navy px-1 font-mono text-[9.5px] font-bold text-white">
            {rank}
            <span
              className="h-1.5 w-1.5 flex-shrink-0 rounded-[1px]"
              style={{ background: color }}
              aria-hidden="true"
            />
          </span>
          <span className={`truncate font-display ${focused ? 'font-bold' : 'font-semibold'} text-inspi-navy`}>
            {label}
            {focused && (
              <span className="ml-1.5 rounded-[2px] bg-inspi-red px-1 py-px font-display text-[8px] font-bold uppercase tracking-[0.07em] text-white">
                Seleccionada
              </span>
            )}
          </span>
        </span>
        <span className="flex-shrink-0 font-mono text-[11px] font-bold text-inspi-navy tnum">{score.toFixed(3)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-inspi-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: MCDA_GRADIENT }}
        />
      </div>
    </div>
  )
}

function CritRow({ label, peso, value, aporte }) {
  const pct = Math.max(0, Math.min(100, value * 100))
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px]">
        <span className="truncate font-display font-medium text-inspi-ink">
          {label}
          <span className="ml-1 font-mono font-normal text-inspi-muted/80">×{peso}</span>
        </span>
        <span className="flex-shrink-0 font-mono text-inspi-navy tnum">
          {value.toFixed(2)}
          <span className="ml-1 text-[9px] text-inspi-muted/70">→ {aporte.toFixed(3)}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-inspi-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: MCDA_GRADIENT }}
        />
      </div>
    </div>
  )
}

function Cifra({ label, value, formatM = false }) {
  const display = formatM && value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(2)}M`
    : Number(value || 0).toLocaleString('es')
  return (
    <div className="rounded-[3px] border border-inspi-line bg-inspi-bone/40 px-2.5 py-1.5">
      <div className="font-display text-[9px] font-semibold uppercase tracking-[0.07em] text-inspi-muted">
        {label}
      </div>
      <div className="mt-0.5 truncate font-mono text-[18px] font-bold leading-none text-inspi-navy tnum">
        {display}
      </div>
    </div>
  )
}
