import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const coreEntry = fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url));

export default defineConfig({
  // Page projet GitHub Pages : https://phyrise.github.io/a2-budget/
  base: '/a2-budget/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // Service worker custom (src/sw.ts) : préfixe des caches « a2-budget »
      // et repli SPA dans le sous-chemin /a2-budget/.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        id: '/a2-budget/',
        name: 'A² Home',
        short_name: 'Home',
        description: 'Notre quotidien à deux : budget, maison et courses.',
        lang: 'fr',
        dir: 'ltr',
        start_url: '/a2-budget/',
        scope: '/a2-budget/',
        display: 'standalone',
        background_color: '#0b1410',
        theme_color: '#0b1410',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Précache uniquement la coquille de l'app et les assets locaux.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,webp,avif,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      // En mode injectManifest, c'est ce bloc qui configure le manifest de
      // précache (le bloc workbox ci-dessus ne le fait pas) : jpg/png inclus
      // (forêt, avatars) pour le mode hors ligne.
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,webp,avif,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@a2/core': coreEntry,
    },
  },
  server: {
    // Test LAN depuis un téléphone : http://<ip>:5173/a2-budget/
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
