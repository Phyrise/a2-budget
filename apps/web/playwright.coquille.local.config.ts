import base from './playwright.config';
export default {
  ...base,
  use: { ...base.use, baseURL: 'http://127.0.0.1:4184/a2-budget/' },
  webServer: { command: 'pnpm exec vite preview --port 4184 --strictPort', url: 'http://127.0.0.1:4184/a2-budget/', reuseExistingServer: false, timeout: 60_000 },
};
