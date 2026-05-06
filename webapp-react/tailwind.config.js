/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta institucional EpiSIG · geoENT Ecuador
        // Hex exactos del manual de marca:
        //   - rojo  → ACENTO BRAND (reemplaza al yellow legacy)
        //   - navy  → chrome principal/secundario
        //   - muted/surface → grises de soporte
        inspi: {
          navy:    '#0B1D3A',     // chrome principal (header / footer)
          'navy-2':'#243A5E',     // chrome secundario / gradientes
          red:     '#D32F2F',     // ACENTO BRAND — usado donde antes iba yellow
          yellow:  '#fbc400',     // legacy: solo data viz (NO como accent UI)
          muted:   '#9AA3AE',     // texto de apoyo brand
          surface: '#E6E8EB',     // fondos suaves brand
          // ENT viz palette — encoda categoría de enfermedad, no es accent
          purple:  '#756bb1',     // neoplasia
          orange:  '#e88a2c',     // metabolica
          green:   '#31a354',     // respiratorio
          gray:    '#6c7a89',     // nervioso
        },
        // Gradiente quintiles (YlOrRd ColorBrewer 5)
        quintile: {
          q1: '#fef0d9',
          q2: '#fdcc8a',
          q3: '#fc8d59',
          q4: '#e34a33',
          q5: '#b30000',
        }
      },
      fontFamily: {
        // Manual de marca: Montserrat SemiBold (títulos) + Regular (textos)
        sans:    ['Montserrat', 'Inter', 'system-ui', 'Roboto', 'Arial', 'sans-serif'],
        display: ['Montserrat', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'panel': '0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
      }
    },
  },
  plugins: [],
}
