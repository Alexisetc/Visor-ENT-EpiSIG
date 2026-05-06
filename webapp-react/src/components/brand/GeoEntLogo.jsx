// GeoEntLogo — Logo institucional geoENT en SVG inline.
// Reproduce el logo final aprobado (03 · Tejido espacial):
//   - Iso a la izquierda: matrix 5×5 con quintiles rojos institucionales,
//     contigüidad rook (sólida) + queen (punteada), nodo focal con halo KDE.
//   - Wordmark "geoENT": "geo" en rojo light + "ENT" en navy bold.
//   - Flecha bajo el wordmark.
//   - Tagline "VISOR DE INVESTIGACIÓN" en muted con tracking ancho.
//   - Barra roja vertical a la derecha (cierre).
//
// Props:
//   - width  → ancho en px (alto se calcula proporcional al viewBox 720×230).
//   - showTagline → si false, oculta "VISOR DE INVESTIGACIÓN" (versión compacta).

export default function GeoEntLogo({ width = 280, showTagline = true }) {
  return (
    <svg
      viewBox={showTagline ? '0 0 720 230' : '0 0 720 200'}
      width={width}
      style={{ display: 'block' }}
      role="img"
      aria-label="geoENT — Visor de Investigación"
    >
      {/* ─── ISOTYPE: matrix 5×5 ─── */}
      <g transform="translate(28, 32)">
        {/* Background grid */}
        <g stroke="#CBD5E1" strokeWidth="0.4" fill="none">
          <line x1="0"   y1="0"   x2="170" y2="0"/>
          <line x1="0"   y1="34"  x2="170" y2="34"/>
          <line x1="0"   y1="68"  x2="170" y2="68"/>
          <line x1="0"   y1="102" x2="170" y2="102"/>
          <line x1="0"   y1="136" x2="170" y2="136"/>
          <line x1="0"   y1="170" x2="170" y2="170"/>
          <line x1="0"   y1="0"   x2="0"   y2="170"/>
          <line x1="34"  y1="0"   x2="34"  y2="170"/>
          <line x1="68"  y1="0"   x2="68"  y2="170"/>
          <line x1="102" y1="0"   x2="102" y2="170"/>
          <line x1="136" y1="0"   x2="136" y2="170"/>
          <line x1="170" y1="0"   x2="170" y2="170"/>
        </g>

        {/* 25 cells with quintile gradient (radial autocorrelation) */}
        <g>
          <rect x="2"   y="2"   width="30" height="30" fill="#FBE6E7"/>
          <rect x="36"  y="2"   width="30" height="30" fill="#FBE6E7"/>
          <rect x="70"  y="2"   width="30" height="30" fill="#F4ABAF"/>
          <rect x="104" y="2"   width="30" height="30" fill="#FBE6E7"/>
          <rect x="138" y="2"   width="30" height="30" fill="#FBE6E7"/>
          <rect x="2"   y="36"  width="30" height="30" fill="#FBE6E7"/>
          <rect x="36"  y="36"  width="30" height="30" fill="#F4ABAF"/>
          <rect x="70"  y="36"  width="30" height="30" fill="#E5575E"/>
          <rect x="104" y="36"  width="30" height="30" fill="#F4ABAF"/>
          <rect x="138" y="36"  width="30" height="30" fill="#FBE6E7"/>
          <rect x="2"   y="70"  width="30" height="30" fill="#F4ABAF"/>
          <rect x="36"  y="70"  width="30" height="30" fill="#E5575E"/>
          <rect x="70"  y="70"  width="30" height="30" fill="#B81D24"/>
          <rect x="104" y="70"  width="30" height="30" fill="#E5575E"/>
          <rect x="138" y="70"  width="30" height="30" fill="#F4ABAF"/>
          <rect x="2"   y="104" width="30" height="30" fill="#FBE6E7"/>
          <rect x="36"  y="104" width="30" height="30" fill="#F4ABAF"/>
          <rect x="70"  y="104" width="30" height="30" fill="#E5575E"/>
          <rect x="104" y="104" width="30" height="30" fill="#F4ABAF"/>
          <rect x="138" y="104" width="30" height="30" fill="#FBE6E7"/>
          <rect x="2"   y="138" width="30" height="30" fill="#FBE6E7"/>
          <rect x="36"  y="138" width="30" height="30" fill="#FBE6E7"/>
          <rect x="70"  y="138" width="30" height="30" fill="#F4ABAF"/>
          <rect x="104" y="138" width="30" height="30" fill="#FBE6E7"/>
          <rect x="138" y="138" width="30" height="30" fill="#FBE6E7"/>
        </g>

        {/* White cell separators */}
        <g stroke="#FFFFFF" strokeWidth="1.4" fill="none">
          <rect x="2" y="2" width="166" height="166"/>
          <line x1="36"  y1="2" x2="36"  y2="168"/>
          <line x1="70"  y1="2" x2="70"  y2="168"/>
          <line x1="104" y1="2" x2="104" y2="168"/>
          <line x1="138" y1="2" x2="138" y2="168"/>
          <line x1="2" y1="36"  x2="168" y2="36"/>
          <line x1="2" y1="70"  x2="168" y2="70"/>
          <line x1="2" y1="104" x2="168" y2="104"/>
          <line x1="2" y1="138" x2="168" y2="138"/>
        </g>

        {/* Rook contiguity (solid) + Queen (dashed) */}
        <g stroke="#0B1D3A" strokeWidth="1.3" opacity="0.9">
          <line x1="85" y1="51" x2="85" y2="70"/>
          <line x1="100" y1="85" x2="119" y2="85"/>
          <line x1="85" y1="100" x2="85" y2="119"/>
          <line x1="51" y1="85" x2="70" y2="85"/>
        </g>
        <g stroke="#0B1D3A" strokeWidth="0.8" opacity="0.5" strokeDasharray="2 2">
          <line x1="98" y1="72" x2="119" y2="51"/>
          <line x1="72" y1="98" x2="51" y2="119"/>
          <line x1="98" y1="98" x2="119" y2="119"/>
          <line x1="72" y1="72" x2="51" y2="51"/>
        </g>

        {/* Connected nodes */}
        <g fill="#0B1D3A">
          <circle cx="85" cy="51"  r="3"/>
          <circle cx="119" cy="85" r="3"/>
          <circle cx="85" cy="119" r="3"/>
          <circle cx="51" cy="85"  r="3"/>
        </g>
        <g fill="#0B1D3A" opacity="0.5">
          <circle cx="119" cy="51"  r="2.2"/>
          <circle cx="51"  cy="119" r="2.2"/>
          <circle cx="119" cy="119" r="2.2"/>
          <circle cx="51"  cy="51"  r="2.2"/>
        </g>

        {/* Focal red node + halo (KDE pulse) */}
        <circle cx="85" cy="85" r="13" fill="none" stroke="#D32F2F" strokeWidth="0.8" opacity="0.45"/>
        <circle cx="85" cy="85" r="9" fill="#D32F2F"/>
        <circle cx="85" cy="85" r="3" fill="#FFFFFF"/>

        {/* Coordinate ticks (Ecuador bbox) */}
        <text x="0"   y="-5"  fontFamily="Roboto Mono, monospace" fontSize="6" fill="#64748B" letterSpacing="0.5">0°N</text>
        <text x="170" y="-5"  fontFamily="Roboto Mono, monospace" fontSize="6" fill="#64748B" letterSpacing="0.5" textAnchor="end">81°W</text>
        <text x="0"   y="182" fontFamily="Roboto Mono, monospace" fontSize="6" fill="#64748B" letterSpacing="0.5">5°S</text>
        <text x="170" y="182" fontFamily="Roboto Mono, monospace" fontSize="6" fill="#64748B" letterSpacing="0.5" textAnchor="end">75°W</text>
      </g>

      {/* ─── WORDMARK ─── */}
      <g fontFamily="Montserrat, sans-serif">
        <text x="246" y="138" fontSize="76" fontWeight="500" fill="#D32F2F" letterSpacing="-3">geo</text>
        <text x="372" y="138" fontSize="76" fontWeight="800" fill="#0B1D3A" letterSpacing="-1.8">ENT</text>
      </g>

      {/* ─── ARROW under wordmark ─── */}
      <g stroke="#0B1D3A" strokeWidth="1.2" fill="none">
        <line x1="246" y1="170" x2="600" y2="170"/>
        <polyline points="594,165 600,170 594,175" strokeLinejoin="round" strokeLinecap="round"/>
      </g>

      {/* ─── TAGLINE ─── */}
      {showTagline && (
        <text x="246" y="194" fontFamily="Montserrat, sans-serif"
              fontSize="12" fontWeight="600" fill="#475569" letterSpacing="6">
          VISOR  DE  INVESTIGACIÓN
        </text>
      )}

      {/* ─── CLOSING BAR (right only) ─── */}
      <rect x="612" y="40" width="3" height="150" fill="#D32F2F"/>
    </svg>
  )
}
