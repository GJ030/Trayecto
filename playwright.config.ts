import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  /* La carpeta de datos (File System Access / OPFS) no existe por file://: esas pruebas abren dist/ por http://127.0.0.1 */
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/trayecto.html',
    reuseExistingServer: true,
    timeout: 30000,
  },
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 900 },
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    reducedMotion: 'reduce',
    acceptDownloads: true,
  },
});
