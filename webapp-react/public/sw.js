// EpiSIG · geoENT — Service Worker
//
// Estrategia: cache-first para los datasets JSON/GeoJSON servidos por
// jsDelivr (cdn.jsdelivr.net). Network-first (default fetch) para todo
// lo demás — no queremos cachear HTML, JS ni CSS aquí porque Vite ya
// los versiona por hash.
//
// Beneficio: segunda visita del usuario carga los datasets de disco
// (~50ms) en vez de re-bajar de jsDelivr (~30s en peores casos).
//
// Versionado: si cambia DATA_CACHE bump del número, los browsers
// activan el nuevo SW y purgan el viejo cache. Útil si el formato
// de los datasets cambia y queremos invalidar lo cacheado en el wild.

const DATA_CACHE = 'episig-data-v1'

const DATA_HOST_RX = /^https:\/\/cdn\.jsdelivr\.net\/gh\/Alexisetc\/Visor-ENT-EpiSIG@/

self.addEventListener('install', (event) => {
  // Activarse inmediatamente sin esperar a que se cierren las pestañas
  // viejas. Aceptable porque el SW solo cachea datos read-only.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Limpiar caches viejos al activar la nueva versión + tomar control
  // de las pestañas existentes.
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(
      names
        .filter((n) => n.startsWith('episig-') && n !== DATA_CACHE)
        .map((n) => caches.delete(n))
    )
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  // Solo interceptar GET, mismo origin permite que jsDelivr (CORS)
  // pase el cache.match.
  if (req.method !== 'GET') return
  if (!DATA_HOST_RX.test(req.url)) return

  event.respondWith((async () => {
    const cache = await caches.open(DATA_CACHE)
    const cached = await cache.match(req)
    if (cached) {
      // Background: revalidar de manera asíncrona — si el archivo
      // cambió, el siguiente fetch ya tendrá la versión nueva.
      event.waitUntil((async () => {
        try {
          const fresh = await fetch(req)
          if (fresh.ok) cache.put(req, fresh.clone())
        } catch { /* offline → cache es nuestra red de seguridad */ }
      })())
      return cached
    }
    // No estaba en cache → ir a red, cachear si OK.
    try {
      const fresh = await fetch(req)
      if (fresh.ok) cache.put(req, fresh.clone())
      return fresh
    } catch (err) {
      // Sin red y sin cache → error claro al cliente.
      return new Response(
        JSON.stringify({ error: 'offline', url: req.url }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      )
    }
  })())
})
