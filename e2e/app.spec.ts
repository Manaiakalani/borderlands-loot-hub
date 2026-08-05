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

  test('only expected third-party origins are contacted', async ({ page }) => {
    // Analytics is intentionally enabled (see the Privacy page). This test guards
    // against *unexpected* third parties creeping in, and pins the analytics host.
    const ALLOWED_ORIGINS = [
      'https://analytics.manaiakalani.info',
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
    ];

    const external: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith('http://localhost') && !url.startsWith('data:')) {
        external.push(url);
      }
    });
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const unexpected = external.filter(
      (u) => !ALLOWED_ORIGINS.some((origin) => u.startsWith(origin))
    );
    expect(unexpected, `Unexpected third-party requests: ${unexpected.join(', ')}`).toHaveLength(0);
  });

  test('route-restore script is external so a strict CSP can allow it', async ({ page }) => {
    await page.goto(BASE_URL);
    // The GH Pages deep-link restore must not be an inline <script>, otherwise a
    // CSP without 'unsafe-inline' (see nginx.conf) would block it.
    const inlineExecutable = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script'))
        .filter((s) => !s.src && (!s.type || s.type === 'text/javascript' || s.type === 'module'))
        .map((s) => s.textContent?.slice(0, 40) ?? '')
    );
    expect(inlineExecutable).toHaveLength(0);

    const hasRestoreScript = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script')).some((s) => s.src.includes('restore-route.js'))
    );
    expect(hasRestoreScript).toBe(true);
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
