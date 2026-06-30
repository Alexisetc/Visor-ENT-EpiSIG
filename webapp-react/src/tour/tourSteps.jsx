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
    // 1 · Apertura: que hace EpiSIG y por que importa
    {
      element: '[data-tour="modules"]',
      autoMs: 8000,
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
        title: 'Las ENT son la principal causa de muerte en Ecuador',
        description:
          'Y, sin embargo, persisten preguntas sin respuesta: <b>dónde se concentra la carga</b>, ' +
          '<b>qué factores la explican</b> y <b>dónde priorizar la inversión sanitaria</b>. En el ' +
          'Centro de Investigación EpiSIG del INSPI estamos trabajando en esas tres preguntas. ' +
          'Permítanos mostrarle cómo, en menos de un minuto.',
      },
    },
    // 2 · Modulo 1: lo que el estudio publicado ya nos dijo (magnitud)
    {
      element: '[data-tour="map"]',
      autoMs: 9000,
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
        title: '6 de cada 10 muertes son por una ENT',
        description:
          'Este módulo se sustenta en un <b>estudio ya publicado</b> por el equipo: entre 2017 y ' +
          '2023, el <b>61,4%</b> de las defunciones en Ecuador fueron atribuibles a enfermedades ' +
          'no transmisibles. El mapa representa esa mortalidad a nivel parroquial — el primer ' +
          'mapeo del país a este nivel de desagregación.' +
          BADGE_EVID +
          studyCard(),
      },
    },
    // 3 · Modulo 1: hallazgo clave - la brecha rural en el tiempo
    {
      element: '[data-tour="yearplay"]',
      autoMs: 10000,
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
        title: 'Un hallazgo del estudio: la brecha rural',
        description:
          'Al reproducir la serie <b>2013 → 2024</b>, los conglomerados de alta mortalidad se ' +
          'desplazan territorialmente. El estudio documenta un patrón relevante: en el <b>ámbito ' +
          'rural</b>, las muertes por neoplasias (p=0,0005) y por enfermedades cardiovasculares ' +
          '(p=0,0121) presentan incrementos estadísticamente significativos. La carga ya no se ' +
          'circunscribe a lo urbano.' +
          BADGE_EVID +
          studyCard(),
      },
    },
    // 4 · Modulo 1: hallazgo clave - el sistema nervioso en mayores de 60
    {
      element: '[data-tour="ficha"]',
      autoMs: 10000,
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
        title: 'El envejecimiento que se acelera',
        description:
          'En adultos <b>mayores de 60 años</b>, la mortalidad por enfermedades del <b>sistema ' +
          'nervioso</b> se incrementa a un ritmo de <b>+5,47% anual</b>. Al seleccionar una ' +
          'parroquia, el visor estima su tendencia local con la misma metodología del estudio ' +
          '(Mann-Kendall, pendiente de Sen y corrección por FDR): la evidencia nacional se ' +
          'traduce a escala territorial.' +
          BADGE_EVID +
          studyCard(),
      },
    },
    // 5 · Modulo 2: la primera propuesta aprobada como pertinente
    {
      element: '[data-tour="map"]',
      autoMs: 11000,
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
        title: 'La siguiente pregunta: ¿qué explica esta distribución?',
        description:
          'Conocer la carga abre una pregunta de mayor profundidad: el porqué. Para abordarla ' +
          'presentamos una propuesta de investigación que <b>ya ha sido considerada pertinente</b> ' +
          'por la institución, basada en <b>Regresión Geográficamente Ponderada Multiescala ' +
          '(MGWR)</b>, aprendizaje automático e inteligencia artificial. Lo que se observa en el ' +
          'mapa es una <b>simulación del resultado esperado</b>: la distribución territorial del ' +
          'peso de cada determinante sobre cada ENT.' +
          BADGE_PROY +
          projectCard('Salud pública de precisión: estudio econométrico-espacial con IA (MGWR, ML y Deep Learning) · INSPI CZ9 – ESPE'),
      },
    },
    // 6 · Modulo 3: la segunda propuesta aprobada como pertinente
    {
      element: '[data-tour="map"]',
      autoMs: 11000,
      before: () => {
        const s = st()
        toNacional()
        s.setModule('mcda')
        s.setLayerType('coropleta')
      },
      popover: {
        side: 'left',
        align: 'start',
        title: '¿Y dónde priorizar la inversión?',
        description:
          'La tercera pregunta es la más compleja del ciclo de decisión sanitaria. Nuestra segunda ' +
          'propuesta — también <b>considerada pertinente</b> — la aborda integrando <b>seis ' +
          'criterios</b> mediante análisis multicriterio (MCDA), para generar un <b>índice de ' +
          'prioridad</b> por territorio y por ENT. La simulación anticipa la estructura final de ' +
          'esa herramienta de decisión cuando opere con datos reales.' +
          BADGE_PROY +
          projectCard('Priorización territorial de ENT a nivel cantonal (MCDA)'),
      },
    },
    // 7 · Invitacion a colaborar
    {
      autoMs: 13000,
      popover: {
        title: 'Esto es lo que el equipo EpiSIG está investigando',
        description:
          'Un estudio publicado y dos investigaciones aprobadas como pertinentes que extenderán ' +
          'esa evidencia con datos reales, hasta consolidar a geoENT como <b>instrumento de salud ' +
          'pública de precisión</b> para el Ecuador. Si su trabajo se vincula con <b>ENT, ' +
          'territorio o políticas de salud</b>, le invitamos a conversar: existen líneas de ' +
          'cooperación posibles.' +
          '<br><br><b>INSPI · Centro de Investigación EpiSIG · CZ9</b>',
      },
    },
  ]
}
