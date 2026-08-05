import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

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

/**
 * Opacity-modified text utilities were invisible to the checks above, which only
 * read opaque tokens. `text-muted-foreground/70` in the footer composited to
 * 3.85:1 — below AA — while `--muted-foreground` itself measured a comfortable
 * 6.63:1. This suite composites the alpha against each plausible backdrop and
 * checks the colour a user actually sees.
 */

function composite(
  fg: [number, number, number],
  bg: [number, number, number],
  alpha: number,
): [number, number, number] {
  return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))) as [number, number, number];
}

function compositeContrast(fgToken: string, alpha: number, bgToken: string): number {
  const bg = hslToRgb(token(bgToken));
  const blended = composite(hslToRgb(token(fgToken)), bg, alpha);
  const la = relativeLuminance(blended);
  const lb = relativeLuminance(bg);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const TSX_SOURCES = (() => {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tsx")) found.push(full);
    }
  };
  walk(resolve(process.cwd(), "src"));
  return found;
})();

/** Text utilities whose colour resolves to a CSS custom property in index.css. */
const ALPHA_TEXT_PATTERN = /(?:^|[\s"'`:])((?:[a-z-]+:)*)text-([a-z-]+)\/(\d{1,3})\b/g;

const alphaTextUsages = TSX_SOURCES.flatMap((file) => {
  const content = readFileSync(file, "utf8");
  return [...content.matchAll(ALPHA_TEXT_PATTERN)]
    .map((m) => ({ variant: m[1], name: m[2], alpha: Number(m[3]) / 100, file }))
    // Interactive-state colours are checked too, but only when the token exists
    // as an HSL custom property — Tailwind palette colours (slate-400) are not.
    .filter(({ name }) => new RegExp(`--${name}:\\s*[\\d.]+\\s`).test(css));
});

describe("alpha-composited text contrast (WCAG AA)", () => {
  it("finds the alpha-modified text utilities in the source", () => {
    // Without this the suite would pass vacuously if the scan regex broke.
    expect(alphaTextUsages.length).toBeGreaterThan(0);
  });

  it("composites correctly against a known case", () => {
    // muted-foreground at full opacity must equal the opaque measurement.
    expect(compositeContrast("muted-foreground", 1, "background")).toBeCloseTo(
      contrast("muted-foreground", "background"),
      5,
    );
  });

  it.each(["background", "card", "muted"])(
    "keeps every alpha-modified text utility above 4.5:1 on --%s",
    (surface) => {
      const failures = alphaTextUsages
        .map((usage) => ({
          ...usage,
          ratio: compositeContrast(usage.name, usage.alpha, surface),
        }))
        .filter(({ ratio }) => ratio < AA_NORMAL)
        .map(
          ({ variant, name, alpha, ratio, file }) =>
            `${variant}text-${name}/${Math.round(alpha * 100)} = ${ratio.toFixed(2)}:1 in ${file
              .split(/[\\/]/)
              .slice(-2)
              .join("/")}`,
        );

      expect(failures).toEqual([]);
    },
  );
});
