import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Contrast regression guard.
 *
 * Three separate WCAG failures shipped in this theme (--success-foreground at
 * 2.16:1, --muted-foreground at 4.33:1, --destructive at 3.51:1) because nothing
 * checked the tokens. These tests read the real values out of index.css so a
 * future edit that darkens a foreground fails here instead of in production.
 */

// Resolved from the Vitest root rather than import.meta.url: under Vite's test
// transform import.meta.url is not a file: URL, so fileURLToPath throws.
const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

function token(name: string): [number, number, number] {
  const match = css.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
  if (!match) throw new Error(`token --${name} not found in index.css`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return light - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)) as [number, number, number];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = relativeLuminance(hslToRgb(token(a)));
  const lb = relativeLuminance(hslToRgb(token(b)));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const AA_NORMAL = 4.5;

describe("theme contrast (WCAG AA)", () => {
  it.each([
    ["foreground", "background"],
    ["foreground", "card"],
    ["card-foreground", "card"],
    ["muted-foreground", "muted"],
    ["muted-foreground", "card"],
    ["muted-foreground", "background"],
    ["success-foreground", "success"],
    ["destructive", "card"],
    ["destructive", "background"],
    ["success", "card"],
  ])("%s on %s meets 4.5:1", (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("keeps the destructive token light enough for text on dark surfaces", () => {
    // Every rendered use of --destructive is text or a low-opacity tint, so it is
    // read as a foreground colour, not a solid fill.
    const [, , lightness] = token("destructive");
    expect(lightness).toBeGreaterThanOrEqual(62);
  });
});
