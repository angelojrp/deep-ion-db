import { expect, test } from '@playwright/test'

/**
 * Smoke tests — modo web com AUTH_DISABLED=true (issue #187).
 * Não requerem Keycloak nem PostgreSQL meta.
 */
test.describe('Smoke — modo web (AUTH_DISABLED)', () => {
  test('app carrega e exibe menu bar com brand', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.web-menubar-brand')).toHaveText('Deep Ion DB')
  })

  test('badge "⚠ Modo dev" visível quando authDisabled=true', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.auth-disabled-badge')).toBeVisible()
  })

  test('4 links de admin visíveis para dev user (role admin)', async ({ page }) => {
    await page.goto('/')
    const nav = page.locator('.web-menubar-nav [role="menuitem"]')
    await expect(nav).toHaveCount(4)
    await expect(nav.nth(0)).toContainText('Data Sources')
    await expect(nav.nth(1)).toContainText('Usuários')
    await expect(nav.nth(2)).toContainText('Concessões')
    await expect(nav.nth(3)).toContainText('Auditoria')
  })

  test('editor SQL carrega com aba Query 1', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.tab-title').filter({ hasText: 'Query 1' })).toBeVisible()
  })

  test('barra lateral DATABASE EXPLORER visível', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('DATABASE EXPLORER')).toBeVisible()
  })

  test('/api/auth/config retorna authDisabled=true', async ({ request }) => {
    const res = await request.get('/api/auth/config')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.authDisabled).toBe(true)
  })

  test('/health retorna ok=true', async ({ request }) => {
    const res = await request.get('/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
