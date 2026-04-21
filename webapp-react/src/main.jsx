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
