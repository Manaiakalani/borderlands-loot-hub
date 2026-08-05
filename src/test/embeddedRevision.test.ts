import { describe, it, expect } from "vitest";
import { computeEmbeddedRevision } from "@/hooks/useShiftCodes";
import { mockShiftCodes, type ShiftCode } from "@/data/shiftCodes";

/**
 * Cache-invalidation regression guard.
 *
 * The revision used to be `length + firstId + lastId`. That is blind to edits of
 * existing entries: six corrupt expiry dates were fixed in the embedded data and
 * every returning visitor would have kept the broken values from localStorage for
 * the full 7-day cache window, because the revision string never changed.
 */

const base: ShiftCode = {
  id: "a",
  code: "AAAA1-BBBBB-CCCCC-DDDDD-EEEEE",
  game: "BL4",
  status: "active",
  reward: "5 Golden Keys",
  rewardType: "golden-keys",
  source: "test",
  addedAt: "2026-01-01",
  expiresAt: "2026-02-01",
};

const other: ShiftCode = { ...base, id: "b", code: "ZZZZ9-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ" };

/** A distinct value for each field, used to prove every field is hashed. */
const FIELD_PATCHES: Array<[string, Partial<ShiftCode>]> = [
  ["id", { id: "a2" }],
  ["code", { code: "QQQQ7-QQQQQ-QQQQQ-QQQQQ-QQQQQ" }],
  ["game", { game: "BL3" }],
  ["status", { status: "expired" }],
  ["reward", { reward: "3 Golden Keys" }],
  ["rewardType", { rewardType: "skeleton-keys" }],
  ["source", { source: "reddit/r/Borderlands4" }],
  ["addedAt", { addedAt: "2026-01-02" }],
  ["expiresAt", { expiresAt: "2027-01-01" }],
  ["expiresAt cleared", { expiresAt: null }],
];

describe("computeEmbeddedRevision", () => {
  it("is stable for identical input", () => {
    expect(computeEmbeddedRevision([base, other])).toBe(computeEmbeddedRevision([base, other]));
  });

  it.each(FIELD_PATCHES)("changes when a middle entry's %s changes", (_label, patch) => {
    // Patch the *middle* entry specifically: the original length+firstId+lastId
    // scheme could still see a change to the first or last entry's id, so an
    // edit in the middle is the case that scheme was blind to.
    const last = { ...base, id: "z" };
    const before = computeEmbeddedRevision([other, base, last]);
    const after = computeEmbeddedRevision([other, { ...base, ...patch }, last]);
    expect(after).not.toBe(before);
  });

  it("hashes every field of ShiftCode, including any added later", () => {
    // Guards against the revision drifting back to an enumerated subset of
    // fields. An explicit list silently stops covering new fields, so a later
    // correction to one of them would again be invisible to cached clients.
    const covered = new Set(
      FIELD_PATCHES.flatMap(([, patch]) => Object.keys(patch)),
    );
    const actualFields = Object.keys(base);
    expect([...actualFields].sort()).toEqual([...covered].sort());
  });

  it("changes when the collection length changes", () => {
    expect(computeEmbeddedRevision([base])).not.toBe(computeEmbeddedRevision([base, other]));
  });

  it("changes when entries are reordered", () => {
    expect(computeEmbeddedRevision([base, other])).not.toBe(computeEmbeddedRevision([other, base]));
  });

  it("produces a compact, storable string for the real dataset", () => {
    const revision = computeEmbeddedRevision(mockShiftCodes);
    expect(revision).toMatch(/^\d+-[0-9a-z]+$/);
    expect(revision.length).toBeLessThan(32);
    expect(revision.startsWith(`${mockShiftCodes.length}-`)).toBe(true);
  });
});
