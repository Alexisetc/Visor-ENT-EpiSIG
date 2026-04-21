// CargaEnfermedad — Módulo principal del Sprint 2.
// Renderiza la ficha derecha (KPI + tendencia + determinantes) para la unidad
// seleccionada (parroquia clickeada o nacional si nada está seleccionado).
//
// Lógica de unidad agregada:
//   - selectedDpa null → agrega TODAS las parroquias del provFilter (o nacional)
//   - selectedDpa set  → datos de esa parroquia exacta
//
// El timer Play se monta una vez aquí (usePlay).

import { useMemo } from 'react'
import { Crosshair, X } from 'lucide-react'
import { useStore } from '../store'
import { usePlay, YEARS } from '../hooks/usePlay'
import { ENT_LABEL } from '../lib/colors'
import { getParroquiaKey, getParroquiaLabel, getParroquiaProvKey } from '../lib/parroquia'
import { generateData } from '../lib/rates'
import { computeQuintiles } from '../lib/quintiles'
import KPICard from '../components/ficha/KPICard'
import TendenciaChart from '../components/ficha/TendenciaChart'
import DeterminantesBars from '../components/ficha/DeterminantesBars'

// Promedio ponderado de tasa: Σ casos / Σ pob × 100k
function aggregate(features, ent, year, entData, pobData, provFilter) {
  let casos = 0, muertes = 0, pob = 0
  for (const f of features) {
    const p = f.properties || {}
    const provKey = getParroquiaProvKey(p)
    if (provFilter && provKey !== provFilter) continue
    const key = getParroquiaKey(p)
    const d = generateData(key, ent, year, entData, pobData)
    casos   += d.casos   || 0
    muertes += d.muertes || 0
    pob     += d.pob     || 0
  }
  const rate = pob > 0 ? (casos / pob * 100000) : 0
  return { rate, casos, muertes, pob, _real: pob > 0,
           tabaco: 12, fisica: 35, obesidad: 26, pm25: 38 }
}

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

  // Unidad activa: parroquia seleccionada o agregado nacional/provincial
  const unit = useMemo(() => {
    if (selectedDpa && selectedProps) {
      const key = getParroquiaKey(selectedProps)
      const d = generateData(key, ent, year, entData, pobData)
      return {
        label: getParroquiaLabel(selectedProps),
        sub: provFilter ? `Provincia ${provFilter}` : 'Detalle parroquial',
        geoKey: key,
        data: d,
      }
    }
    // Agregado
    if (!geoParr) return { label: '—', sub: '', geoKey: null, data: null }
    const agg = aggregate(geoParr.features, ent, year, entData, pobData, provFilter)
    const provLabel = provFilter
      ? `Provincia ${provFilter} (agregado)`
      : 'Nacional · Ecuador continental'
    return {
      label: provLabel,
      sub: `${geoParr.features.length} parroquias`,
      geoKey: null,
      data: agg,
    }
  }, [selectedDpa, selectedProps, geoParr, ent, year, provFilter, entData, pobData])

  const limits = useMemo(
    () => computeQuintiles(ent, year, geoParr, entData, pobData),
    [ent, year, geoParr, entData, pobData]
  )

  if (!unit.data) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-xs text-slate-400">
        Cargando…
      </div>
    )
  }

  // Para tendencia necesitamos un geoKey: si hay agregado, usamos el primero
  // (legacy hace lo mismo: muestra la curva de la parroquia seleccionada).
  // En agregado nacional, el chart muestra tendencia simulada genérica.
  const trendKey = unit.geoKey || 'NACIONAL'

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      {/* Header de la ficha */}
      <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-inspi-navy to-inspi-navy-2 p-3 text-white">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-wider text-inspi-yellow">
              {ENT_LABEL[ent]}
            </div>
            <div className="truncate font-display text-base font-semibold">
              {unit.label}
            </div>
            {unit.sub && (
              <div className="text-[11px] text-slate-300">{unit.sub}</div>
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

      <KPICard
        rate={unit.data.rate}
        casos={unit.data.casos}
        muertes={unit.data.muertes}
        pob={unit.data.pob}
        disease={ent}
        limits={limits}
        real={unit.data._real}
      />

      <section>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Tendencia {YEARS[0]}–{YEARS[YEARS.length - 1]}
        </div>
        <TendenciaChart
          geoKey={trendKey}
          disease={ent}
          year={year}
          entData={entData}
          pobData={pobData}
        />
      </section>

      <section>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Determinantes (simulación)
        </div>
        <DeterminantesBars data={unit.data} />
      </section>
    </div>
  )
}
