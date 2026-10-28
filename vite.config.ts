import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Relative paths so the build works under GitHub Pages' /splitsmart/ path
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    // Installable app that works offline: the app and sample bills are precached; the OCR
    // engine, OCR language data and AI runtime are cached the first time they're used
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'SplitSmart',
        short_name: 'SplitSmart',
        description: 'Scan a hostel receipt, tap who had what, settle up with the fewest payments. Works offline.',
        theme_color: '#f3eee4',
        background_color: '#f3eee4',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2}'],
        // The OCR engine is cached when it's first used (or warmed up in the background, see lib/ocr.ts)
        globIgnores: ['tesseract/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/tesseract/'),
            handler: 'CacheFirst',
            options: { cacheName: 'ocr-engine', expiration: { maxEntries: 10 } },
          },
          {
            // OCR language data and the AI runtime come from jsDelivr
            urlPattern: ({ url }) => url.origin === 'https://cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: { cacheName: 'cdn', expiration: { maxEntries: 30 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
})
