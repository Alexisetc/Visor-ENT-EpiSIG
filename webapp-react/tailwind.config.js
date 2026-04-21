/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta institucional INSPI / EpiSIG
        inspi: {
          navy:    '#1a1b4a',     // header / titulares
          'navy-2':'#2a2c6e',
          yellow:  '#fbc400',     // acento / KPIs
          red:     '#ea1d2c',     // circulatorio / alerta
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
        sans: ['Inter', 'system-ui', 'Roboto', 'Arial', 'sans-serif'],
        display: ['Oswald', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'panel': '0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
      }
    },
  },
  plugins: [],
}
