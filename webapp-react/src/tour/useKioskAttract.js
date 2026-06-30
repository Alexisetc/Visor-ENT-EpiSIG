// Modo kiosco hibrido. Solo activo con ?kiosk=1 en la URL.
// Tras IDLE_MS sin interaccion del visitante arranca el tour en modo auto
// (bucle atractor). Si el visitante interactua durante el auto, se le entrega
// el control (handoffToManual). Al terminar/cerrar el tour, vuelve a esperar.

import { useEffect } from 'react'
import { startTour, stopTour, isTourActive, handoffToManual } from './tourController'

const IDLE_MS = 45000
const POLL_MS = 3000

export function useKioskAttract() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('kiosk') !== '1') return

    let lastActivity = Date.now()

    const onActivity = () => {
      lastActivity = Date.now()
      if (isTourActive()) handoffToManual()
    }
    const onTourEnded = () => {
      lastActivity = Date.now()
    }

    const events = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'wheel']
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    window.addEventListener('episig:tour-ended', onTourEnded)

    const iv = setInterval(() => {
      if (isTourActive()) return
      if (Date.now() - lastActivity >= IDLE_MS) startTour('auto')
    }, POLL_MS)

    return () => {
      clearInterval(iv)
      events.forEach((e) => window.removeEventListener(e, onActivity))
      window.removeEventListener('episig:tour-ended', onTourEnded)
      stopTour()
    }
  }, [])
}
