// CargaEnfermedad — Módulo principal del visor (MORBILIDAD HOSPITALARIA y
// MORTALIDAD). La métrica activa sigue siempre al toggle del sidebar para
// no duplicar indicadores y confundir al lector. Análisis de tendencia
// Mann-Kendall + pendiente de Sen + FDR Benjamini-Hochberg pre-computado
// en Fase 5 del pipeline Python (12 años 2013-2024).
//
// Ficha derecha (tomadores de decisiones · una sola métrica a la vez):
//   · Encabezado con unidad seleccionada (parroquia/provincia/nacional)
//   · KPI de la métrica activa
//       ─ valor actual
//       ─ Δ vs año anterior (verde si baja, rojo si sube — en salud sube = peor)
//       ─ píldora tendencia 2013-2024 (Ascendente / Descendente / Estable + %/año)
//   · Cifras base (casos O muertes + población) del año activo
//   · Gráfico Tendencia Temporal 2013-2024
//   · Tarjeta de análisis estadístico (τ Kendall, Sen/año, p(FDR), n)
//   · Desglose por sexo y área (solo mortalidad nacional 2017-2023, estudio Morales)

import { useMemo } from 'react'
import {
  Crosshair, X, Activity, Users, MapPin,
  ArrowUpRight, ArrowDownRight, MoveRight,
} from 'lucide-react'
import { useStore } from '../store'
import { usePlay, YEARS } from '../hooks/usePlay'
import { ENT_LABEL } from '../lib/colors'
import { getParroquiaKey, getParroquiaLabel, getParroquiaLabelShort, getProvLabel } from '../lib/parroquia'
import {
  buildYearSeries, buildAggregateSeries,
  computeTrend, lookupTrend, enrichAnnualPct,
} from '../lib/trend'
import KPIBlock from '../components/ficha/KPIBlock'
import TendenciaChart from '../components/ficha/TendenciaChart'
import Cite from '../components/ficha/Cite'

