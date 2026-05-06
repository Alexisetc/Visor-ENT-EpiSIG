// EpiLogo — Logo institucional EpiSIG en SVG inline.
//
// Reproduce el lockup oficial del Brand Sheet v1.0 (EPS-BR-001):
//
//   ▸ Isotipo: matriz roja a la izquierda (bar-chart cluster) + matriz
//     navy a la derecha (segmentos verticales) + eje vertical con
//     flecha hacia arriba en el centro. Encarna la idea de
//     análisis epidemiológico territorial (datos + crecimiento).
//
//   ▸ Wordmark: "E" + "PI" en rojo, "SIG" en navy. Tipografía Optima
//     con fallback a humanist-sans del sistema.
//
//   ▸ Línea horizontal con flecha bajo el wordmark (eje X).
//
//   ▸ Barra vertical roja a la derecha (cierre, eco del isotipo).
//
// Props:
//   - width  → ancho en px (alto se calcula proporcional al viewBox 559×143).
//   - mono   → si true, dibuja todo en blanco (para fondos navy oscuros).

const RED  = '#B01A24'
const BLUE = '#232C57'
const AXIS = '#3D3E3D'

export default function EpiLogo({ width = 130, mono = false }) {
  const red  = mono ? '#FFFFFF' : RED
  const blue = mono ? '#FFFFFF' : BLUE
  const axis = mono ? '#FFFFFF' : AXIS

  // Tipografía del wordmark — Optima con fallback humanist (idéntica
  // al brand sheet original). Si no hay Optima en el sistema, los
  // fallbacks aproximan razonablemente la forma.
  const wordmarkFont =
    'Optima, "Optima LT Std", Candara, "Segoe UI", "Helvetica Neue", Arial, sans-serif'

  return (
    <svg
      viewBox="0 0 559 143"
      width={width}
      style={{ display: 'block' }}
      role="img"
      aria-label="EpiSIG"
    >
      {/* === ISOTIPO (matriz + eje vertical con flecha) === */}
      <g shapeRendering="crispEdges">
        {/* Bloque ROJO izquierdo — barras horizontales escalonadas */}
        <rect x="45.7" y="24.1" width="25.7" height="17.1" fill={red} />
        <rect x="33.9" y="43.1" width="37.5" height="17.1" fill={red} />
        <rect x="28.0" y="62.0" width="43.4" height="17.1" fill={red} />
        <rect x="31.1" y="81.0" width="40.3" height="17.1" fill={red} />
        <rect x="51.0" y="100.0" width="20.4" height="17.1" fill={red} />
        <rect x="48.0" y="119.0" width="25.6" height="17.1" fill={red} />

        {/* Bloque ROJO izquierdo — píxeles satélite */}
        <rect x="18.0" y="24.0"  width="9.0" height="8.2" fill={red} />
        <rect x="36.0" y="24.0"  width="8.4" height="8.2" fill={red} />
        <rect x="27.0" y="33.1"  width="9.0" height="8.2" fill={red} />
        <rect x="15.0" y="43.1"  width="9.0" height="8.2" fill={red} />
        <rect x="24.0" y="52.0"  width="9.0" height="8.2" fill={red} />
        <rect x="18.0" y="62.0"  width="9.0" height="8.2" fill={red} />
        <rect x="9.0"  y="71.0"  width="9.0" height="8.2" fill={red} />
        <rect x="22.0" y="81.0"  width="8.4" height="8.2" fill={red} />
        <rect x="13.0" y="90.0"  width="8.4" height="8.2" fill={red} />
        <rect x="33.0" y="100.0" width="8.4" height="8.2" fill={red} />
        <rect x="42.0" y="108.1" width="8.4" height="9.0" fill={red} />
        <rect x="38.0" y="119.0" width="8.4" height="8.2" fill={red} />
        <rect x="29.0" y="127.0" width="9.0" height="8.2" fill={red} />

        {/* Bloque NAVY derecho — barras horizontales decrecientes */}
        <rect x="73.9" y="24.1"  width="26.1" height="17.1" fill={blue} />
        <rect x="73.9" y="43.1"  width="61.2" height="17.1" fill={blue} />
        <rect x="73.9" y="62.0"  width="57.0" height="17.1" fill={blue} />
        <rect x="73.9" y="81.0"  width="47.4" height="17.1" fill={blue} />
        <rect x="73.9" y="100.0" width="16.2" height="17.1" fill={blue} />
        <rect x="73.0" y="119.0" width="7.2"  height="17.1" fill={blue} />
      </g>

      {/* Eje vertical central + flecha hacia arriba */}
      <g shapeRendering="geometricPrecision">
        <line x1="72" y1="23" x2="72" y2="119" stroke={axis} strokeWidth="2.15" />
        <polygon points="72,13 64,23 80,23" fill={axis} />
      </g>

      {/* === EJE HORIZONTAL bajo el wordmark + flecha derecha === */}
      <g shapeRendering="geometricPrecision">
        <line x1="73" y1="118" x2="450" y2="118" stroke={axis} strokeWidth="3.15" />
        <polygon points="460,118 448,108 448,128" fill={axis} />
      </g>

      {/* === WORDMARK: E + PI (rojo) · SIG (navy) === */}
      <g
        style={{ fontFamily: wordmarkFont, fontWeight: 400, paintOrder: 'stroke fill' }}
      >
        <text x="140" y="108" fontSize="114" fill={red}  stroke={red}  strokeWidth="1.6">E</text>
        <text x="210" y="108" fontSize="92"  fill={red}  stroke={red}  strokeWidth="1.2" letterSpacing="1">PI</text>
        <text x="288" y="108" fontSize="115" fill={blue} stroke={blue} strokeWidth="1.1">SIG</text>
      </g>

      {/* Barra roja vertical a la derecha (cierre del lockup) */}
      <rect x="475" y="13" width="9" height="123" fill={red} />
    </svg>
  )
}
