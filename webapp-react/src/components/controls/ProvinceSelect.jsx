// ProvinceSelect — Dropdown de las 24 provincias para zoom + dimming
// (parroquias fuera de la provincia se renderizan al 30% opacidad).
// Carga las provincias desde geoProv (cargado por useDataLoader).

import { useMemo } from 'react'
import { useStore } from '../../store'

export default function ProvinceSelect() {
  const geoProv     = useStore(s => s.geoProv)
  const provFilter  = useStore(s => s.provFilter)
  const setProvFilter = useStore(s => s.setProvFilter)

  const options = useMemo(() => {
    if (!geoProv) return []
    return (geoProv.features || [])
      .map(f => {
        const p = f.properties || {}
        return {
          code: String(p.DPA_PROVIN ?? p.dpa_provin ?? p.PROV_CODE ?? p.code ?? '').padStart(2, '0'),
          name: p.DPA_DESPRO ?? p.dpa_despro ?? p.NAME_1 ?? p.PROV_NAME ?? p.name ?? '—',
        }
      })
      .filter(o => o.code && o.code !== '00')
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [geoProv])

  // Mientras geoProv aún no carga (loading inicial) mostramos placeholder
  // neutral en vez de "0 provincias" — más honesto que un conteo vacío.
  const loading = !geoProv

  return (
    <select
      value={provFilter || ''}
      onChange={e => setProvFilter(e.target.value || null)}
      disabled={loading}
      className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 shadow-sm focus:border-inspi-navy focus:outline-none focus:ring-1 focus:ring-inspi-navy disabled:cursor-wait disabled:text-slate-400"
    >
      <option value="">
        {loading ? '— Cargando provincias… —' : `— Nacional (${options.length} provincias) —`}
      </option>
      {options.map(o => (
        <option key={o.code} value={o.code}>{o.name}</option>
      ))}
    </select>
  )
}