export default function CargaEnfermedad() {
  usePlay()

  const ent             = useStore(s => s.ent)
  const year            = useStore(s => s.year)
  const provFilter      = useStore(s => s.provFilter)
  const setProvFilter   = useStore(s => s.setProvFilter)
  const selectedDpa     = useStore(s => s.selectedDpa)
  const selectedProps   = useStore(s => s.selectedProps)
  const clearSelected   = useStore(s => s.clearSelected)
  const geoParr         = useStore(s => s.geoParr)
  const geoProv         = useStore(s => s.geoProv)
  const entData       = useStore(s => s.entData)
  const pobData       = useStore(s => s.pobData)
  const estudioData   = useStore(s => s.estudioData)
  const mapMetric     = useStore(s => s.mapMetric)

  // Serie 2013→2024 de la unidad activa (siempre completa — 12 años)
  const series = useMemo(() => {
    if (selectedDpa && selectedProps) {
      const key = getParroquiaKey(selectedProps)
      return buildYearSeries(key, ent, entData, pobData)
    }
    if (!geoParr) return []
    return buildAggregateSeries(geoParr.features, ent, entData, pobData, provFilter)
  }, [selectedDpa, selectedProps, geoParr, ent, entData, pobData, provFilter])

  // Año actual y anterior (para delta YoY)
  const currentYear = useMemo(() => series.find(s => s.year === year), [series, year])
  const prevYear    = useMemo(() => {
    const yi = series.findIndex(s => s.year === year)
    return yi > 0 ? series[yi - 1] : null
  }, [series, year])

  // Análisis de tendencia Mann-Kendall + Sen + FDR (pre-computado en Fase 5).
  // Selecciona nivel geográfico correcto:
  //   · parroquia seleccionada → level='parroquia', unitId=DPA6
  //   · provFilter activo      → level='provincia', unitId=DPA2
  //   · ninguno                → level='nacional'
  // Para ENT='todas' (pseudo-agregado suma 5 grupos) no hay pre-cómputo →
  // lookupTrend devuelve valid=false y caemos a computeTrend (OLS) sobre la
  // serie local construida con buildAggregateSeries/buildYearSeries.
  const { morbTrend, mortTrend } = useMemo(() => {
    let level, unitId
    if (selectedDpa && selectedProps) {
      level  = 'parroquia'
      unitId = getParroquiaKey(selectedProps)
    } else if (provFilter) {
      level  = 'provincia'
      unitId = provFilter
    } else {
      level  = 'nacional'
      unitId = null
    }

    let morb = lookupTrend(entData, level, unitId, ent, 'morbilidad', 'serie_completa')
    let mort = lookupTrend(entData, level, unitId, ent, 'mortalidad', 'serie_completa')

    // Parroquia no trae serie_tasa pre-computada → enriquecer annualPct desde la serie local
    if (level === 'parroquia') {
      morb = enrichAnnualPct(morb, series, 'rate')
      mort = enrichAnnualPct(mort, series, 'mortRate')
    }

    // Fallback OLS para ENT='todas' (no pre-computado)
    if (!morb.valid && morb.reason === 'todas') morb = computeTrend(series, 'rate')
    if (!mort.valid && mort.reason === 'todas') mort = computeTrend(series, 'mortRate')

    return { morbTrend: morb, mortTrend: mort }
  }, [entData, ent, selectedDpa, selectedProps, provFilter, series])

  // Desglose del estudio (solo nacional, 2017-2023)
  const estudioGrupo = useMemo(() => {
    if (!estudioData || ent === 'todas') return null
    return estudioData.grupos?.[ent] || null
  }, [estudioData, ent])
  const yearIdxStudy = useMemo(() => {
    if (!estudioData) return -1
    return (estudioData.anios || []).indexOf(year)
  }, [estudioData, year])

  const unitLabel = useMemo(() => {
    if (selectedDpa && selectedProps) {
      // Title corto (parroquia · cantón) y la provincia se queda como
      // subtítulo abajo — así no se repite el nombre de provincia.
      const provName = provFilter
        ? getProvLabel(provFilter, geoProv)
        : (selectedProps.DPA_DESPRO || '')
      return {
        title: getParroquiaLabelShort(selectedProps),
        sub:   provName ? `Provincia de ${provName}` : 'Detalle parroquial',
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
        title: `Provincia de ${getProvLabel(provFilter, geoProv)}`,
        sub:   `${nParr} parroquias · agregado provincial`,
      }
    }
    return {
      title: 'Ecuador continental',
      sub:   geoParr ? `${geoParr.features.length} parroquias · agregado nacional` : '',
    }
  }, [selectedDpa, selectedProps, provFilter, geoParr, geoProv])

  if (!entData || !pobData) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-xs text-slate-400">
        Cargando…
      </div>
    )
  }

  const isNational  = !selectedDpa && !provFilter
  const hasStudyDet = isNational && estudioGrupo && yearIdxStudy >= 0

  // Panel derecho refleja SOLO la métrica activa del mapa — el toggle del
  // sidebar es la fuente de verdad tanto para coropleta/heatmap/leyenda como
  // para los KPI, conteos, gráfico temporal y análisis estadístico. Así el
  // usuario no ve dos indicadores simultáneos que se confunden.
  const isMort       = mapMetric === 'mortalidad'
  const activeTitle  = isMort ? 'Tasa de Mortalidad' : 'Tasa de Morbilidad Hospitalaria'
  const activeValue  = isMort ? currentYear?.mortRate : currentYear?.rate
  const activePrev   = isMort ? prevYear?.mortRate   : prevYear?.rate
  const activeTrend  = isMort ? mortTrend            : morbTrend
  const activeCount  = isMort ? currentYear?.muertes : currentYear?.casos
  const activeCountLabel = isMort ? 'Muertes' : 'Casos'

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Header — yellow = ENT activo, title = unidad espacial, sub = contexto.
          La X aparece según haya parroquia o provincia y limpia un nivel a
          la vez (parroquia → provincia → nacional). */}
      <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-inspi-navy to-inspi-navy-2 p-3 text-white">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-wider text-inspi-red">
              {ENT_LABEL[ent]}
            </div>
            <div className="truncate font-display text-base font-semibold">
              {unitLabel.title}
            </div>
            {unitLabel.sub && (
              <div className="text-[11px] text-slate-300">{unitLabel.sub}</div>
            )}
          </div>
          {selectedDpa ? (
            <button
              onClick={clearSelected}
              className="flex-shrink-0 rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white"
              title="Quitar selección de parroquia (vuelve a la provincia)"
              aria-label="Deseleccionar parroquia"
            >
              <X size={14} />
            </button>
          ) : provFilter ? (
            <button
              onClick={() => setProvFilter(null)}
              className="flex-shrink-0 rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white"
              title="Quitar filtro de provincia (vuelve a vista nacional)"
              aria-label="Quitar filtro de provincia"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
        {!selectedDpa && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-300">
            <Crosshair size={10} /> Click en una parroquia del mapa para ver detalle
          </div>
        )}
      </div>

      {/* KPI único — la métrica activa del mapa (morbilidad o mortalidad).
          Ocupa el ancho completo en lugar del 50 % anterior. */}
      <KPIBlock
        title={activeTitle}
        value={activeValue ?? 0}
        prev={activePrev}
        prevYear={prevYear?.year}
        real={Boolean(currentYear && currentYear.pob > 0)}
        accent={isMort ? 'red' : 'navy'}
        trend={activeTrend}
      />

      {/* Conteos absolutos — solo el numerador de la métrica activa + pobl.
          (Casos si morbilidad, Muertes si mortalidad). */}
      {currentYear && (activeCount > 0 || currentYear.pob > 0) && (
        <CifrasBase
          countValue={activeCount}
          countLabel={activeCountLabel}
          countColor={isMort ? 'text-rose-700' : 'text-inspi-navy'}
          pob={currentYear.pob}
          year={year}
        />
      )}

      {/* Tendencia temporal 2013-2024 — una sola serie, la del toggle activo. */}
      <section>
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            <Activity size={11} className="flex-shrink-0" />
            <span className="truncate">Tendencia {YEARS[0]}–{YEARS[YEARS.length - 1]}</span>
          </span>
          <span className="flex-shrink-0 font-normal normal-case tracking-normal text-slate-400">
            {isMort ? 'Mortalidad' : 'Morbilidad'} /100k
          </span>
        </div>
        <TendenciaChart series={series} disease={ent} year={year} metric={mapMetric} />
      </section>

      {/* Análisis estadístico — solo métrica activa */}
      {activeTrend.valid && (
        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Análisis de tendencia · metodología del estudio
              <Cite
                n={1}
                href="https://www.inspilip.gob.ec/index.php/inspi/article/view/853"
                title="Evolución de la mortalidad por enfermedades no transmisibles en Ecuador (2017-2023)"
              />
            </div>
            <div className="text-[9px] font-medium text-slate-400">
              {YEARS[0]}–{YEARS[YEARS.length - 1]} · n={activeTrend.n}
            </div>
          </div>
          <TrendRow label={isMort ? 'Mortalidad' : 'Morbilidad hospitalaria'} trend={activeTrend} />
          <div className="mt-2 border-t border-slate-100 pt-1.5 text-[9px] text-slate-400">
            Mann-Kendall (τ) · pendiente de Sen · FDR Benjamini-Hochberg · α=0.05
          </div>
        </section>
      )}

      {/* Desgloses por sexo/área — solo existen para mortalidad en el
          estudio Morales 2017-2023, así que solo aparecen cuando el toggle
          está en mortalidad (para coherencia con el resto del panel). */}

      {/* Desglose por sexo — solo nacional 2017-2023 (del estudio) */}
      {isMort && hasStudyDet && estudioGrupo.mortalidad_sexo?.hombre && (
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

      {/* Desglose por área — solo nacional 2017-2023 (del estudio) */}
      {isMort && hasStudyDet && estudioGrupo.mortalidad_area?.urbana && (
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
    </div>
  )
}

// ───── Subcomponentes ─────

function CifrasBase({ countValue, countLabel, countColor, pob, year }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Cifras del año {year}
      </div>
      <div className="grid grid-cols-2 gap-4 text-center">
        <Cifra label={countLabel} value={countValue} color={countColor} />
        <Cifra label="Población"  value={pob}        color="text-slate-700" />
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

function TrendRow({ label, trend }) {
  if (!trend?.valid) {
    return (
      <div className="flex items-center justify-between border-b border-slate-100 py-1.5 text-[11px] last:border-b-0">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="italic text-slate-400">sin datos suficientes</span>
      </div>
    )
  }
  const styles = {
    up:   { bg: 'bg-rose-50',    text: 'text-rose-700',    Icon: ArrowUpRight   },
    down: { bg: 'bg-emerald-50', text: 'text-emerald-700', Icon: ArrowDownRight },
    flat: { bg: 'bg-slate-100',  text: 'text-slate-600',   Icon: MoveRight      },
  }
  const s = styles[trend.dir]
  const Icon = s.Icon
  const pVal = trend.pValue
  const pStr = pVal == null ? 'n/a'
    : pVal < 0.001 ? '<0.001' : pVal.toFixed(3)
  const senSlope = trend.senSlope ?? trend.slope ?? 0
  const hasTau = trend.tau != null
  return (
    <div className="border-b border-slate-100 py-1.5 last:border-b-0">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-700">{label}</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}>
          <Icon size={10} strokeWidth={2.5} />
          {trend.clase}
        </span>
      </div>
      <div className="mt-1 grid grid-cols-4 gap-x-2 font-mono text-[9.5px] text-slate-500">
        <Stat label="% anual"  value={`${trend.annualPct >= 0 ? '+' : ''}${trend.annualPct}`} />
        <Stat label="Sen/año"  value={`${senSlope >= 0 ? '+' : ''}${Number(senSlope).toFixed(2)}`} />
        <Stat label="p(FDR)"   value={pStr} highlight={trend.significant} />
        <Stat
          label={hasTau ? 'τ Kendall' : 'R²'}
          value={hasTau ? trend.tau.toFixed(2) : (trend.r2 ?? '—')}
        />
      </div>
    </div>
  )
}

function Stat({ label, value, highlight }) {
  return (
    <div>
      <div className={`font-semibold ${highlight ? 'text-inspi-navy' : 'text-slate-700'}`}>
        {value}
      </div>
      <div className="text-[8.5px] uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  )
}

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
