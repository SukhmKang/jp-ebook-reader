import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

// Serve kuromoji .dat.gz files as raw binary (bypass sirv which sets Content-Encoding: gzip)
const serveKuromojiGz = {
  name: 'serve-kuromoji-gz',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/kuromoji/') && req.url?.endsWith('.gz')) {
        const filePath = path.join(process.cwd(), 'public', req.url)
        try {
          const data = fs.readFileSync(filePath)
          res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Length': data.length,
          })
          res.end(data)
        } catch {
          next()
        }
        return
      }
      next()
    })
  },
}

export default defineConfig({
  plugins: [
    serveKuromojiGz,
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mjs}'],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/dict\/jmdict\.json/,
            handler: 'CacheFirst',
            options: { cacheName: 'dict-cache' },
          },
          {
            urlPattern: /\/kuromoji\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'kuromoji-cache' },
          },
        ],
      },
      manifest: {
        name: 'Manga Reader',
        short_name: 'Reader',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
