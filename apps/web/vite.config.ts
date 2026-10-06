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
        // Hors précache : la scène du pont (budgetTheme.scene) et l'ancien
        // bandeau forestier des Courses (manifest.banners.courses), émis par
        // les manifests générés mais jamais affichés ; les peintures portrait
        // des univers, qui ne servent que sur ordinateur (cache à l'exécution,
        // voir sw.ts) — le téléphone ne les télécharge plus à l'installation ;
        // et TOUTES les peintures de saison (assets/season-* : forêt de
        // printemps / automne / hiver, LUT nuit de saison, bandeaux automne /
        // hiver), servies par le cache d'exécution « a2-budget-seasons » : la
        // saison en cours à la demande et en préchargement discret, la
        // suivante ~14 jours avant (app/seasonPrefetch.ts, app/seasonCache.ts).
        globIgnores: [
          '**/node_modules/**',
          'assets/scene-bridge-*.webp',
          'assets/courses-*.webp',
          'assets/banner-portrait-*.webp',
          'assets/season-*',
          // Carnet sans triche (V4) : les vraies images des créatures et des
          // lanternes de pierre à débloquer ne sont téléchargées qu'une fois
          // rencontrées / débloquées (cache à l'exécution, voir sw.ts). Les
          // silhouettes et la lanterne de base restent précachées.
          'assets/{moss-ling,seed-spirit,leaf-sprite,ember-wisp,mushroom-pip,water-drip}-*.webp',
          'assets/lantern-{yukimi,oribe,kotoji,tachi-carved,ancient-shrine,spirit-light}-{lit,unlit}-*.webp',
        ],
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
