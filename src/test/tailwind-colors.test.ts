import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import resolveConfig from "tailwindcss/resolveConfig";
import tailwindConfig from "../../tailwind.config";

/**
 * Dead colour-class guard.
 *
 * `vault-gold` was referenced by ~44 utilities across About, Privacy and Footer
 * but was never declared in tailwind.config.ts, so Tailwind emitted no rule for
 * any of them. The visible damage was silent: gold headings fell back to plain
 * foreground, and `bg-vault-gold text-slate-900` step badges rendered near-black
 * text on a dark card. Nothing failed — the classes simply did not exist.
 *
 * This test resolves the real Tailwind config and asserts that every colour
 * utility in the source maps to a colour that actually exists.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resolved = resolveConfig(tailwindConfig as any);

function flattenColors(colors: Record<string, unknown>, prefix = ""): Set<string> {
  const names = new Set<string>();
  for (const [key, value] of Object.entries(colors)) {
    const name = prefix ? `${prefix}-${key}` : key;
    if (typeof value === "string") {
      names.add(key === "DEFAULT" && prefix ? prefix : name);
    } else if (value && typeof value === "object") {
      for (const child of flattenColors(value as Record<string, unknown>, name)) {
        names.add(child);
      }
    }
  }
  return names;
}

const KNOWN_COLORS = flattenColors(resolved.theme?.colors ?? {});

const COLOR_PREFIXES = [
  "text",
  "bg",
  "border",
  "fill",
  "stroke",
  "ring",
  "divide",
  "outline",
  "decoration",
  "caret",
  "accent",
  "placeholder",
  "from",
  "via",
  "to",
];

const UTILITY_PATTERN = new RegExp(
  `\\b(?:${COLOR_PREFIXES.join("|")})-([a-z][a-z0-9]*(?:-[a-z0-9]+)*)(?:\\/\\d{1,3})?\\b`,
  "g",
);

/**
 * Suffixes these prefixes accept that are *not* colours. Kept explicit rather
 * than heuristic: if a new non-colour utility shows up it fails here and gets
 * added deliberately, which is the safer direction to be wrong in.
 */
const NON_COLOR_SUFFIXES = [
  /^\d+(\.\d+)?$/, // border-2, ring-offset-2
  /^(xs|sm|base|lg|xl|[2-9]xl)$/, // text-sm, text-2xl
  /^(left|center|right|justify|start|end)$/, // text-center
  /^(wrap|nowrap|balance|pretty|ellipsis|clip)$/, // text-balance
  /^(none|auto|solid|dashed|dotted|double|hidden)$/, // outline-none
  /^gradient-to-[a-z]{1,2}$/, // bg-gradient-to-r
  /^[trblxyse]$/, // border-b
  /^(top|bottom|left|right)-\d+$/, // tailwindcss-animate: from-top-2
  /^gradient-vault$/, // .text-gradient-vault, a hand-written utility in index.css
];

/** Strips side/offset qualifiers so `border-t-transparent` resolves as `transparent`. */
function normalizeSuffix(suffix: string): string {
  return suffix.replace(/^(?:[trblxyse]|offset)-/, "");
}

function isKnownColor(suffix: string): boolean {
  const normalized = normalizeSuffix(suffix);
  return KNOWN_COLORS.has(normalized) || KNOWN_COLORS.has(suffix);
}

function isExempt(suffix: string): boolean {
  const normalized = normalizeSuffix(suffix);
  return NON_COLOR_SUFFIXES.some((p) => p.test(suffix) || p.test(normalized));
}

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

const SRC = resolve(process.cwd(), "src");

const usages = (() => {
  const byClass = new Map<string, string[]>();
  for (const file of sourceFiles(SRC)) {
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(UTILITY_PATTERN)) {
      const suffix = match[1];
      if (isExempt(suffix)) continue;
      const relative = file.slice(SRC.length + 1).replace(/\\/g, "/");
      const existing = byClass.get(suffix);
      if (existing) existing.push(relative);
      else byClass.set(suffix, [relative]);
    }
  }
  return byClass;
})();

describe("tailwind colour utilities", () => {
  it("resolves a meaningful number of colour names from the config", () => {
    // Guards the guard: if resolveConfig ever returns an empty palette the
    // per-class assertions below would all pass vacuously.
    expect(KNOWN_COLORS.size).toBeGreaterThan(50);
    expect(KNOWN_COLORS.has("primary")).toBe(true);
    expect(KNOWN_COLORS.has("slate-900")).toBe(true);
  });

  it("declares the vault-gold brand alias", () => {
    expect(KNOWN_COLORS.has("vault-gold")).toBe(true);
  });

  it("rejects a colour that does not exist", () => {
    expect(isKnownColor("definitely-not-a-colour")).toBe(false);
  });

  it("scans the real source tree", () => {
    expect(usages.size).toBeGreaterThan(10);
  });

  it("has no utility referencing an undefined colour", () => {
    const dead = [...usages.entries()]
      .filter(([suffix]) => !isKnownColor(suffix))
      .map(([suffix, files]) => `${suffix} (used in ${[...new Set(files)].join(", ")})`);

    expect(dead).toEqual([]);
  });
});
