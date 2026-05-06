// EpiSIG · geoENT — Service Worker
//
// Estrategia: NETWORK-FIRST con cache fallback para los datasets JSON/
// GeoJSON servidos por jsDelivr (cdn.jsdelivr.net). Network-first
// asegura que el usuario siempre vea la última versión publicada de los
// datasets — el cache solo se usa como red de seguridad si la red falla
// (offline o CDN caído). jsDelivr es lo bastante rápido (~30s p/ el
// geojson grande) para que esto sea aceptable, y elimina la categoría
// de bug "datos viejos servidos del cache después de un redeploy".
//
// Network-first también significa que pushear datos nuevos llega al
// usuario INMEDIATAMENTE en su próxima visita, sin esperar a que el
// background revalidate del cache-first se complete.
//
// Versionado: si cambia DATA_CACHE bump del número. v2 = network-first.

const DATA_CACHE = 'episig-data-v2'

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
  if (req.method !== 'GET') return
  if (!DATA_HOST_RX.test(req.url)) return

  // === NETWORK-FIRST ===
  // 1. Intentar red. Si OK → guardar en cache y devolver al cliente.
  // 2. Si falla red → buscar en cache. Si hay → devolver. Si no →
  //    error claro al cliente.
  event.respondWith((async () => {
    const cache = await caches.open(DATA_CACHE)
    try {
      const fresh = await fetch(req)
      if (fresh.ok) {
        // No bloqueamos al usuario esperando que termine el cache.put,
        // pero tampoco tiramos el promise: lo dejamos vivir vía
        // event.waitUntil. fresh.clone() es necesario porque el
        // response solo puede leerse una vez.
        event.waitUntil(cache.put(req, fresh.clone()))
        return fresh
      }
      // Network respondió pero con error (5xx, 404…) — caer al cache.
      const cached = await cache.match(req)
      if (cached) return cached
      return fresh
    } catch (err) {
      // Sin red → cache. Si tampoco hay cache → error claro.
      const cached = await cache.match(req)
      if (cached) return cached
      return new Response(
        JSON.stringify({ error: 'offline', url: req.url }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      )
    }
  })())
})
