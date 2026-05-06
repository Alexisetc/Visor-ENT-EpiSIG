// EntSelector — Combobox type-ahead de los 5 grupos Leonel Morales + "Todas las ENT".
//
// Antes era una columna de 6 botones grandes; ahora es un solo input
// filtrable (mismo patrón que ProvinceSelect) para liberar espacio
// vertical en la sidebar y permitir buscar escribiendo.
//
// El estado `ent` en zustand siempre tiene un valor (default 'todas'),
// por eso allowClear={false}: "Todas las ENT" cumple el rol de
// "sin filtro de grupo".

import { Layers, HeartPulse, Microscope, Atom, Wind, Brain } from 'lucide-react'
import { useStore } from '../../store'
import { ENT_COLOR } from '../../lib/colors'
import SearchableSelect from './SearchableSelect'

const OPTIONS = [
  { value: 'todas',        label: 'Todas las ENT',  secondary: '',          icon: Layers,     color: '#1a1b4a' },
  { value: 'circulatorio', label: 'Circulatorio',   secondary: 'I00-I99',   icon: HeartPulse, color: ENT_COLOR.circulatorio },
  { value: 'neoplasia',    label: 'Neoplasias',     secondary: 'C00-D48',   icon: Microscope, color: ENT_COLOR.neoplasia },
  { value: 'metabolica',   label: 'Metabólicas',    secondary: 'E00-E90',   icon: Atom,       color: ENT_COLOR.metabolica },
  { value: 'respiratorio', label: 'Respiratorio',   secondary: 'J00-J99',   icon: Wind,       color: ENT_COLOR.respiratorio },
  { value: 'nervioso',     label: 'Nervioso',       secondary: 'G00-G99',   icon: Brain,      color: ENT_COLOR.nervioso },
]

export default function EntSelector() {
  const ent    = useStore(s => s.ent)
  const setEnt = useStore(s => s.setEnt)

  return (
    <SearchableSelect
      value={ent}
      onChange={(v) => setEnt(v ?? 'todas')}
      options={OPTIONS}
      placeholder="Buscar grupo ENT o CIE-10…"
      allowClear={false}
      emptyText="Grupo ENT no encontrado"
    />
  )
}
