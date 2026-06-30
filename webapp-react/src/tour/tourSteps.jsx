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
          'Y, sin embargo, sabemos poco sobre <b>dónde golpean más</b>, <b>por qué</b> y ' +
          '<b>dónde deberíamos invertir primero</b>. En el Centro de Investigación EpiSIG del INSPI ' +
          'estamos respondiendo esas tres preguntas. Le mostramos cómo, en menos de un minuto.',
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
          'Este módulo se sustenta en un <b>estudio que ya publicamos</b>: entre 2017 y 2023, el ' +
          '<b>61,4%</b> de las defunciones en Ecuador fueron por enfermedades no transmisibles. ' +
          'El mapa muestra esa carga, parroquia por parroquia — la primera fotografía territorial ' +
          'de las ENT en el país a este nivel de detalle.' +
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
        title: 'Lo que no esperábamos: la brecha rural',
        description:
          'Al recorrer la serie <b>2013 → 2024</b>, los conglomerados de alta mortalidad se desplazan. ' +
          'Lo más revelador del estudio: en las <b>zonas rurales</b> las muertes por neoplasias ' +
          '(p=0,0005) y enfermedades cardiovasculares (p=0,0121) están aumentando de forma ' +
          'estadísticamente significativa. La carga ya no es solo urbana.' +
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
        title: 'Y un dato que cambia la conversación',
        description:
          'En adultos <b>mayores de 60 años</b>, la mortalidad por enfermedades del <b>sistema ' +
          'nervioso</b> está creciendo a un ritmo de <b>+5,47% cada año</b>. Al seleccionar una ' +
          'parroquia, el visor estima su tendencia local con la misma metodología del estudio ' +
          '(Mann-Kendall, pendiente de Sen y corrección por FDR): la evidencia baja al territorio.' +
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
        title: 'La siguiente pregunta: ¿por qué pasa esto?',
        description:
          'Conocer la carga abrió una pregunta más profunda. Para responderla presentamos una ' +
          'propuesta de investigación que <b>ya ha sido considerada pertinente</b> por la ' +
          'institución: cruzar los datos de ENT con factores socioeconómicos y ambientales mediante ' +
          '<b>Regresión Geográficamente Ponderada Multiescala (MGWR)</b>, aprendizaje automático e IA. ' +
          'Lo que ve a la izquierda es una <b>simulación del resultado esperado</b>: cómo se vería ' +
          'el peso de cada determinante en cada territorio.' +
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
        title: '¿Y dónde se debería invertir primero?',
        description:
          'La tercera pregunta es la más difícil para el sistema de salud. Nuestra segunda ' +
          'propuesta — también <b>considerada pertinente</b> — la responde combinando ' +
          '<b>seis criterios</b> mediante análisis multicriterio (MCDA) para entregar un ' +
          '<b>ranking de prioridad</b> por territorio y por ENT. Esta simulación anticipa cómo se ' +
          'verá esa herramienta de decisión cuando se ejecute con datos reales.' +
          BADGE_PROY +
          projectCard('Priorización territorial de ENT a nivel cantonal (MCDA)'),
      },
    },
    // 7 · Invitacion a colaborar
    {
      autoMs: 13000,
      popover: {
        title: 'Esto es lo que estamos investigando',
        description:
          'Un estudio ya publicado y dos investigaciones aprobadas como pertinentes que extenderán ' +
          'esa evidencia con datos reales, hasta convertir a geoENT en un <b>instrumento de salud ' +
          'pública de precisión</b> para el Ecuador. Si su trabajo se relaciona con <b>ENT, ' +
          'territorio o políticas de salud</b>, conversemos: tenemos preguntas en común.' +
          '<br><br><b>INSPI · Centro de Investigación EpiSIG · CZ9</b>',
      },
    },
  ]
}
