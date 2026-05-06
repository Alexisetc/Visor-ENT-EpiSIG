// mapDefaults — Vista nacional por defecto para Ecuador continental.
//
// Estos valores son la fuente única de verdad para:
//   - Vista inicial al cargar la app (MapView.jsx · MapContainer)
//   - Botón "Restablecer" / Home (ZoomControls.jsx)
//   - Reset al deseleccionar provincia (MapView.jsx · FitToProvince)
//
// Cambiar acá actualiza los tres lugares a la vez.

export const DEFAULT_CENTER = [-1.6, -78.3]
export const DEFAULT_ZOOM   = 7
