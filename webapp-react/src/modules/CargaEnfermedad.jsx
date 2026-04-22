// CargaEnfermedad — Módulo principal Sprint 2.1
// Representa los resultados del estudio "Evolución de la mortalidad por
// enfermedades no transmisibles en Ecuador (2017-2023)" sobre el visor
// parroquial 2013-2023.
//
// Ficha derecha:
//   · Encabezado con unidad seleccionada (parroquia / provincia / nacional)
//   · 2 KPI: Tasa Prevalencia + Tasa Mortalidad · ambos con Δ YoY
//   · Tendencia Temporal 2013-2023 (curvas prev + mort)
//   · Desglose por sexo y área (solo agregado nacional, del estudio 2017-2023)
//   · Tendencia estadística (pendiente, p-valor) del estudio
//
// Lógica de unidad agregada:
//   - selectedDpa null → agrega TODAS las parroquias del provFilter (o nacional)
//   - selectedDpa set  → datos de esa parroquia exacta

import { useMemo } from 'react'
import { Crosshair, X, Activity, Users, MapPin } from 'lucide-react'
import { useStore } from '../store'
import { usePlay, YEARS } from '../hooks/usePlay'
import { ENT_LABEL } from '../lib/colors'
import { getParroquiaKey, getParroquiaLabel } from '../lib/parroquia'
import { generateData } from '../lib/rates'
import { buildYearSeries, buildAggregateSeries } from '../lib/trend'
import KPIBlock from '../components/ficha/KPIBlock'
import TendenciaChart from '../components/ficha/TendenciaChart'

