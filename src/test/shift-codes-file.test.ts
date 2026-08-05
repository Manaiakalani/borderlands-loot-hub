import { describe, it, expect } from "vitest";
import {
  ARRAY_ANCHOR,
  extractExistingCodeStrings,
  insertEntriesAfterAnchor,
  assertValidShiftCodesFile,
  escapeTsString,
  pruneExpiredCodes,
  assertValidCodeShape,
  sanitizeText,
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

  it("escapeTsString neutralises quotes, backslashes, newlines, and nullish input", () => {
    expect(escapeTsString("it's")).toBe("it\\'s");
    expect(escapeTsString("a\\b")).toBe("a\\\\b");
    expect(escapeTsString("line1\nline2")).toBe("line1 line2");
    expect(escapeTsString(null)).toBe("");
  });

  // Reddit post text is attacker-influenced and gets written verbatim into
  // shiftCodes.ts, which is then compiled and shipped. Escaping is the only thing
  // stopping a crafted post from injecting code, so assert the strong property:
  // whatever comes out must stay INSIDE a single-quoted literal.
  it("escapeTsString cannot break out of a single-quoted TS string literal", () => {
    const hostileInputs = [
      "'); process.exit(1); ('",
      "\\' + require('fs').readFileSync('/etc/passwd') + \\'",
      "a' , evil: 'x",
      "back\\slash",
      "trailing backslash \\",
      "line\nbreak",
      "carriage\r\nreturn",
      "null\u0000byte",
      "escape\u001b[31m",
      "template ${process.env.SECRET}",
      "backtick ` here",
      "*/ } ] ; //",
      "\u2028line separator",
      "\u2029paragraph separator",
    ];

    for (const hostile of hostileInputs) {
      const literal = `'${escapeTsString(hostile)}'`;

      // It must parse as a plain string, not as an expression that does anything.
      const parsed = (0, eval)(`(${literal})`);
      expect(typeof parsed, `input: ${JSON.stringify(hostile)}`).toBe("string");

      // No unescaped quote may survive, since that is what ends the literal.
      const body = literal.slice(1, -1);
      expect(body.replace(/\\\\/g, "").includes("\\'") || !body.includes("'")).toBe(true);

      // Control characters and newlines must never reach the generated source.
      // eslint-disable-next-line no-control-regex -- detecting control characters is the point of this assertion
      expect(/[\u0000-\u001F\u007F\n\r]/.test(body), `input: ${JSON.stringify(hostile)}`).toBe(false);
    }
  });

  it("escapeTsString escapes backslashes before quotes so the order cannot be exploited", () => {
    // If quotes were escaped first, the added backslash would then be doubled and
    // the quote would come loose. Encoding a literal backslash followed by a quote
    // is the case that catches a wrong ordering.
    const parsed = (0, eval)(`('${escapeTsString("\\'")}')`);
    expect(parsed).toBe("\\'");
  });

  it("rejects malformed code objects and sanitizes text input", () => {
    expect(() => assertValidCodeShape({
      id: 'bad-1',
      code: 'NOT-A-CODE',
      game: 'BL4',
      status: 'active',
      reward: 'reward',
      rewardType: 'golden-keys',
      source: 'test',
      addedAt: '2026-06-01',
    })).toThrow(/Invalid SHiFT code/i);

    expect(sanitizeText("  hello\u0000world  ", { maxLength: 20 })).toBe("hello world");
  });

  it("rejects date fields that are not real calendar dates", () => {
    // The generators interpolate date fields into TypeScript without
    // escapeTsString, so a quote here would break out of the string literal.
    const base = {
      id: 'date-1',
      code: 'ABCDE-FGHIJ-KLMNO-PQRST-UVWXY',
      game: 'BL4',
      status: 'active',
      reward: 'reward',
      rewardType: 'golden-keys',
      source: 'test',
      addedAt: '2026-06-01',
    };

    expect(() => assertValidCodeShape({ ...base, expiresAt: "', evil: '" })).toThrow(/expiresAt/i);
    expect(() => assertValidCodeShape({ ...base, expiresAt: 'soon' })).toThrow(/expiresAt/i);
    expect(() => assertValidCodeShape({ ...base, expiresAt: '2026-13-01' })).toThrow(/expiresAt/i);
    expect(() => assertValidCodeShape({ ...base, expiresAt: '2026-02-30' })).toThrow(/expiresAt/i);
    expect(() => assertValidCodeShape({ ...base, expiresAt: '2026-02-29' })).toThrow(/expiresAt/i); // 2026 is not a leap year
    expect(() => assertValidCodeShape({ ...base, addedAt: '2026-6-1' })).toThrow(/addedAt/i);
    expect(() => assertValidCodeShape({ ...base, addedAt: 20260601 })).toThrow(/addedAt/i);

    // The time component was previously matched as `\d{2}:\d{2}` and never
    // range-checked, so an impossible clock time sailed through.
    expect(() => assertValidCodeShape({ ...base, expiresAt: '2026-12-31T99:99' })).toThrow(/expiresAt/i);
    expect(() => assertValidCodeShape({ ...base, expiresAt: '2026-12-31T24:00' })).toThrow(/expiresAt/i);
    expect(() => assertValidCodeShape({ ...base, expiresAt: '2026-12-31T12:60' })).toThrow(/expiresAt/i);
    expect(() => assertValidCodeShape({ ...base, expiresAt: '2026-12-31T12:00:99' })).toThrow(/expiresAt/i);
    expect(() => assertValidCodeShape({ ...base, expiresAt: '2026-12-31T12:00+99:00' })).toThrow(/expiresAt/i);

    // Formats the scrapers legitimately produce must still pass.
    expect(assertValidCodeShape({ ...base, expiresAt: '2028-02-29' })).toBe(true); // 2028 is a leap year
    expect(assertValidCodeShape({ ...base, expiresAt: null })).toBe(true);
    expect(assertValidCodeShape({ ...base, expiresAt: '2026-12-31' })).toBe(true);
    expect(assertValidCodeShape({ ...base, expiresAt: '2026-12-31T23:59:59' })).toBe(true);
    expect(assertValidCodeShape({ ...base, expiresAt: '2026-12-31T23:59:59.000Z' })).toBe(true);
    expect(assertValidCodeShape({ ...base, expiresAt: '2026-12-31T23:59:60Z' })).toBe(true); // leap second
    expect(assertValidCodeShape({ ...base, expiresAt: '2026-12-31T00:00-08:00' })).toBe(true);
  });

  it("rejects lastVerifiedAt outright", () => {
    // The field was removed from ShiftCode: nothing in this repo ever redeems a
    // code to confirm it works, so it only ever produced a false "Verified" badge.
    // A stale generator that still stamps it must fail the run, not write it.
    const base = {
      id: 'lv-1',
      code: 'ABCDE-FGHIJ-KLMNO-PQRST-UVWXY',
      game: 'BL4',
      status: 'active',
      reward: 'reward',
      rewardType: 'golden-keys',
      source: 'test',
      addedAt: '2026-06-01',
    };

    expect(assertValidCodeShape(base)).toBe(true);
    expect(() => assertValidCodeShape({ ...base, lastVerifiedAt: '2026-06-01' })).toThrow(/lastVerifiedAt/i);
    expect(() => assertValidCodeShape({ ...base, lastVerifiedAt: null })).toThrow(/lastVerifiedAt/i);
  });
});

