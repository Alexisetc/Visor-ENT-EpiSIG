// Cite — Marcador de citación estilo Vancouver (superíndice numérico).
//
// Uso:
//   <Cite n={1} href="https://..." title="Ver referencia 1" />
//
// Renderiza un <sup> clickeable que abre la referencia en una pestaña
// nueva. El número debería corresponder al ítem en la lista de
// "Referencias" del MetodologiaModal (cuando exista).

export default function Cite({ n, href, title }) {
  return (
    <sup className="ml-0.5">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={title || `Ver referencia ${n}`}
        className="font-semibold text-inspi-navy underline-offset-2 hover:text-amber-600 hover:underline"
      >
        {n}
      </a>
    </sup>
  )
}