export default function CargaEnfermedad() {
  usePlay() // arranca el timer de animación 2013→2023 cuando state.playing=true

  const ent           = useStore(s => s.ent)
  const year          = useStore(s => s.year)
  const provFilter    = useStore(s => s.provFilter)
  const selectedDpa   = useStore(s => s.selectedDpa)
  const selectedProps = useStore(s => s.selectedProps)
  const clearSelected = useStore(s => s.clearSelected)
  const geoParr       = useStore(s => s.geoParr)
  const entData       = useStore(s => s.entData)
  const pobData       = useStore(s => s.pobData)
  const estudioData   = useStore(s => s.estudioData)

  // Serie 2013→2023 de la unidad activa (siempre completa, no se corta con el año)
  const series = useMemo(() => {
    if (selectedDpa && selectedProps) {
      const key = getParroquiaKey(selectedProps)
      return buildYearSeries(key, ent, entData, pobData)
    }
    if (!geoParr) return []
    return buildAggregateSeries(geoParr.features, ent, entData, pobData, provFilter)
  }, [selectedDpa, selectedProps, geoParr, ent, entData, pobData, provFilter])

  // Año actual y año anterior dentro de la serie (para delta YoY)
  const currentYear = useMemo(() => series.find(s => s.year === year), [series, year])
  const prevYear    = useMemo(() => {
    const yi = series.findIndex(s => s.year === year)
    return yi > 0 ? series[yi - 1] : null
  }, [series, year])

  // Datos del estudio ENT 2017-2023 (nacional) para el grupo activo
  const estudioGrupo = useMemo(() => {
    if (!estudioData || ent === 'todas') return null
    return estudioData.grupos?.[ent] || null
  }, [estudioData, ent])

  const yearIdxStudy = useMemo(() => {
    if (!estudioData) return -1
    return (estudioData.anios || []).indexOf(year)
  }, [estudioData, year])

  // Etiqueta de la unidad
  const unitLabel = useMemo(() => {
    if (selectedDpa && selectedProps) {
      return {
        title: getParroquiaLabel(selectedProps),
        sub:   provFilter ? `Provincia ${provFilter}` : 'Detalle parroquial',
      }
    }
    if (provFilter) {
      const nParr = geoParr
        ? geoParr.features.filter(f => {
            const p = f.properties || {}
            const pk = String(p.DPA_PROVIN || p.prov_cod || p.DPA_PROV || '').padStart(2, '0')
            return pk === provFilter
          }).length
        : 0
      return {
        title: `Provincia ${provFilter} (agregado)`,
        sub:   `${nParr} parroquias`,
      }
    }
    return {
      title: 'Nacional · Ecuador continental',
      sub:   geoParr ? `${geoParr.features.length} parroquias` : '',
    }
  }, [selectedDpa, selectedProps, provFilter, geoParr])

  if (!entData || !pobData) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-xs text-slate-400">
        Cargando…
      </div>
    )
  }

  const isNational  = !selectedDpa && !provFilter
  const hasStudyDet = isNational && estudioGrupo && yearIdxStudy >= 0

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      {/* Header de la ficha */}
      <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-inspi-navy to-inspi-navy-2 p-3 text-white">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-wider text-inspi-yellow">
              {ENT_LABEL[ent]}
            </div>
            <div className="truncate font-display text-base font-semibold">
              {unitLabel.title}
            </div>
            {unitLabel.sub && (
              <div className="text-[11px] text-slate-300">{unitLabel.sub}</div>
            )}
          </div>
          {selectedDpa && (
            <button
              onClick={clearSelected}
              className="flex-shrink-0 rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white"
              title="Volver al agregado"
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

      {/* Bloques KPI: Prevalencia + Mortalidad con Δ YoY */}
      <div className="grid grid-cols-2 gap-2">
        <KPIBlock
          title="Tasa Est. Prevalencia"
          value={currentYear?.rate ?? 0}
          prev={prevYear?.rate}
          prevYear={prevYear?.year}
          casos={currentYear?.casos}
          muertes={currentYear?.muertes}
          pob={currentYear?.pob}
          real={Boolean(currentYear && currentYear.pob > 0)}
          accent="navy"
        />
        <KPIBlock
          title="Tasa de Mortalidad"
          value={currentYear?.mortRate ?? 0}
          prev={prevYear?.mortRate}
          prevYear={prevYear?.year}
          real={Boolean(currentYear && currentYear.pob > 0)}
          accent="red"
        />
      </div>

      {/* Tendencia temporal 2013-2023 */}
      <section>
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <Activity size={11} /> Tendencia Temporal ({YEARS[0]}–{YEARS[YEARS.length - 1]})
        </div>
        <TendenciaChart series={series} disease={ent} year={year} />
      </section>

      {/* Tendencia estadística — solo cuando hay dato del estudio */}
      {estudioGrupo?.tendencia?.clase && (
        <section className="rounded border border-amber-200 bg-amber-50/60 p-2.5">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
            Tendencia estadística · estudio ENT 2017-2023
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <div className="text-slate-600">Pendiente</div>
            <div className="text-right font-mono font-semibold text-amber-900">
              {estudioGrupo.tendencia.pendiente >= 0 ? '+' : ''}
              {estudioGrupo.tendencia.pendiente}
            </div>
            <div className="text-slate-600">Variación anual</div>
            <div className="text-right font-mono font-semibold text-amber-900">
              {estudioGrupo.tendencia.pct_anual >= 0 ? '+' : ''}
              {estudioGrupo.tendencia.pct_anual}%
            </div>
            <div className="text-slate-600">IC 95%</div>
            <div className="text-right font-mono text-[10px] text-amber-900">
              {estudioGrupo.tendencia.ic95}
            </div>
            <div className="text-slate-600">p-valor</div>
            <div className="text-right font-mono font-semibold text-amber-900">
              {estudioGrupo.tendencia.p_valor}
            </div>
            <div className="text-slate-600">Clase</div>
            <div className="text-right font-semibold text-amber-900">
              {estudioGrupo.tendencia.clase}
            </div>
          </div>
        </section>
      )}

      {/* Desglose por sexo (estudio nacional) */}
      {hasStudyDet && estudioGrupo.mortalidad_sexo?.hombre && (
        <section>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <Users size={11} /> Mortalidad por sexo — {year} (nacional)
          </div>
          <SexoBars
            hombre={estudioGrupo.mortalidad_sexo.hombre[yearIdxStudy]}
            mujer={estudioGrupo.mortalidad_sexo.mujer[yearIdxStudy]}
          />
        </section>
      )}

      {/* Desglose por área (estudio nacional) */}
      {hasStudyDet && estudioGrupo.mortalidad_area?.urbana && (
        <section>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <MapPin size={11} /> Mortalidad por área — {year} (nacional)
          </div>
          <AreaBars
            urbana={estudioGrupo.mortalidad_area.urbana[yearIdxStudy]}
            rural={estudioGrupo.mortalidad_area.rural[yearIdxStudy]}
          />
        </section>
      )}

      {isNational && ent !== 'todas' && !hasStudyDet && (
        <div className="rounded border border-slate-200 bg-slate-50 p-2 text-[10px] italic text-slate-500">
          El estudio ENT 2017-2023 no incluye el año {year}. Desglose por sexo y
          área disponible solo para 2017-2023 agregado nacional.
        </div>
      )}
    </div>
  )
}

// ───── Subcomponentes simples de barra ─────

function SexoBars({ hombre, mujer }) {
  const max = Math.max(hombre || 0, mujer || 0, 1)
  return (
    <div className="space-y-1.5 rounded border border-slate-200 bg-white p-2">
      <Row label="Hombre" value={hombre} max={max} color="#2563eb" unit=" /100k" />
      <Row label="Mujer"  value={mujer}  max={max} color="#ec4899" unit=" /100k" />
    </div>
  )
}

function AreaBars({ urbana, rural }) {
  const max = Math.max(urbana || 0, rural || 0, 1)
  return (
    <div className="space-y-1.5 rounded border border-slate-200 bg-white p-2">
      <Row label="Urbana" value={urbana} max={max} color="#0891b2" unit=" /100k" />
      <Row label="Rural"  value={rural}  max={max} color="#65a30d" unit=" /100k" />
    </div>
  )
}

function Row({ label, value, max, color, unit = '' }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-mono text-slate-700">
          {Number(value || 0).toFixed(1)}{unit}
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
