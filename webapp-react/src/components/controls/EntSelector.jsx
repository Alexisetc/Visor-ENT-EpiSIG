// EntSelector — Combobox type-ahead de los grupos ENT.
//
// Restaurado al SearchableSelect: el usuario puede escribir parte del
// nombre o del código CIE-10 (ej. "circ", "I00", "neop") y filtra al
// vuelo. "Todas las ENT" actúa como opción "limpiar / sin filtro" en
// cursiva al tope, separada del resto.
//
// El estado `ent` en zustand siempre tiene un valor (default 'todas'),
// por eso mapeamos: null ↔ 'todas' al puentear con SearchableSelect.

import { useStore } from '../../store'
import SearchableSelect from './SearchableSelect'

const OPTIONS = [
  { value: 'circulatorio', label: 'Circulatorio',   secondary: 'I00-I99' },
  { value: 'neoplasia',    label: 'Neoplasias',     secondary: 'C00-D48' },
  { value: 'metabolica',   label: 'Metabólicas',    secondary: 'E00-E90' },
  { value: 'respiratorio', label: 'Respiratorio',   secondary: 'J00-J99' },
  { value: 'nervioso',     label: 'Nervioso',       secondary: 'G00-G99' },
]

export default function EntSelector() {
  const ent    = useStore(s => s.ent)
  const setEnt = useStore(s => s.setEnt)

  return (
    <SearchableSelect
      value={ent === 'todas' ? null : ent}
      onChange={(v) => setEnt(v ?? 'todas')}
      options={OPTIONS}
      placeholder={`Buscar entre ${OPTIONS.length} grupos ENT…`}
      emptyText="Grupo ENT no encontrado"
      clearLabel="Todas las ENT"
    />
  )
}
