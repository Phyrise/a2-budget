import base from './playwright.config';
export default {
  ...base,
  use: { ...base.use, baseURL: 'http://127.0.0.1:4192/a2-budget/' },
  webServer: { command: 'node node_modules/vite/bin/vite.js preview --port 4192 --strictPort', url: 'http://127.0.0.1:4192/a2-budget/', reuseExistingServer: false, timeout: 60_000 },
};
