// KPICard — Tasa por 100k hab + badge de prioridad relativa.
// El badge se calcula en función de en qué quintil cae la tasa actual.

import { LIMITS_SIM } from '../../lib/colors'

function priorityFromRate(rate, disease, limits) {
  const l = limits || LIMITS_SIM[disease] || LIMITS_SIM.todas
  if (rate > l[3]) return { label: 'CRÍTICA', color: '#a50f15' }
  if (rate > l[2]) return { label: 'ALTA',    color: '#ea1d2c' }
  if (rate > l[1]) return { label: 'MEDIA',   color: '#fbc400' }
  if (rate > l[0]) return { label: 'BAJA',    color: '#74c476' }
  return                     { label: 'MÍN.',    color: '#bdbdbd' }
}

export default function KPICard({ rate, casos, muertes, pob, disease, limits, real }) {
  const pri = priorityFromRate(rate, disease, limits)

  return (
    <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 shadow-sm">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Tasa estimada
          </div>
          <div className="font-display text-3xl font-bold leading-none text-inspi-navy">
            {Number.isFinite(rate) ? rate.toFixed(1) : '—'}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            por 100k hab. {real ? '· dato real' : '· simulación'}
          </div>
        </div>
        <div className="text-right">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Prioridad
          </div>
          <span
            className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm"
            style={{ background: pri.color }}
          >
            {pri.label}
          </span>
        </div>
      </div>

      {(casos > 0 || pob > 0) && (
        <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 text-center">
          <div>
            <div className="font-mono text-sm font-semibold text-slate-700">{casos.toLocaleString('es')}</div>
            <div className="text-[9px] uppercase text-slate-400">Casos</div>
          </div>
          <div>
            <div className="font-mono text-sm font-semibold text-slate-700">{muertes.toLocaleString('es')}</div>
            <div className="text-[9px] uppercase text-slate-400">Muertes</div>
          </div>
          <div>
            <div className="font-mono text-sm font-semibold text-slate-700">{pob.toLocaleString('es')}</div>
            <div className="text-[9px] uppercase text-slate-400">Pobl.</div>
          </div>
        </div>
      )}
    </div>
  )
}
