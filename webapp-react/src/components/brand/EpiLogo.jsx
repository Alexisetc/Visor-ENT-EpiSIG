// EpiLogo — Logo institucional EpiSIG en SVG inline.
//
// Reproduce el wordmark "EpiSIG" del manual de marca:
//   - Iso a la izquierda: ejes (X horizontal + Y vertical) con flechas,
//     bar-chart cluster en rojo + barras en navy superpuestas.
//   - Wordmark "EpiSIG": E navy, p navy/rojo, i rojo, S/I/G navy.
//   - Barra roja vertical a la derecha (acento brand).
//
// Props:
//   - width  → ancho en px (alto se calcula proporcional al viewBox 320×70).
//   - mono   → si true, dibuja todo en blanco (para fondos navy).

export default function EpiLogo({ width = 130, mono = false }) {
  const navy = mono ? '#FFFFFF' : '#14213D'
  const red  = mono ? '#FFFFFF' : '#B81D24'
  return (
    <svg
      viewBox="0 0 320 70"
      width={width}
      style={{ display: 'block' }}
      role="img"
      aria-label="EpiSIG"
    >
      <g transform="translate(2,4)">
        {/* Ejes del isotipo (X y Y con flechas) */}
        <path d="M 0 60 L 60 60" stroke={navy} strokeWidth="1.5" fill="none" />
        <path d="M 56 56 L 60 60 L 56 64" stroke={navy} strokeWidth="1.5" fill="none" />
        <path d="M 6 60 L 6 4"  stroke={navy} strokeWidth="1.5" fill="none" />
        <path d="M 2 8 L 6 4 L 10 8" stroke={navy} strokeWidth="1.5" fill="none" />

        {/* Barras rojas (chart-bar cluster) */}
        <g fill={red}>
          <rect x="10" y="42" width="6" height="14" />
          <rect x="18" y="36" width="6" height="20" />
          <rect x="26" y="30" width="6" height="26" />
          <rect x="10" y="32" width="6" height="6"  />
          <rect x="18" y="22" width="6" height="10" />
          <rect x="26" y="14" width="6" height="12" />
          <rect x="34" y="22" width="6" height="34" />
          <rect x="34" y="14" width="6" height="6"  />
        </g>

        {/* Barras navy superpuestas */}
        <g fill={navy}>
          <rect x="42" y="38" width="6" height="18" />
          <rect x="42" y="28" width="6" height="6"  />
          <rect x="50" y="44" width="6" height="12" />
          <rect x="50" y="32" width="6" height="8"  />
        </g>
      </g>

      {/* Wordmark "EpiSIG" con split de color */}
      <g fontFamily="Montserrat, sans-serif" fontWeight="800">
        <text x="78"  y="50" fontSize="44" fill={navy}>E</text>
        <text x="106" y="50" fontSize="44" fill={red}>p</text>
        <text x="132" y="50" fontSize="44" fill={red}>i</text>
        <text x="146" y="50" fontSize="44" fill={navy}>S</text>
        <text x="174" y="50" fontSize="44" fill={navy}>I</text>
        <text x="190" y="50" fontSize="44" fill={navy}>G</text>
      </g>

      {/* Barra roja vertical a la derecha (acento brand) */}
      <rect x="234" y="6" width="3" height="58" fill={red} />
    </svg>
  )
}
