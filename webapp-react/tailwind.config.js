/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // === Paleta institucional EpiSIG (Manual de Diseño v2) ===
        // Reglas: nada de gradientes decorativos. Solo el rojo de marca para
        // acción/alerta, el navy para estructura. Amber solo para "warning",
        // green solo para "positivo".
        inspi: {
          // Primarios — extraídos del logo
          navy:    '#14213D',     // chrome principal, headers, texto fuerte
          'navy-2':'#1E2D52',     // tono ligeramente más claro para gradientes muy puntuales
          red:     '#B81D24',     // ACENTO BRAND, acción, métricas críticas
          ink:     '#0E1729',     // texto base más fuerte
          // Neutros / utilitarios
          bone:    '#F5F2EC',     // off-white cálido (sidebar / fondos)
          paper:   '#FFFFFF',     // fondos de tarjetas
          'slate-50': '#F7F8FA',  // alterno
          line:    '#E2E5EB',     // bordes 1px
          muted:   '#6B7280',     // texto secundario
          // Semánticos
          amber:   '#C9981A',     // alertas / WIP / simulación
          green:   '#2E7D4F',     // positivo
          // === Legacy / data viz (NO usar como accent UI) ===
          surface: '#E6E8EB',     // legacy: aún referenciado en algunos sitios
          yellow:  '#fbc400',     // legacy data viz solamente
          purple:  '#756bb1',     // ENT neoplasia
          orange:  '#e88a2c',     // ENT metabolica
          gray:    '#6c7a89',     // ENT nervioso
        },
        // === Choropleth — gradiente rojo institucional (5 quintiles) ===
        // Reemplaza al YlOrRd legacy. Arranca en rosa cálido y termina en
        // borgoña profundo. Coherente con el rojo brand del logo.
        quintile: {
          q1: '#FBE6E7',
          q2: '#F4ABAF',
          q3: '#E5575E',
          q4: '#B81D24',
          q5: '#6E0F14',
        }
      },
      fontFamily: {
        // Manual: Montserrat (display + UI) y Roboto Mono (cifras/códigos)
        sans:    ['Montserrat', 'Inter', 'system-ui', 'Roboto', 'Arial', 'sans-serif'],
        display: ['Montserrat', 'Inter', 'sans-serif'],
        mono:    ['"Roboto Mono"', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        'panel': '0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
      }
    },
  },
  plugins: [],
}
