import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

// Plugin local: elimina dist/assets/_legacy/ despues del build.
// Vite copia automaticamente todo public/ a dist/, incluido el subdir
// _legacy/ que guarda backups historicos de ent_parroquial.json (~11 MB)
// y NO debe ir al deploy de GitHub Pages.
function cleanupLegacyBackups() {
  return {
    name: 'cleanup-legacy-backups',
    closeBundle() {
      const legacyDir = resolve(__dirname, 'dist', 'assets', '_legacy')
      if (existsSync(legacyDir)) {
        rmSync(legacyDir, { recursive: true, force: true })
      }
    }
  }
}

// Plugin local: sirve /assets/* desde ../webapp/assets/ durante DEV.
// Evita duplicar ~18 MB de JSON/GeoJSON en webapp-react/public/.
// En BUILD el equivalente lo hace viteStaticCopy mas abajo, copiando los
// mismos archivos a dist/assets/ para deploys estaticos (GitHub Pages).
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

// Base path: en build apunta a la URL de GitHub Pages
// (https://alexisetc.github.io/Visor-ENT-EpiSIG/). En dev queda en '/'.
// Override con env VITE_BASE si despliegas en otro path (ej. dominio propio: '/').
const PAGES_BASE = process.env.VITE_BASE ?? '/Visor-ENT-EpiSIG/'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? PAGES_BASE : '/',
  plugins: [
    react(),
    legacyAssetsMiddleware(),
    // En build: copia los 8 datasets de ../webapp/assets/ a dist/assets/
    // para que el bundle estatico funcione fuera de Vite (GitHub Pages).
    viteStaticCopy({
      targets: [
        {
          src: resolve(__dirname, '..', 'webapp', 'assets', '*.json').replace(/\\/g, '/'),
          dest: 'assets'
        },
        {
          src: resolve(__dirname, '..', 'webapp', 'assets', '*.geojson').replace(/\\/g, '/'),
          dest: 'assets'
        }
      ]
    }),
    cleanupLegacyBackups()
  ],
  // Puerto 8080 (HTTP estandar) en vez del 5173 default de Vite porque
  // ESET Endpoint Security en este equipo bloquea Chrome -> localhost:5173
  // (ERR_CONNECTION_REFUSED) y otros puertos altos de dev. 8080 pasa limpio.
  server: { port: 8080 },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 700
  }
}))
