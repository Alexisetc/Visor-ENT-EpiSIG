// Controlador imperativo del recorrido guiado. Envuelve driver.js y orquesta
// el ciclo de vida del tour. Lo usan: WelcomeModal y Header (startTour('manual'))
// y useKioskAttract (startTour('auto') + handoffToManual()).

import { driver } from 'driver.js'
import { useStore } from '../store'
import { makeTourSteps } from './tourSteps.jsx'

let driverObj = null
let autoTimer = null
let mode = 'manual'

function clearAuto() {
  if (autoTimer) {
    clearTimeout(autoTimer)
    autoTimer = null
  }
}

function scheduleAuto() {
  clearAuto()
  if (mode !== 'auto' || !driverObj) return
  const step = driverObj.getActiveStep()
  const ms = (step && step.autoMs) || 8000
  autoTimer = setTimeout(() => {
    if (!driverObj) return
    if (driverObj.isLastStep()) {
      stopTour()
    } else {
      driverObj.moveNext()
    }
  }, ms)
}

export function startTour(m = 'manual') {
  if (driverObj) stopTour()
  mode = m
  driverObj = driver({
    showProgress: true,
    progressText: 'Paso {{current}} de {{total}}',
    nextBtnText: 'Siguiente',
    prevBtnText: 'Atras',
    doneBtnText: 'Explorar',
    allowClose: true,
    stagePadding: 6,
    stageRadius: 8,
    overlayColor: 'rgba(17, 36, 63, 0.55)',
    popoverClass: 'episig-tour',
    steps: makeTourSteps(useStore),
    // Hook GLOBAL: invoca el before() del paso activo antes de resaltarlo.
    // Patron robusto: no depende de soporte de hooks por-paso en driver.js.
    onHighlightStarted: (el, step) => {
      if (step && step.before) step.before()
    },
    onPopoverRender: () => {
      if (mode === 'auto') scheduleAuto()
    },
    onDestroyed: () => {
      clearAuto()
      driverObj = null
      try {
        useStore.getState().setPlaying(false)
      } catch (e) {
        /* noop */
      }
      window.dispatchEvent(new CustomEvent('episig:tour-ended'))
    },
  })
  driverObj.drive()
  if (mode === 'auto') scheduleAuto()
}

export function stopTour() {
  clearAuto()
  if (driverObj) {
    const d = driverObj
    driverObj = null
    d.destroy()
  }
}

export function isTourActive() {
  return !!driverObj
}

// El visitante interactuo durante el modo auto: detener el auto-avance y dejar
// el tour abierto en manual (controla con Siguiente/Atras).
export function handoffToManual() {
  mode = 'manual'
  clearAuto()
}
