import { describe, it, expect } from "vitest";
import { DATA_CONFIG, DATA_VERSION, STORAGE_KEYS } from "@/config/dataConfig";

describe("dataConfig", () => {
  // Regression: VITE_DATA_SOURCE_URL was documented in .env.example but
  // dataConfig hardcoded DATA_SOURCE_URL to '', so setting it did nothing.
  // USE_REMOTE_DATA must now be derived from the URL, never hardcoded.
  it("derives USE_REMOTE_DATA from the configured source URL", () => {
    expect(DATA_CONFIG.USE_REMOTE_DATA).toBe(DATA_CONFIG.DATA_SOURCE_URL.length > 0);
  });

  it("defaults to embedded data when no remote URL is configured", () => {
    // No VITE_DATA_SOURCE_URL is set in the test environment.
    expect(DATA_CONFIG.DATA_SOURCE_URL).toBe("");
    expect(DATA_CONFIG.USE_REMOTE_DATA).toBe(false);
  });

  it("never carries a whitespace-only source URL", () => {
    expect(DATA_CONFIG.DATA_SOURCE_URL).toBe(DATA_CONFIG.DATA_SOURCE_URL.trim());
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
