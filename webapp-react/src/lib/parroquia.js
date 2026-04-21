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
