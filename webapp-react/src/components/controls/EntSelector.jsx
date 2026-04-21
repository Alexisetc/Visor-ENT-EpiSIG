// EntSelector — 6 botones (Todas + 5 grupos Leonel Morales) con icono y código CIE-10.
// Reemplaza los .ent-btn del visor legacy. El estado vive en zustand (state.ent).

import { Layers, HeartPulse, Microscope, Atom, Wind, Brain } from 'lucide-react'
import { useStore } from '../../store'
import { ENT_COLOR } from '../../lib/colors'

const OPTIONS = [
  { id: 'todas',        label: 'Todas las ENT',  cie: '',          icon: Layers,     color: '#1a1b4a' },
  { id: 'circulatorio', label: 'Circulatorio',   cie: 'I00-I99',   icon: HeartPulse, color: ENT_COLOR.circulatorio },
  { id: 'neoplasia',    label: 'Neoplasias',     cie: 'C00-D48',   icon: Microscope, color: ENT_COLOR.neoplasia },
  { id: 'metabolica',   label: 'Metabólicas',    cie: 'E00-E90',   icon: Atom,       color: ENT_COLOR.metabolica },
  { id: 'respiratorio', label: 'Respiratorio',   cie: 'J00-J99',   icon: Wind,       color: ENT_COLOR.respiratorio },
  { id: 'nervioso',     label: 'Nervioso',       cie: 'G00-G99',   icon: Brain,      color: ENT_COLOR.nervioso },
]

export default function EntSelector() {
  const ent = useStore(s => s.ent)
  const setEnt = useStore(s => s.setEnt)

  return (
    <div className="space-y-1">
      {OPTIONS.map(o => {
        const active = ent === o.id
        const Icon = o.icon
        return (
          <button
            key={o.id}
            onClick={() => setEnt(o.id)}
            className={`flex w-full items-center gap-2 rounded border px-2.5 py-1.5 text-left text-xs transition ${
              active
                ? 'border-inspi-navy bg-inspi-navy text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            }`}
            style={active ? { borderLeft: `4px solid ${o.color}` } : undefined}
            title={`${o.label} ${o.cie}`}
          >
            <Icon size={14} className={active ? 'text-inspi-yellow' : ''} style={!active ? { color: o.color } : undefined} />
            <span className="font-medium">{o.label}</span>
            {o.cie && (
              <span className={`ml-auto font-mono text-[10px] ${active ? 'text-slate-300' : 'text-slate-400'}`}>
                {o.cie}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
