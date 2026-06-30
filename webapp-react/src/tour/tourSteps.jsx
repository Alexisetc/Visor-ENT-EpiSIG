// Guion del recorrido guiado de geoENT (7 paradas) — v2 anclada al estudio.
// El modulo de Carga refleja un ESTUDIO PUBLICADO (INSPILIP 2026, Nunez coautor):
// badge "Evidencia publicada" + cita. Determinantes y MCDA son PROYECTOS en
// formulacion: badge "Proyecto en formulacion - dato ilustrativo".
// Cada paso expone before(): el controlador lo invoca con un unico
// onHighlightStarted global ANTES de resaltar, para conducir el store.

export const DEMO_DPA = '170150' // Iñaquito (Quito): parroquia urbana representativa

const BADGE_EVID =
  '<span class="episig-tour__badge episig-tour__badge--evidencia">Evidencia publicada</span>'
const BADGE_PROY =
  '<span class="episig-tour__badge">Proyecto en formulación · dato ilustrativo</span>'

function studyCard() {
  return (
    '<div class="episig-tour__study">' +
    '<div class="episig-tour__study-label">Estudio publicado</div>' +
    '<div class="episig-tour__study-cite">Morales L, Sánchez M, Duque M, Núñez A, Chugá K. ' +
    'Evolución de la mortalidad por ENT en Ecuador (2017-2023).</div>' +
    '<div class="episig-tour__study-src">Rev. Ecuat. Cienc. Tecnol. Innov. Salud Pública · INSPILIP, 2026; 10(31)</div>' +
    '</div>'
  )
}

