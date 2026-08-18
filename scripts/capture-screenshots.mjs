import { chromium, devices } from "@playwright/test";
import { spawn } from "child_process";
import { mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCREENSHOTS = path.join(ROOT, "docs", "screenshots");
const SETTLE_MS = 2500;

mkdirSync(SCREENSHOTS, { recursive: true });

function startViteAndGetUrl() {
  return new Promise((resolve, reject) => {
    const vite = spawn("npx", ["vite"], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    let resolved = false;
    let outputBuf = "";
    const timeout = setTimeout(() => {
      if (!resolved) reject(new Error("Timed out waiting for Vite Local URL"));
    }, 30_000);

    const processChunk = (text) => {
      if (resolved) return;
      outputBuf += text;
      const clean = outputBuf.replace(/\x1b\[[0-9;]*m/g, "");
      const m = clean.match(/Local:\s+(http:\/\/localhost:\d+\/\S*)/);
      if (m) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ url: m[1], vite });
      }
    };

    vite.stdout.on("data", (d) => processChunk(d.toString()));
    vite.stderr.on("data", (d) => processChunk(d.toString()));
    vite.on("error", reject);
    vite.on("exit", (code) => {
      if (!resolved) reject(new Error(`Vite exited with code ${code}`));
    });
  });
}

function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch { /* not ready */ }
      if (Date.now() - start > timeoutMs) return reject(new Error("Dev server timeout"));
      setTimeout(check, 500);
    };
    check();
  });
}

const { url: BASE_URL, vite } = await startViteAndGetUrl();

async function cleanup() {
  vite.kill("SIGTERM");
}

try {
  await waitForServer(BASE_URL);
  const browser = await chromium.launch();

  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(BASE_URL, { waitUntil: "load", timeout: 60_000 });
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: path.join(SCREENSHOTS, "desktop-hero.png"), fullPage: false });
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent: devices["iPhone 14"].userAgent,
    });
    const page = await ctx.newPage();
    await page.goto(BASE_URL, { waitUntil: "load", timeout: 60_000 });
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: path.join(SCREENSHOTS, "mobile-view.png"), fullPage: false });
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(BASE_URL, { waitUntil: "load", timeout: 60_000 });
    await page.waitForTimeout(SETTLE_MS);
    const filter = page.getByRole("button", { name: /BL4/i }).first();
    if (await filter.count()) {
      await filter.click();
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: path.join(SCREENSHOTS, "game-filter.png"), fullPage: false });
    await ctx.close();
  }

  await browser.close();
  console.log("screenshots written to", SCREENSHOTS);
} finally {
  await cleanup();
}
