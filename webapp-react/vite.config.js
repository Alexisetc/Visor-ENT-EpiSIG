import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

// Plugin local: sirve /assets/* desde ../webapp/assets/ durante dev
// (evita duplicar 10 MB de JSON/GeoJSON). En build, vite-plugin-static-copy
// llevaria los assets a dist/assets/.
function legacyAssetsMiddleware() {
  const legacyAssets = resolve(__dirname, '..', 'webapp', 'assets')
  return {
    name: 'legacy-assets-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/assets/')) return next()
        const rel = req.url.replace(/^\/assets\//, '').split('?')[0]
        const filePath = resolve(legacyAssets, rel)
        if (!filePath.startsWith(legacyAssets)) return next()  // path traversal guard
        if (!existsSync(filePath) || !statSync(filePath).isFile()) return next()
        const ext = filePath.split('.').pop()
        const types = {
          json: 'application/json',
          geojson: 'application/geo+json',
          js: 'text/javascript',
          css: 'text/css'
        }
        res.setHeader('Content-Type', types[ext] || 'application/octet-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(readFileSync(filePath))
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), legacyAssetsMiddleware()],
  // Puerto 8080 (HTTP estandar) en vez del 5173 default de Vite porque
  // ESET Endpoint Security en este equipo bloquea Chrome -> localhost:5173
  // (ERR_CONNECTION_REFUSED) y otros puertos altos de dev. 8080 pasa limpio.
  server: { port: 8080 },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 700
  }
})
