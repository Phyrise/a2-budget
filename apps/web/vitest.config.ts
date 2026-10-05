import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Tests unitaires de l'application (modules purs : cache et plan des
 * saisons…). Configuration séparée de vite.config.ts : ni PWA ni React ici.
 * Les imports d'images des manifests se résolvent en chemins sources.
 */
export default defineConfig({
  resolve: {
    alias: { '@a2/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
