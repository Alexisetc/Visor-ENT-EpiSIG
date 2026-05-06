// SearchableSelect — Combobox tipo "type-ahead" reutilizable.
//
// Reemplaza al <select> nativo y a las listas de botones cuando hay
// muchas opciones (24 provincias, N grupos ENT) y el usuario quiere
// poder filtrar escribiendo en lugar de hacer scroll visual.
//
// API:
//   <SearchableSelect
//     value={string|null}             // valor actualmente seleccionado
//     onChange={(value) => void}      // se llama con el value seleccionado o null al limpiar
//     options={[{                     // arreglo de opciones a mostrar
//       value: string,                // identificador único
//       label: string,                // texto principal (filtrable)
//       secondary?: string,           // texto secundario derecha (también filtrable, ej. CIE-10)
//       icon?: LucideIcon,            // ícono opcional a la izquierda
//       color?: string,               // color del ícono / borde activo
//     }]}
//     placeholder?: string            // texto del input cuando no hay selección
//     loading?: boolean               // muestra estado de carga + deshabilita
//     loadingText?: string
//     emptyText?: string              // texto cuando no hay matches del filtro
//     allowClear?: boolean            // si true, muestra botón "Limpiar" cuando hay value
//     clearLabel?: string             // texto de la opción "limpiar / sin filtro"
//   />
//
// Comportamiento:
//   - Click o focus en el input abre el panel.
//   - Escribir filtra opciones por label + secondary (case-insensitive, accent-insensitive).
//   - ↑/↓ navegan, Enter selecciona, Esc cierra, Tab cierra.
//   - Click fuera del componente cierra el panel.
//   - El input muestra el label del value actual cuando está cerrado y no se está editando.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, X, Check } from 'lucide-react'

// Normaliza para búsqueda: minúsculas + sin acentos
function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Seleccionar…',
  loading = false,
  loadingText = 'Cargando…',
  emptyText = 'Sin coincidencias',
  allowClear = true,
  clearLabel = '— Sin filtro —',
}) {
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const [highlight, setHighlight] = useState(0)
  const wrapperRef = useRef(null)
  const inputRef   = useRef(null)
  const listboxId  = useId()

  // Opción actualmente seleccionada (null si no hay)
  const selected = useMemo(
    () => options.find(o => o.value === value) || null,
    [options, value],
  )

  // Filtrado: si hay query, filtramos; si no, mostramos todas
  const filtered = useMemo(() => {
    if (!query.trim()) return options
    const q = norm(query)
    return options.filter(o =>
      norm(o.label).includes(q) || norm(o.secondary).includes(q),
    )
  }, [options, query])

  // Reset highlight cuando cambia la lista filtrada
  useEffect(() => { setHighlight(0) }, [query, open])

  // Click fuera → cerrar
  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (!wrapperRef.current?.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function commit(opt) {
    onChange(opt?.value ?? null)
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  function onKeyDown(e) {
    if (loading) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      setHighlight(h => Math.min(h + 1, Math.max(0, filtered.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (!open) return
      e.preventDefault()
      const opt = filtered[highlight]
      if (opt) commit(opt)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  // Lo que se muestra en el input: si está abierto y el usuario escribió,
  // mostramos el query; si no, el label del seleccionado o vacío.
  const displayValue = open ? query : (selected?.label ?? '')

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={displayValue}
          placeholder={loading ? loadingText : placeholder}
          disabled={loading}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
          onKeyDown={onKeyDown}
          className="w-full rounded border border-slate-200 bg-white py-1.5 pl-2 pr-12 text-xs text-slate-700 shadow-sm focus:border-inspi-navy focus:outline-none focus:ring-1 focus:ring-inspi-navy disabled:cursor-wait disabled:text-slate-400"
        />

        {/* Iconos a la derecha: limpiar (si hay selección) + chevron */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">
          {allowClear && selected && !loading && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); commit(null) }}
              className="mr-1 flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              title="Limpiar selección"
              aria-label="Limpiar selección"
            >
              <X size={14} strokeWidth={2.2} />
            </button>
          )}
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {open && !loading && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[600] mt-1 max-h-60 overflow-auto rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg"
        >
          {/* Opción "limpiar / sin filtro" siempre arriba si está habilitada */}
          {allowClear && (
            <li
              role="option"
              aria-selected={!selected}
              onMouseDown={e => { e.preventDefault(); commit(null) }}
              className={`flex cursor-pointer items-center gap-2 px-2 py-1.5 italic text-slate-500 hover:bg-slate-50 ${!selected ? 'bg-slate-50' : ''}`}
            >
              <span className="w-3.5" />
              <span className="flex-1">{clearLabel}</span>
              {!selected && <Check size={12} className="text-inspi-navy" />}
            </li>
          )}

          {filtered.length === 0 ? (
            <li className="px-2 py-2 text-center text-slate-400">{emptyText}</li>
          ) : (
            filtered.map((o, i) => {
              const Icon = o.icon
              const active = highlight === i
              const isSelected = o.value === value
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={e => { e.preventDefault(); commit(o) }}
                  className={`flex cursor-pointer items-center gap-2 px-2 py-1.5 ${active ? 'bg-inspi-navy/10' : 'hover:bg-slate-50'}`}
                >
                  {Icon ? (
                    <Icon size={13} style={{ color: o.color }} className="shrink-0" />
                  ) : (
                    <span className="w-3.5" />
                  )}
                  <span className="flex-1 truncate font-medium text-slate-700">{o.label}</span>
                  {o.secondary && (
                    <span className="font-mono text-[10px] text-slate-400">{o.secondary}</span>
                  )}
                  {isSelected && <Check size={12} className="text-inspi-navy" />}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
