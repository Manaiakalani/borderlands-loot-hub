import { describe, it, expect } from "vitest";
import { DATA_CONFIG, DATA_VERSION, STORAGE_KEYS, deriveDataSource } from "@/config/dataConfig";

describe("deriveDataSource", () => {
  // Regression: VITE_DATA_SOURCE_URL was documented in .env.example but
  // dataConfig hardcoded DATA_SOURCE_URL to '' and USE_REMOTE_DATA to false, so
  // setting the variable did nothing at all. These cases exercise the derivation
  // with real inputs — the old hardcoded config fails the first one outright.
  it("enables remote data when a URL is provided", () => {
    expect(deriveDataSource("https://example.com/codes.json")).toEqual({
      useRemote: true,
      url: "https://example.com/codes.json",
    });
  });

  it("stays on embedded data for an empty, missing or blank value", () => {
    expect(deriveDataSource("")).toEqual({ useRemote: false, url: "" });
    expect(deriveDataSource(undefined)).toEqual({ useRemote: false, url: "" });
    expect(deriveDataSource(null)).toEqual({ useRemote: false, url: "" });
    expect(deriveDataSource("   ")).toEqual({ useRemote: false, url: "" });
  });

  it("trims surrounding whitespace so a padded value still works", () => {
    // A trailing newline in a .env file is easy to introduce and must not become
    // part of the request URL.
    expect(deriveDataSource("  https://example.com/codes.json\n")).toEqual({
      useRemote: true,
      url: "https://example.com/codes.json",
    });
  });

  it("keeps useRemote and url consistent for any input", () => {
    for (const input of ["", "  ", "https://a.test/x.json", undefined, null]) {
      const { useRemote, url } = deriveDataSource(input);
      expect(useRemote).toBe(url.length > 0);
    }
  });
});

describe("dataConfig", () => {
  it("defaults to embedded data when no remote URL is configured", () => {
    // No VITE_DATA_SOURCE_URL is set in the test environment.
    expect(DATA_CONFIG.DATA_SOURCE_URL).toBe("");
    expect(DATA_CONFIG.USE_REMOTE_DATA).toBe(false);
  });

  it("keeps cache shorter than the staleness threshold", () => {
    // A cache that outlives the stale threshold would let the UI show a
    // "data may be outdated" warning it can never clear on its own.
    expect(DATA_CONFIG.CACHE_DURATION_MS).toBeLessThan(DATA_CONFIG.STALE_THRESHOLD_MS);
  });

  it("exposes a positive integer data version", () => {
    expect(Number.isInteger(DATA_VERSION)).toBe(true);
    expect(DATA_VERSION).toBeGreaterThan(0);
  });

  it("uses distinct storage keys", () => {
    const keys = Object.values(STORAGE_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
