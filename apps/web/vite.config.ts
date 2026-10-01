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
        name: 'A² Budget',
        short_name: 'Budget',
        description: 'Budget commun du couple : contributions, dépenses, reste.',
        lang: 'fr',
        dir: 'ltr',
        start_url: '/a2-budget/',
        scope: '/a2-budget/',
        display: 'standalone',
        background_color: '#F7F5EF',
        theme_color: '#254B3D',
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
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
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
