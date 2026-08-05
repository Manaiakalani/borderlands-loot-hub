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
  code: "AAAAA-BBBBB-CCCCC-DDDDD-EEEEE",
  game: "BL4",
  status: "active",
  reward: "5 Golden Keys",
  rewardType: "golden-keys",
  source: "test",
  addedAt: "2026-01-01",
  expiresAt: "2026-02-01",
};

const other: ShiftCode = { ...base, id: "b", code: "ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ" };

describe("computeEmbeddedRevision", () => {
  it("is stable for identical input", () => {
    expect(computeEmbeddedRevision([base, other])).toBe(computeEmbeddedRevision([base, other]));
  });

  it.each([
    ["expiresAt", { expiresAt: "2048-01-01" }],
    ["expiresAt cleared", { expiresAt: null }],
    ["status", { status: "expired" as const }],
    ["reward", { reward: "3 Golden Keys" }],
    ["addedAt", { addedAt: "2026-01-02" }],
    ["code", { code: "QQQQQ-QQQQQ-QQQQQ-QQQQQ-QQQQQ" }],
    ["id", { id: "a2" }],
  ])("changes when a middle entry's %s changes", (_label, patch) => {
    // The old length+firstId+lastId scheme missed every one of these.
    const before = computeEmbeddedRevision([base, other, { ...base, id: "z" }]);
    const after = computeEmbeddedRevision([{ ...base, ...patch }, other, { ...base, id: "z" }]);
    expect(after).not.toBe(before);
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
