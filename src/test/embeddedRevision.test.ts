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

  it("hashes every field that appears in the real dataset", () => {
    // Guards against the revision drifting back to an enumerated subset of
    // fields. Deriving the expected set from the committed data rather than from
    // this file's fixture matters: the fixture omits the optional `keys` and
    // `isUniversal` fields, so checking against it would pass while those went
    // unhashed — which is the exact bug this test exists to catch.
    const realFields = new Set<string>();
    for (const code of mockShiftCodes) {
      for (const key of Object.keys(code)) realFields.add(key);
    }
    expect(realFields.size).toBeGreaterThan(6);

    for (const field of realFields) {
      const entry = mockShiftCodes.find(
        (c) => (c as unknown as Record<string, unknown>)[field] !== undefined,
      )!;
      const others = mockShiftCodes.slice(0, 3).filter((c) => c.id !== entry.id);
      const mutated = {
        ...entry,
        [field]: typeof (entry as unknown as Record<string, unknown>)[field] === "boolean"
          ? !(entry as unknown as Record<string, boolean>)[field]
          : `__mutated_${field}__`,
      } as ShiftCode;

      expect(computeEmbeddedRevision([...others, entry])).not.toBe(
        computeEmbeddedRevision([...others, mutated]),
      );
    }
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
