import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright e2e — modo web (issue #187).
 *
 * Smoke tests e admin nav rodam sem Keycloak (AUTH_DISABLED=true).
 * Testes SSO marcados com tag @oidc são excluídos do CI por padrão.
 *
 * Iniciar manualmente: npm run web:build && npm run test:e2e
 * No CI: variável E2E_PORT pode sobrescrever a porta (default 4001).
 */

const PORT = process.env.E2E_PORT ?? '4001'
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],

  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: `${BASE_URL}/api/auth/config`,
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
    env: {
      AUTH_DISABLED: 'true',
      PORT,
      META_ENCRYPTION_KEY: 'test-key-for-e2e-only'
    }
  }
})
