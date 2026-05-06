// Helpers de identificación de parroquias — portado desde Visualizador ENT.html
// Clave estable: código DPA parroquial (6 dígitos con padding) o nombre fallback.

export function getParroquiaKey(props) {
  if (!props) return 'NACIONAL'
  const code = (props.DPA_PARROQ != null && String(props.DPA_PARROQ).trim()) || ''
  if (code) return String(code).padStart(6, '0')
  return (props.DPA_DESPAR || props.name || 'NACIONAL').toString()
}

export function getParroquiaLabel(props) {
  if (!props) return 'Nacional (Ecuador)'
  const par  = props.DPA_DESPAR || props.name || '—'
  const can  = props.DPA_DESCAN || ''
  const prov = props.DPA_DESPRO || ''
  if (can && prov) return `${par} · ${can} · ${prov}`
  if (can) return `${par} · ${can}`
  return par
}

// Versión corta para títulos cuando la provincia ya aparece en otro
// elemento UI (subtítulo del header, badge, etc.) — evita repetir.
//   "SALINAS · GUARANDA"   en vez de   "SALINAS · GUARANDA · BOLÍVAR"
export function getParroquiaLabelShort(props) {
  if (!props) return 'Nacional (Ecuador)'
  const par = props.DPA_DESPAR || props.name || '—'
  const can = props.DPA_DESCAN || ''
  return can ? `${par} · ${can}` : par
}

export function getParroquiaProvKey(props) {
  if (!props) return null
  const code = props.DPA_PARROQ != null ? String(props.DPA_PARROQ).padStart(6, '0') : ''
  return code ? code.slice(0, 2) : (props.DPA_PROVIN ? String(props.DPA_PROVIN).padStart(2, '0') : null)
}

// PRNG determinístico (seed → 0..1) — para fallback de determinantes pseudoaleatorios
export function pseudoRandom(seed) {
  const x = Math.sin(seed++) * 10000
  return x - Math.floor(x)
}

// Resuelve el nombre de provincia (ej. "Bolivar") a partir de su código DPA
// ("02") consultando el GeoJSON de provincias. Devuelve el código si no
// encuentra match — fallback seguro para que la UI no quede vacía.
export function getProvLabel(provCode, geoProv) {
  if (!provCode) return null
  if (!geoProv?.features) return provCode
  for (const f of geoProv.features) {
    const p = f.properties || {}
    const code = String(p.DPA_PROVIN ?? p.dpa_provin ?? p.PROV_CODE ?? p.code ?? '').padStart(2, '0')
    if (code === provCode) {
      return p.DPA_DESPRO ?? p.dpa_despro ?? p.NAME_1 ?? p.PROV_NAME ?? p.name ?? provCode
    }
  }
  return provCode
}
