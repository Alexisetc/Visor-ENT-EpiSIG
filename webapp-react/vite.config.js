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
  server: { port: 5173 },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 700
  }
})
