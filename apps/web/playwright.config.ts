import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests navigateur (lead).
 *
 * Ils tournent contre le BUILD DE PRODUCTION servi par `pnpm preview`
 * (le serveur de développement ne sert pas le service worker).
 * Une simulation WebKit/Chromium ne remplace pas un test sur un véritable
 * iPhone/Android : les vérifications réelles sont distinguées dans le
 * compte rendu final.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // Un seul worker : toutes les suites partagent un même `vite preview`, la
  // forêt WebGL et l'installation du service worker (précache ~7 Mo). À 4
  // workers, des attentes temporelles (contrôleur du worker, coup de balai)
  // échouent au hasard sous la charge ; en série la suite est déterministe.
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173/a2-budget/',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm preview',
    url: 'http://127.0.0.1:4173/a2-budget/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
