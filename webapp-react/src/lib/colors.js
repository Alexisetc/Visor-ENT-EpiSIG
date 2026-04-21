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
  pm25:            'PM2.5',
  sedentarismo:    'Sedentarismo',
  acceso_salud_km: 'Acceso a salud',
  obesidad:        'Obesidad',
  tabaquismo:      'Tabaquismo',
  nbi:             'NBI',
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

// KDE qgis2web YlOrRd 9-stop (replica "Hot Spot OVITRAMPAS Pacto 2020")
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

// Lista ordenada de los 6 determinantes
export const DETS = ['pobreza', 'pm25', 'sedentarismo', 'acceso_salud_km', 'obesidad', 'tabaquismo']
