import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

/** Port du `vite preview` du build émulateurs (E2E_PORT, comme la suite principale). */
const PORT = Number(process.env.E2E_PORT ?? 4183);
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Tests navigateur du compte (V5) contre les émulateurs Firebase.
 *
 * - Build dédié `dist-emu/` (`pnpm build:emu`, mode « emulators » :
 *   projet demo-a2home, faux jeton Google possible) ; la suite principale
 *   (playwright.config.ts) reste sur le build sans configuration.
 * - Émulateurs Auth + Firestore lancés ici s'ils ne tournent pas déjà
 *   (Java 21+ : scripts/install-java.sh). Mêmes ports que `pnpm test:rules` :
 *   ne pas lancer les deux en même temps.
 * - Lancer : `pnpm --filter @a2/web e2e:sync` (build compris).
 */
export default defineConfig({
  testDir: './e2e-sync',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/a2-budget/`,
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } }],
  webServer: [
    {
      command: 'scripts/with-java.sh npx firebase emulators:start --only auth,firestore --project demo-a2home',
      cwd: ROOT,
      url: 'http://127.0.0.1:8180/',
      reuseExistingServer: true,
      timeout: 120_000,
      // Arrêt propre (Ctrl-C) : sinon le Java de l'émulateur Firestore, détaché, survit.
      gracefulShutdown: { signal: 'SIGINT', timeout: 20_000 },
    },
    {
      command: `pnpm exec vite preview --outDir dist-emu --port ${PORT} --strictPort`,
      url: `http://127.0.0.1:${PORT}/a2-budget/`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
