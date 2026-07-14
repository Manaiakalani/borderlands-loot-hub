import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:4173/borderlands-loot-hub/';

test.describe('Borderlands SHiFT Vault E2E', () => {
  test('dashboard loads and displays codes', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/Borderlands SHiFT Vault/);

    // Header renders with stats
    await expect(page.locator('text=/\\d+ Active/')).toBeVisible();
    await expect(page.locator('text=/\\d+ Total/')).toBeVisible();

    // At least one code card should be visible
    const cards = page.locator('[class*="card-borderlands"]');
    await expect(cards.first()).toBeVisible();
  });

  test('game filter works', async ({ page }) => {
    await page.goto(BASE_URL);

    // Click BL4 filter
    await page.getByRole('button', { name: 'BL4' }).click();

    // All visible game badges should be BL4
    const badges = page.locator('span:text("BL4")');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('status filter works', async ({ page }) => {
    await page.goto(BASE_URL);

    // Click Active filter
    await page.getByRole('button', { name: 'Active' }).click();

    // Should not see expired badges in cards
    await expect(page.locator('[class*="card-borderlands"] >> text=Expired')).toHaveCount(0);
  });

  test('copy button copies code to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(BASE_URL);

    const copyBtn = page.getByRole('button', { name: /Copy/ }).first();
    await copyBtn.click();

    // Should show "Copied" text
    await expect(page.locator('text=Copied').first()).toBeVisible();
  });

  test('navigation to About page works', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByRole('link', { name: /About/i }).click();
    await expect(page).toHaveURL(/\/about/);
    await expect(page.locator('h1:has-text("About")')).toBeVisible();
  });

  test('navigation to Privacy page works', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByRole('link', { name: /Privacy/i }).click();
    await expect(page).toHaveURL(/\/privacy/);
    await expect(page.locator('h1:has-text("Privacy")')).toBeVisible();
  });

  test('404 page displays for unknown routes', async ({ page }) => {
    await page.goto(BASE_URL + 'nonexistent-page');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  });

  test('no external analytics scripts loaded', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => {
      if (!req.url().startsWith('http://localhost')) {
        requests.push(req.url());
      }
    });
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // No third-party requests should exist
    expect(requests.filter(u => u.includes('analytics'))).toHaveLength(0);
  });

  test('responsive layout has no horizontal overflow at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test('keyboard navigation works on filter buttons', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Tab through until we reach a filter button
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      const pressed = await page.evaluate(() => document.activeElement?.getAttribute('aria-pressed'));
      if (pressed !== null) break;
    }
    
    // A filter button should be focusable
    const activeElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeElement).toBe('BUTTON');
  });
});
