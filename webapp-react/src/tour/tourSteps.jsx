// Guion del recorrido guiado de geoENT (7 paradas).
// Cada paso apunta a un contenedor estable (data-tour) y expone before(): el
// controlador lo invoca con un unico onHighlightStarted global ANTES de resaltar,
// para conducir el store al estado que ilustra. autoMs controla el auto-avance.

export const DEMO_DPA = '170150' // Inaquito (Quito): parroquia urbana representativa

const BADGE = '<span class="episig-tour__badge">Simulacion - ilustrativo</span>'

function projectCard(text) {
  return (
    '<div class="episig-tour__proj">' +
    '<div class="episig-tour__proj-label">Proyecto asociado</div>' +
    '<div class="episig-tour__proj-name">' + text + '</div></div>'
  )
}

// Construye los pasos enlazados al store zustand (se pasa el objeto useStore).
export function makeTourSteps(store) {
  const st = () => store.getState()

  const findFeat = (dpa) => {
    const gp = st().geoParr
    if (!gp || !gp.features) return null
    return (
      gp.features.find(
        (f) => String((f.properties && f.properties.DPA_PARROQ) ?? '').padStart(6, '0') === dpa
      ) || gp.features[0]
    )
  }

  const toNacional = () => {
    const s = st()
    s.setProvFilter(null)
    s.clearSelected()
  }

  return [
    {
      element: '[data-tour="modules"]',
      autoMs: 7000,
      before: () => {
        const s = st()
        if (s.playing) s.togglePlay()
        toNacional()
        s.setModule('carga')
        s.setLayerType('coropleta')
        s.setMapMetric('morbilidad')
      },
      popover: {
        side: 'right',
        align: 'start',
        title: 'Tres modulos, tres preguntas',
        description:
          'geoENT organiza el analisis territorial de las ENT en tres modulos. Cada uno responde una pregunta: <b>donde</b> se concentra la carga, <b>por que</b>, y <b>donde actuar primero</b>.',
      },
    },
    {
      element: '[data-tour="map"]',
      autoMs: 8000,
      before: () => {
        const s = st()
        if (s.playing) s.togglePlay()
        toNacional()
        s.setModule('carga')
        s.setLayerType('coropleta')
        s.setYear(2024)
      },
      popover: {
        side: 'left',
        align: 'start',
        title: 'Donde se concentra la carga?',
        description:
          'El mapa pinta la <b>tasa de morbilidad por 100 mil habitantes</b> en cada parroquia. Mientras mas oscuro, mayor es la carga de enfermedad.' +
          BADGE,
      },
    },
    {
      element: '[data-tour="yearplay"]',
      autoMs: 9000,
      before: () => {
        const s = st()
        s.setModule('carga')
        s.setLayerType('heatmap')
        if (!s.playing) s.togglePlay()
      },
      popover: {
        side: 'right',
        align: 'center',
        title: 'Conglomerados en el tiempo',
        description:
          'Las zonas en rojo son <b>hot spots</b>: conglomerados de alta carga (estilo Getis-Ord). Deje correr la serie <b>2013 a 2024</b> y observe como se desplazan.' +
          BADGE,
      },
    },
    {
      element: '[data-tour="ficha"]',
      autoMs: 9000,
      before: () => {
        const s = st()
        if (s.playing) s.togglePlay()
        s.setModule('carga')
        s.setLayerType('coropleta')
        const f = findFeat(DEMO_DPA)
        if (f) s.setSelected(DEMO_DPA, f.properties)
      },
      popover: {
        side: 'left',
        align: 'start',
        title: 'Del territorio a la tendencia',
        description:
          'Al seleccionar una parroquia, el visor estima su <b>tendencia temporal</b> con Mann-Kendall y pendiente de Sen, corregida por <b>FDR</b>. Esta es la linea base que orientaria la priorizacion.' +
          BADGE +
          projectCard('Priorizacion territorial de ENT (MCDA cantonal)'),
      },
    },
    {
      element: '[data-tour="map"]',
      autoMs: 9000,
      before: () => {
        const s = st()
        if (s.playing) s.togglePlay()
        toNacional()
        s.setModule('determinantes')
        s.setLayerType('coropleta')
      },
      popover: {
        side: 'left',
        align: 'start',
        title: 'El porque: determinantes',
        description:
          'Aqui se exploran los <b>factores asociados</b>. Los colores muestran betas locales de una <b>Regresion Geograficamente Ponderada Multiescala (MGWR)</b>: cada factor pesa distinto segun el territorio.' +
          BADGE +
          projectCard('Salud publica de precision: estudio econometrico-espacial con IA (MGWR, ML y Deep Learning) - INSPI CZ9 - ESPE'),
      },
    },
    {
      element: '[data-tour="map"]',
      autoMs: 9000,
      before: () => {
        const s = st()
        toNacional()
        s.setModule('mcda')
        s.setLayerType('coropleta')
      },
      popover: {
        side: 'left',
        align: 'start',
        title: 'Donde actuar primero?',
        description:
          'La priorizacion combina <b>6 criterios ponderados</b> en un <b>ranking de ENT por territorio</b> mediante analisis multicriterio (MCDA): de la evidencia a la decision.' +
          BADGE +
          projectCard('Priorizacion territorial de ENT a nivel cantonal (MCDA)'),
      },
    },
    {
      autoMs: 12000,
      popover: {
        title: 'De prototipo a instrumento de decision',
        description:
          'Lo que vio es un <b>prototipo con datos simulados</b>. Con datos reales, estos dos proyectos del Centro EpiSIG convierten a geoENT en un <b>instrumento de salud publica de precision</b> para orientar la inversion sanitaria en el Ecuador.<br><br><b>INSPI - Centro de Investigacion EpiSIG - CZ9</b>',
      },
    },
  ]
}
