import { expect, test } from '@playwright/test'

/**
 * Testes de navegação admin via menu bar (issue #187).
 * Não requerem Keycloak nem PostgreSQL — usam AUTH_DISABLED=true.
 */
test.describe('Navegação admin via menu bar', () => {
  test('clica em "Data Sources" → abre Admin na aba Data Sources', async ({ page }) => {
    await page.goto('/')
    await page.click('[role="menuitem"]:has-text("Data Sources")')
    await expect(page.locator('h2:has-text("Painel de Administração")')).toBeVisible()
    await expect(page.locator('.admin-tab.active')).toContainText('Data Sources')
  })

  test('clica em "Usuários" → abre Admin na aba Usuários', async ({ page }) => {
    await page.goto('/')
    await page.click('[role="menuitem"]:has-text("Usuários")')
    await expect(page.locator('.admin-tab.active')).toContainText('Usuários')
  })

  test('clica em "Concessões" → abre Admin na aba Concessões', async ({ page }) => {
    await page.goto('/')
    await page.click('[role="menuitem"]:has-text("Concessões")')
    await expect(page.locator('.admin-tab.active')).toContainText('Concessões')
  })

  test('clica em "Auditoria" → abre Admin na aba Auditoria', async ({ page }) => {
    await page.goto('/')
    await page.click('[role="menuitem"]:has-text("Auditoria")')
    await expect(page.locator('.admin-tab.active')).toContainText('Auditoria')
  })

  test('botão "← Voltar" retorna ao editor com menu bar', async ({ page }) => {
    await page.goto('/')
    await page.click('[role="menuitem"]:has-text("Data Sources")')
    await expect(page.locator('h2:has-text("Painel de Administração")')).toBeVisible()

    await page.click('button:has-text("← Voltar")')

    await expect(page.locator('.web-menubar-brand')).toBeVisible()
    await expect(page.locator('.web-menubar-nav')).toBeVisible()
  })

  test('troca de aba dentro do Admin sem voltar ao editor', async ({ page }) => {
    await page.goto('/')
    await page.click('[role="menuitem"]:has-text("Data Sources")')
    await expect(page.locator('.admin-tab.active')).toContainText('Data Sources')

    await page.click('.admin-tab:has-text("Usuários")')
    await expect(page.locator('.admin-tab.active')).toContainText('Usuários')
    await expect(page.locator('h2:has-text("Painel de Administração")')).toBeVisible()
  })
})

/**
 * Testes SSO — requerem Keycloak ativo.
 * Marcados com @oidc e excluídos do CI por padrão.
 * Rodar localmente: npx playwright test --grep @oidc
 */
test.describe('@oidc Auth SSO', () => {
  test.skip(
    !process.env.KEYCLOAK_URL,
    'Pulado: KEYCLOAK_URL não definido (Keycloak não está ativo)'
  )

  test('redireciona para Keycloak ao clicar em "Entrar com SSO"', async ({ page }) => {
    await page.goto('/')
    await page.click('button:has-text("Entrar com SSO")')
    await expect(page).toHaveURL(/realms\/deepion/)
  })
})
