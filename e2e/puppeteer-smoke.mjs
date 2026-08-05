/**
 * Puppeteer E2E smoke tests
 * Run: node e2e/puppeteer-smoke.mjs
 * Requires the production build served on the port in e2e-config.mjs (4273).
 * Start it with: npx vite preview --port 4273 --strictPort
 */
import puppeteer from 'puppeteer';
import { BASE_URL as BASE, isAllowedRequestUrl } from './e2e-config.mjs';

let browser, page;
const results = [];

function assert(condition, name) {
  if (condition) {
    results.push({ name, pass: true });
  } else {
    results.push({ name, pass: false });
    console.error(`  ✗ FAIL: ${name}`);
  }
}

async function setup() {
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  page = await browser.newPage();
}

async function teardown() {
  await browser?.close();
}

async function testDashboardLoads() {
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  const title = await page.title();
  assert(title.includes('Borderlands SHiFT Vault'), 'Dashboard title correct');
  
  const activeText = await page.$eval('body', el => el.textContent);
  assert(activeText.includes('Active'), 'Shows Active stat');
  assert(activeText.includes('Total'), 'Shows Total stat');
}

// The site intentionally loads first-party analytics (restored in e1c4698) and
// Google Fonts. Assert an origin allowlist instead of "no analytics": that still
// catches an unexpected third-party tracker being introduced, without failing on
// the origins we deliberately ship.
// The allowlist lives in e2e/allowed-origins.mjs and mirrors nginx.conf's CSP.

async function testNoUnexpectedThirdParties() {
  const requests = [];
  page.on('request', req => {
    const url = req.url();
    if (!url.startsWith('http://localhost') && !url.startsWith('data:')) {
      requests.push(url);
    }
  });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  const unexpected = requests.filter(u => !isAllowedRequestUrl(u));
  if (unexpected.length > 0) {
    console.error(`    unexpected origins: ${unexpected.join(', ')}`);
  }
  assert(unexpected.length === 0, 'Only allowlisted third-party origins contacted');
  page.removeAllListeners('request');
}

async function testMobileNoOverflow() {
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert(scrollWidth <= clientWidth + 1, 'No horizontal overflow at 390px');
}

// Assert on the page's own heading, not on body text: the header nav links to
// About and Privacy from every route, so `body.textContent.includes('About')`
// passes even when the route silently falls through to the dashboard.
async function assertRouteHeading(path, pattern, name) {
  await page.goto(BASE + path, { waitUntil: 'networkidle0' });
  const headings = await page.$$eval('h1, h2', els => els.map(el => el.textContent.trim()));
  const matched = headings.some(h => pattern.test(h));
  if (!matched) {
    console.error(`    headings found: ${JSON.stringify(headings)}`);
  }
  assert(matched, name);
}

async function testAboutRoute() {
  await assertRouteHeading('about', /About\s+SHiFT Vault/i, 'About page renders its own heading');
}

async function testPrivacyRoute() {
  await assertRouteHeading('privacy', /Privacy Policy/i, 'Privacy page renders its own heading');
}

async function test404Route() {
  await page.goto(BASE + 'nonexistent', { waitUntil: 'networkidle0' });
  const text = await page.$eval('body', el => el.textContent.toLowerCase());
  assert(text.includes('not found') || text.includes('404'), '404 page renders');
}

async function testCopyButton() {
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  const btn = await page.$('button[aria-label*="Copy"]');
  if (btn) {
    await btn.click();
    await new Promise(r => setTimeout(r, 500));
    const text = await page.$eval('body', el => el.textContent);
    assert(text.includes('Copied') || text.includes('copied'), 'Copy button provides feedback');
  } else {
    assert(false, 'Copy button exists');
  }
}

async function main() {
  await setup();
  try {
    await testDashboardLoads();
    await testNoUnexpectedThirdParties();
    await testMobileNoOverflow();
    await testAboutRoute();
    await testPrivacyRoute();
    await test404Route();
    await testCopyButton();
  } finally {
    await teardown();
  }

  console.log('\n=== Puppeteer Smoke Results ===');
  let passed = 0, failed = 0;
  for (const r of results) {
    if (r.pass) {
      console.log(`  ✓ ${r.name}`);
      passed++;
    } else {
      console.log(`  ✗ ${r.name}`);
      failed++;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
