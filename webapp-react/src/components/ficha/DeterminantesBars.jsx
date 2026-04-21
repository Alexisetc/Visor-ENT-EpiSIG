// DeterminantesBars — 6 progress bars con los determinantes de la parroquia.
// En Sprint 2 lee del fallback simulado dentro de generateData (tabaco/fis/obe/pm25);
// en Sprint 3 se enchufa al detData real (7 determinantes).

const ITEMS = [
  { id: 'tabaco',   label: 'Tabaco',       max: 30,  color: '#a50f15', unit: '%' },
  { id: 'fisica',   label: 'Sedentarismo', max: 70,  color: '#fbc400', unit: '%' },
  { id: 'obesidad', label: 'Obesidad',     max: 60,  color: '#ea1d2c', unit: '%' },
  { id: 'pm25',     label: 'PM2.5',        max: 80,  color: '#7f8c8d', unit: 'µg/m³' },
]

export default function DeterminantesBars({ data }) {
  if (!data) return null
  return (
    <div className="space-y-1.5">
      {ITEMS.map(it => {
        const v = Number(data[it.id] ?? 0)
        const pct = Math.min(100, (v / it.max) * 100)
        return (
          <div key={it.id}>
            <div className="mb-0.5 flex items-center justify-between text-[11px]">
              <span className="text-slate-600">{it.label}</span>
              <span className="font-mono font-semibold text-slate-700">{v}{it.unit === '%' ? '%' : ` ${it.unit}`}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, background: it.color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