function projectCard(text) {
  return (
    '<div class="episig-tour__proj">' +
    '<div class="episig-tour__proj-label">Línea de investigación</div>' +
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
    // 1 · Orientacion
    {
      element: '[data-tour="modules"]',
      autoMs: 7000,
      before: () => {
        const s = st()
        if (s.playing) s.togglePlay()
        toNacional()
        s.setModule('carga')
        s.setLayerType('coropleta')
        s.setMapMetric('mortalidad')
        s.setEnt('todas')
        s.setYear(2023)
      },
      popover: {
        side: 'right',
        align: 'start',
        title: 'Tres módulos, una misma evidencia',
        description:
          'geoENT articula, en tres módulos complementarios, la evidencia generada por el equipo EpiSIG: ' +
          'la <b>distribución territorial</b> de la mortalidad por ENT, sus <b>determinantes</b> ' +
          'socioeconómicos y espaciales, y la <b>priorización</b> para la toma de decisiones en salud pública.',
      },
    },
    // 2 · Carga: magnitud (estudio)
    {
      element: '[data-tour="map"]',
      autoMs: 8500,
      before: () => {
        const s = st()
        if (s.playing) s.togglePlay()
        toNacional()
        s.setModule('carga')
        s.setLayerType('coropleta')
        s.setMapMetric('mortalidad')
        s.setEnt('todas')
        s.setYear(2023)
      },
      popover: {
        side: 'left',
        align: 'start',
        title: 'El 61,4% de la mortalidad corresponde a ENT',
        description:
          'En Ecuador, <b>6 de cada 10 defunciones</b> registradas entre 2017 y 2023 fueron atribuibles ' +
          'a enfermedades no transmisibles. El mapa representa esa mortalidad a nivel parroquial: ' +
          'a mayor intensidad cromática, mayor es la tasa.' +
          BADGE_EVID +
          studyCard(),
      },
    },
    // 3 · Carga: conglomerados en el tiempo + brecha rural (estudio)
    {
      element: '[data-tour="yearplay"]',
      autoMs: 9500,
      before: () => {
        const s = st()
        toNacional()
        s.setModule('carga')
        s.setMapMetric('mortalidad')
        s.setLayerType('heatmap')
        if (!s.playing) s.togglePlay()
      },
      popover: {
        side: 'right',
        align: 'center',
        title: 'Distribución espacio-temporal y brecha rural',
        description:
          'Los conglomerados de alta mortalidad se desplazan a lo largo del período. El estudio identificó ' +
          'incrementos estadísticamente significativos en <b>ámbito rural</b>: neoplasias (p=0,0005) y ' +
          'enfermedades cardiovasculares (p=0,0121). Reproduzca la serie temporal <b>2013–2024</b>.' +
          BADGE_EVID +
          studyCard(),
      },
    },
    // 4 · Carga: tendencia con la metodologia del estudio
    {
      element: '[data-tour="ficha"]',
      autoMs: 9500,
      before: () => {
        const s = st()
        if (s.playing) s.togglePlay()
        s.setModule('carga')
        s.setLayerType('coropleta')
        s.setMapMetric('mortalidad')
        s.setYear(2023)
        const f = findFeat(DEMO_DPA)
        if (f) s.setSelected(DEMO_DPA, f.properties)
      },
      popover: {
        side: 'left',
        align: 'start',
        title: 'Tendencia territorial: metodología del estudio',
        description:
          'Al seleccionar un territorio, el visor estima su <b>tendencia temporal</b> mediante ' +
          'Mann-Kendall y pendiente de Sen, con corrección por <b>FDR</b> — la misma metodología ' +
          'del estudio. A nivel nacional, <b>neoplasias</b> y <b>enfermedades del sistema nervioso</b> ' +
          'presentan tendencias significativas al alza en ambos sexos (en mayores de 60 años, ' +
          'sistema nervioso <b>+5,47%/año</b>).' +
          BADGE_EVID +
          studyCard(),
      },
    },
    // 5 · Determinantes (proyecto en formulacion)
    {
      element: '[data-tour="map"]',
      autoMs: 9500,
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
        title: 'Determinantes: ¿qué factores explican la distribución?',
        description:
          'La evidencia publicada establece <b>qué</b> enfermedades muestran incremento y <b>dónde</b>. ' +
          'El módulo de Determinantes aborda los factores asociados mediante betas locales de una ' +
          '<b>Regresión Geográficamente Ponderada Multiescala (MGWR)</b>: la ponderación espacial ' +
          'varía según las características de cada territorio.' +
          BADGE_PROY +
          projectCard('Salud pública de precisión: estudio econométrico-espacial con IA (MGWR, ML y Deep Learning) · INSPI CZ9 – ESPE'),
      },
    },
    // 6 · Priorizacion MCDA (proyecto en formulacion)
    {
      element: '[data-tour="map"]',
      autoMs: 9500,
      before: () => {
        const s = st()
        toNacional()
        s.setModule('mcda')
        s.setLayerType('coropleta')
      },
      popover: {
        side: 'left',
        align: 'start',
        title: 'Priorización territorial para la toma de decisiones',
        description:
          'Identificados los determinantes, el siguiente paso es priorizar. Este módulo sintetiza ' +
          '<b>seis criterios ponderados</b> en un índice compuesto de prioridad por territorio y ENT, ' +
          'mediante análisis multicriterio (MCDA). El resultado: evidencia accionable para orientar la ' +
          'inversión en salud pública.' +
          BADGE_PROY +
          projectCard('Priorización territorial de ENT a nivel cantonal (MCDA)'),
      },
    },
    // 7 · Cierre (encuadre honesto)
    {
      autoMs: 12000,
      popover: {
        title: 'De la evidencia publicada al instrumento de decisión',
        description:
          'El módulo de Carga de Enfermedad no es un prototipo: se sustenta en un <b>estudio ya ' +
          'publicado</b> por el equipo EpiSIG (INSPILIP, 2026). Los módulos de Determinantes y ' +
          'Priorización constituyen las <b>dos líneas de investigación</b> que ampliarán esa evidencia ' +
          'con datos reales, consolidando un <b>instrumento de salud pública de precisión</b> ' +
          'para el Ecuador.<br><br><b>INSPI · Centro de Investigación EpiSIG · CZ9</b>',
      },
    },
  ]
}
