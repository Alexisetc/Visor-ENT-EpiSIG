import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// IMPORTANTE: leaflet.css debe importarse antes de tailwind para que los
// utilities de tailwind no sobreescriban estilos críticos del mapa.
import 'leaflet/dist/leaflet.css'
import './styles/tailwind.css'

import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// === Service Worker para cachear datasets jsDelivr ===
// Solo en PROD (en dev queremos network siempre) y solo si el browser
// soporta SW. Beneficio: segunda visita carga datasets de disco en
// ~50ms en vez de re-bajar de jsDelivr.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('[EpiSIG] SW register falló:', err.message)
    })
  })
}
