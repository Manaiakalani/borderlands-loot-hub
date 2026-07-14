/**
 * Puppeteer E2E smoke tests
 * Run: node e2e/puppeteer-smoke.mjs
 * Requires production build served on localhost:4173
 */
import puppeteer from 'puppeteer';

const BASE = 'http://localhost:4173/borderlands-loot-hub/';
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

async function testNoAnalytics() {
  const requests = [];
  page.on('request', req => {
    const url = req.url();
    if (!url.startsWith('http://localhost') && !url.startsWith('data:')) {
      requests.push(url);
    }
  });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  const analytics = requests.filter(u => u.includes('analytics'));
  assert(analytics.length === 0, 'No analytics requests');
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

async function testAboutRoute() {
  await page.goto(BASE + 'about', { waitUntil: 'networkidle0' });
  const text = await page.$eval('body', el => el.textContent);
  assert(text.includes('About'), 'About page renders');
}

async function testPrivacyRoute() {
  await page.goto(BASE + 'privacy', { waitUntil: 'networkidle0' });
  const text = await page.$eval('body', el => el.textContent);
  assert(text.includes('Privacy'), 'Privacy page renders');
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
    await testNoAnalytics();
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
