import { describe, it, expect } from "vitest";
import { mockShiftCodes } from "@/data/shiftCodes";

/**
 * Embedded data integrity guard.
 *
 * Six entries shipped with expiry dates a broken yearless-date parser had invented
 * — `2001-07-07`, two literal `+1 year` strings coerced to `2048-01-01`, and three
 * more `2048-01-01` values. Five of them rendered as *live* codes. Nothing in the
 * test suite looked at the committed data, so the corruption was invisible.
 *
 * These assertions run against the real dataset on every test run.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHIFT_CODE = /^[A-Z0-9]{5}(-[A-Z0-9]{5}){4}$/;

/** Anything outside this window is a parser artefact, not a real SHiFT expiry. */
const MIN_YEAR = 2019; // SHiFT predates BL3, but nothing in this dataset is older
const MAX_YEAR = new Date().getUTCFullYear() + 6;

describe("embedded shiftCodes dataset", () => {
  it("is non-trivial", () => {
    // Guards the guard: an empty import would make everything below vacuous.
    expect(mockShiftCodes.length).toBeGreaterThan(100);
  });

  it("has unique ids", () => {
    const ids = mockShiftCodes.map((c) => c.id);
    expect(ids.length - new Set(ids).size).toBe(0);
  });

  it("has well-formed SHiFT codes", () => {
    const malformed = mockShiftCodes.filter((c) => !SHIFT_CODE.test(c.code)).map((c) => c.id);
    expect(malformed).toEqual([]);
  });

  it("has a valid calendar addedAt for every entry", () => {
    const bad = mockShiftCodes
      .filter((c) => !ISO_DATE.test(c.addedAt) || Number.isNaN(Date.parse(`${c.addedAt}T00:00:00Z`)))
      .map((c) => `${c.id}: ${c.addedAt}`);
    expect(bad).toEqual([]);
  });

  it("has no expiry outside a plausible window", () => {
    const bad = mockShiftCodes
      .filter((c) => {
        if (c.expiresAt == null) return false;
        if (!ISO_DATE.test(c.expiresAt.slice(0, 10))) return true;
        const year = Number(c.expiresAt.slice(0, 4));
        return year < MIN_YEAR || year > MAX_YEAR;
      })
      .map((c) => `${c.id}: ${c.expiresAt}`);
    expect(bad).toEqual([]);
  });

  it("has no active entry whose expiry predates its own addedAt", () => {
    // Deliberately time-independent. An "expired before it was even recorded"
    // entry is corruption; an entry that merely lapsed since is normal, and
    // getEffectiveStatus() already downgrades it at render time. Comparing
    // against Date.now() here would make CI fail spontaneously the day any
    // legitimately-active code lapsed, which would also block the scraper
    // workflows that run this suite before committing.
    const bad = mockShiftCodes
      .filter(
        (c) =>
          c.status === "active" &&
          c.expiresAt != null &&
          Date.parse(c.expiresAt) < Date.parse(`${c.addedAt}T00:00:00Z`),
      )
      .map((c) => `${c.id}: added ${c.addedAt}, expires ${c.expiresAt}`);
    expect(bad).toEqual([]);
  });

  it("carries no lastVerifiedAt claim", () => {
    // Removed in DATA_VERSION 6: nothing in this repo redeems a code to verify it.
    const stamped = mockShiftCodes
      .filter((c) => "lastVerifiedAt" in c)
      .map((c) => c.id);
    expect(stamped).toEqual([]);
  });
});