const PRUNE_FILE = `${ARRAY_ANCHOR}
  // Tiny Tina's Wonderlands codes (comment with an apostrophe + bracket ] to test the scanner)
  {
    id: 'old-1',
    code: 'OLD11-OLD11-OLD11-OLD11-OLD11',
    game: 'BL4',
    status: 'expired',
    reward: 'Old',
    rewardType: 'other',
    source: 'test',
    addedAt: '2000-01-01',
    expiresAt: '2000-01-01',
    isUniversal: true,
  },
  {
    id: 'future-1',
    code: 'NEW11-NEW11-NEW11-NEW11-NEW11',
    game: 'BL4',
    status: 'active',
    reward: 'Future',
    rewardType: 'other',
    source: 'test',
    addedAt: '2026-01-01',
    expiresAt: '2999-01-01',
    isUniversal: true,
  },
  {
    id: 'noexp-1',
    code: 'NOX11-NOX11-NOX11-NOX11-NOX11',
    game: 'BL4',
    status: 'unknown',
    reward: 'NoExpiry',
    rewardType: 'other',
    source: 'test',
    addedAt: '2026-01-01',
    expiresAt: null,
    isUniversal: true,
  },
];
`;

describe("pruneExpiredCodes", () => {
  const now = new Date("2026-06-10T00:00:00Z");

  it("removes only codes expired beyond the threshold, keeps the rest, stays valid", () => {
    const { content, removedCodes } = pruneExpiredCodes(PRUNE_FILE, { thresholdDays: 90, now });
    expect(removedCodes).toEqual(["OLD11-OLD11-OLD11-OLD11-OLD11"]);
    expect(content).not.toContain("OLD11-OLD11-OLD11-OLD11-OLD11");
    expect(content).toContain("NEW11-NEW11-NEW11-NEW11-NEW11");
    expect(content).toContain("NOX11-NOX11-NOX11-NOX11-NOX11");
    expect(extractExistingCodeStrings(content).size).toBe(2);
    expect(() => assertValidShiftCodesFile(content)).not.toThrow();
  });

  it("removes nothing when no code is old enough", () => {
    const { content, removedCodes } = pruneExpiredCodes(PRUNE_FILE, {
      thresholdDays: 100 * 365,
      now,
    });
    expect(removedCodes).toEqual([]);
    expect(content).toBe(PRUNE_FILE);
  });
});
