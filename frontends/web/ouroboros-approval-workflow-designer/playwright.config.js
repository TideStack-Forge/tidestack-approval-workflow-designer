const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests/integration',
  timeout: 30 * 1000,
  use: {
    baseURL: 'http://127.0.0.1:8083/micro-workflow-editor/',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
  webServer: {
    command: 'PLAYWRIGHT_HARNESS=true npm run serve',
    url: 'http://127.0.0.1:8083/micro-workflow-editor/',
    reuseExistingServer: true,
    timeout: 300 * 1000,
  },
})
