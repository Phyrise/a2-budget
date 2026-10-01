import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const coreEntry = fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url));

/**
 * Config Vite dédiée à l'aperçu dev (QA visuelle de la forêt).
 * Sans PWA, sans base path : build séparé, jamais inclus dans la production.
 *   pnpm --filter @a2/web exec vite build --config vite.preview.config.ts --outDir dist-preview
 */
export default defineConfig({
  root: '.',
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@a2/core': coreEntry,
    },
  },
  build: {
    outDir: 'dist-preview',
    rollupOptions: {
      input: {
        preview: fileURLToPath(new URL('./preview.html', import.meta.url)),
      },
    },
  },
});
