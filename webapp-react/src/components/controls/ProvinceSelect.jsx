// ProvinceSelect — Combobox tipo type-ahead de las 24 provincias.
// Carga las provincias desde geoProv (cargado por useDataLoader) y delega
// la UX de filtrado/teclado a <SearchableSelect>.

import { useMemo } from 'react'
import { useStore } from '../../store'
import SearchableSelect from './SearchableSelect'

export default function ProvinceSelect() {
  const geoProv       = useStore(s => s.geoProv)
  const provFilter    = useStore(s => s.provFilter)
  const setProvFilter = useStore(s => s.setProvFilter)

  const options = useMemo(() => {
    if (!geoProv) return []
    return (geoProv.features || [])
      .map(f => {
        const p = f.properties || {}
        const code = String(p.DPA_PROVIN ?? p.dpa_provin ?? p.PROV_CODE ?? p.code ?? '').padStart(2, '0')
        const name = p.DPA_DESPRO ?? p.dpa_despro ?? p.NAME_1 ?? p.PROV_NAME ?? p.name ?? '—'
        return { value: code, label: name, secondary: code }
      })
      .filter(o => o.value && o.value !== '00')
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [geoProv])

  const loading = !geoProv

  return (
    <SearchableSelect
      value={provFilter || null}
      onChange={(v) => setProvFilter(v)}
      options={options}
      placeholder={loading ? 'Cargando provincias…' : `Buscar entre ${options.length} provincias…`}
      loading={loading}
      loadingText="— Cargando provincias… —"
      emptyText="Provincia no encontrada"
      clearLabel="Nacional (todas las provincias)"
    />
  )
}
