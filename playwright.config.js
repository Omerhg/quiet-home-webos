const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:8765', viewport: { width: 1920, height: 1080 }, headless: true, launchOptions: process.env.PLAYWRIGHT_CHROME_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } : {} },
  webServer: { command: 'python3 -I -m http.server 8765 --bind 127.0.0.1 --directory app', url: 'http://127.0.0.1:8765', reuseExistingServer: false }
});
