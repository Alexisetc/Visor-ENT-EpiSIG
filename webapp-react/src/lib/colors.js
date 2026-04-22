// Paletas y mapeos de ENT — portado 1:1 desde Visualizador ENT.html
// Clasificación Leonel Morales (CIE-10):
//   circulatorio I00-I99 · neoplasia C00-D48 · metabolica E00-E90
//   respiratorio J00-J99 · nervioso G00-G99

export const ENT_COLOR = {
  circulatorio: '#ea1d2c',
  neoplasia:    '#756bb1',
  metabolica:   '#e88a2c',
  respiratorio: '#31a354',
  nervioso:     '#6c7a89',
}

export const ENT_LABEL = {
  todas:        'Todas',
  circulatorio: 'Circulatorio',
  neoplasia:    'Neoplasias',
  metabolica:   'Metabólica',
  respiratorio: 'Respiratorio',
  nervioso:     'Nervioso',
}

export const DET_LABEL = {
  pobreza:         'Pobreza',
  nbi:             'NBI',
  pm25:            'PM2.5',
  tabaquismo:      'Tabaquismo',
  obesidad:        'Obesidad',
  sedentarismo:    'Sedentarismo',
  acceso_salud_km: 'Acceso a salud',
}

// Mapeo selector → estructura del JSON real ent_parroquial.json
export const ENT_MAP = {
  todas:        { type: '__sum_grupos__', key: null },
  circulatorio: { type: 'grupos', key: 'circulatorio' },
  neoplasia:    { type: 'grupos', key: 'neoplasia' },
  metabolica:   { type: 'grupos', key: 'metabolica' },
  respiratorio: { type: 'grupos', key: 'respiratorio' },
  nervioso:     { type: 'grupos', key: 'nervioso' },
}

// Escalas de coropleta por ENT (5-stop ColorBrewer)
export const colorScales = {
  todas:        ['#eef0f8','#9ba0d6','#5a5fb8','#2c2d8f','#1a1b4a'],
  circulatorio: ['#fee5d9','#fcae91','#fb6a4a','#de2d26','#a50f15'],
  neoplasia:    ['#f2f0f7','#cbc9e2','#9e9ac8','#756bb1','#54278f'],
  metabolica:   ['#feedde','#fdbe85','#fd8d3c','#e6550d','#a63603'],
  respiratorio: ['#edf8e9','#bae4b3','#74c476','#31a354','#006d2c'],
  nervioso:     ['#f0f0f0','#cccccc','#969696','#636363','#252525'],
}

// KDE qgis2web YlOrRd 9-stop (replica "Hot Spot OVITRAMPAS Pacto 2020") — legacy
export const GRADIENT_QGIS = {
  0.0:  '#fff5f0',
  0.01: '#fcbba1',
  0.1:  '#fc9272',
  0.2:  '#fb6a4a',
  0.4:  '#ef3b2c',
  0.6:  '#cb181d',
  0.8:  '#a50f15',
  1.0:  '#67000d',
}

// ===== Hot-Spot bipolar (Gi*-style / LISA) =====
// Escala diverging ColorBrewer RdBu invertida — azul para cold-spots
// (valores muy por debajo de la media), rojo para hot-spots (muy por encima),
// blanco para parroquias cercanas a la media. 9 stops para transición suave.
// Usar con z-score estandarizado: z < -2 → azul oscuro; z > +2 → rojo oscuro.
export const HOTSPOT_BIPOLAR = [
  '#053061', // z ≤ -2.5 · cold-spot muy fuerte
  '#2166ac', // z ≈ -2   · cold-spot fuerte
  '#4393c3', // z ≈ -1.5 · cold-spot moderado
  '#92c5de', // z ≈ -1   · cold-spot leve
  '#f7f7f7', // z ≈  0   · cerca de la media (neutral)
  '#f4a582', // z ≈ +1   · hot-spot leve
  '#d6604d', // z ≈ +1.5 · hot-spot moderado
  '#b2182b', // z ≈ +2   · hot-spot fuerte
  '#67001f', // z ≥ +2.5 · hot-spot muy fuerte
]

// Breaks del z-score (para asignar cada valor a un stop del array HOTSPOT_BIPOLAR)
export const HOTSPOT_BREAKS = [-2.5, -2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5]
// Regla: stop[0] si z ≤ breaks[0], stop[i] si breaks[i-1] < z ≤ breaks[i],
// stop[breaks.length-1] si z > breaks[últ]. (10 breaks → 9 stops.)

// ===== Turbo colormap (Mikhailov 2019) — fallback perceptualmente uniforme =====
// No se usa en hot-spot principal pero queda disponible si se necesita un
// gradient unipolar multicolor (p. ej. para visualización "densidad" alt).
export const TURBO = [
  '#30123b','#4777ef','#1ae4b6','#a4fc3c','#fabb39','#e83317','#7a0403',
]

// ===== Paleta categórica por determinante =====
// Se usa en DeterminantesLayer cuando el mapa colorea por "determinante
// dominante" (mayor |β| MGWR) por parroquia. Colores distintos entre sí
// para que el usuario identifique cada determinante con un vistazo.
export const DET_COLOR = {
  pobreza:         '#a50f15', // rojo oscuro — carga social fuerte
  nbi:             '#de2d26', // rojo — necesidades básicas insatisfechas
  pm25:            '#374151', // gris carbón — contaminación aire
  tabaquismo:      '#8c564b', // marrón — tabaco
  obesidad:        '#ea1d2c', // rojo vivo — obesidad
  sedentarismo:    '#fbc400', // amarillo — sedentarismo
  acceso_salud_km: '#3b82f6', // azul — acceso/distancia al servicio
}

// Límites simulados de quintiles por ENT (fallback cuando no hay ENT_DATA)
export const LIMITS_SIM = {
  todas:        [300, 450, 600, 800],
  circulatorio: [150, 190, 230, 270],
  neoplasia:    [ 70,  95, 120, 145],
  metabolica:   [100, 130, 160, 190],
  respiratorio: [ 50,  70,  90, 110],
  nervioso:     [ 30,  50,  70,  90],
}

// Lista ordenada de las 5 ENT (sin "todas") — para iterar en MCDA, MGWR, etc.
export const ENTS = ['circulatorio', 'neoplasia', 'metabolica', 'respiratorio', 'nervioso']

// Lista ordenada de los 6 determinantes MGWR (los que modela MGWR)
export const DETS = ['pobreza', 'pm25', 'sedentarismo', 'acceso_salud_km', 'obesidad', 'tabaquismo']

// Lista completa de 7 determinantes parroquiales (incluye NBI — no-MGWR)
export const DETS_FULL = ['pobreza', 'nbi', 'pm25', 'tabaquismo', 'obesidad', 'sedentarismo', 'acceso_salud_km']
