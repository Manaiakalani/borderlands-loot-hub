import { describe, it, expect } from "vitest";
import {
  ARRAY_ANCHOR,
  extractExistingCodeStrings,
  insertEntriesAfterAnchor,
  assertValidShiftCodesFile,
} from "../../scripts/lib/shift-codes-file.mjs";

/**
 * A minimal but structurally-faithful shiftCodes.ts fixture: the array anchor,
 * one existing entry, and the closing `];`. This mirrors the real file's shape
 * without depending on its 6000+ lines of data.
 */
const VALID_FILE = `import { ShiftCode } from './types';

${ARRAY_ANCHOR}
  {
    id: 'existing-bl4-aaaaa',
    code: 'AAAAA-BBBBB-CCCCC-DDDDD-EEEEE',
    game: 'BL4',
    status: 'active',
    reward: 'Golden Key',
    rewardType: 'golden-keys',
    source: 'test',
    addedAt: '2026-01-01',
    isUniversal: true,
  },
];
`;

const NEW_ENTRY = `  {
    id: 'new-bl4-zzzzz',
    code: 'ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ',
    game: 'BL4',
    status: 'unknown',
    reward: 'Test',
    rewardType: 'other',
    source: 'test',
    addedAt: '2026-06-10',
    isUniversal: true,
  },`;

describe("shift-codes-file helper", () => {
  it("extracts existing code strings", () => {
    const codes = extractExistingCodeStrings(VALID_FILE);
    expect(codes.has("AAAAA-BBBBB-CCCCC-DDDDD-EEEEE")).toBe(true);
    expect(codes.size).toBe(1);
  });

  it("inserts a valid entry, keeps the anchor, and grows the count by exactly one", () => {
    const updated = insertEntriesAfterAnchor(VALID_FILE, NEW_ENTRY, 1);
    expect(updated.includes(ARRAY_ANCHOR)).toBe(true);
    expect(updated.includes("ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ")).toBe(true);
    expect(extractExistingCodeStrings(updated).size).toBe(2);
    // Result must still be a structurally valid file.
    expect(() => assertValidShiftCodesFile(updated)).not.toThrow();
  });

  it("rejects the historical corruption pattern (objects inside the type annotation)", () => {
    const corrupted = VALID_FILE.replace(
      ARRAY_ANCHOR,
      "export const mockShiftCodes: ShiftCode[\n  {\n    id: 'x',\n  },] = [",
    );
    expect(() => assertValidShiftCodesFile(corrupted)).toThrow();
  });

  it("rejects an entry-count mismatch", () => {
    expect(() => insertEntriesAfterAnchor(VALID_FILE, NEW_ENTRY, 5)).toThrow(/sanity check/i);
  });

  it("throws when the array anchor is missing", () => {
    const noAnchor = VALID_FILE.replace(ARRAY_ANCHOR, "export const mockShiftCodes = [");
    expect(() => insertEntriesAfterAnchor(noAnchor, NEW_ENTRY, 1)).toThrow(/anchor/i);
  });
});
