import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../public");
mkdirSync(outDir, { recursive: true });
const htmlPath = path.join(tmpdir(), "borderlands-og.html");
const pngPath = path.join(outDir, "og-image.png");

writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      background: radial-gradient(ellipse at 80% 0%, #3a2a08 0%, #12100b 48%, #070705 100%);
      color: #fff8e7;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      width: 1080px;
      height: 510px;
      border: 1px solid rgba(245, 184, 0, 0.35);
      border-radius: 28px;
      padding: 64px 72px;
      background: linear-gradient(180deg, rgba(245, 184, 0, 0.08), rgba(7, 7, 5, 0.15));
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .kicker { letter-spacing: 0.28em; text-transform: uppercase; color: #f5b800; font-size: 22px; font-weight: 700; }
    h1 { margin: 18px 0 0; font-size: 68px; line-height: 1.05; }
    h1 span { color: #f5b800; }
    p { margin: 18px 0 0; font-size: 28px; color: #d9cba0; max-width: 920px; }
    .row { display: flex; gap: 16px; flex-wrap: wrap; }
    .pill {
      border: 1px solid rgba(245, 184, 0, 0.4);
      background: rgba(245, 184, 0, 0.12);
      color: #ffd85c;
      border-radius: 999px;
      padding: 10px 18px;
      font-size: 20px;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="card">
    <div>
      <div class="kicker">Vault Hunter Loot</div>
      <h1><span>SHiFT</span> Vault</h1>
      <p>Active SHiFT codes for Golden Keys in Borderlands 1, 2, 3, 4, Pre-Sequel, and Wonderlands.</p>
    </div>
    <div class="row">
      <div class="pill">Daily Reddit updates</div>
      <div class="pill">One-click copy &amp; redeem</div>
    </div>
  </div>
</body>
</html>`,
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
await page.screenshot({ path: pngPath, type: "png" });
await browser.close();
console.log("wrote", pngPath);
