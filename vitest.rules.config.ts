import { defineConfig } from 'vitest/config';

/**
 * Tests des règles Firestore (tests/rules), contre l'émulateur : lancés par
 * `pnpm test:rules` (Java 21+), jamais par `pnpm test`. Les fichiers partagent
 * la même base émulée : ils passent l'un après l'autre.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
