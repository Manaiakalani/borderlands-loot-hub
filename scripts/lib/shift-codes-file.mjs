/**
 * Shared helpers for safely reading and writing src/data/shiftCodes.ts.
 *
 * The auto-fetch scripts (game8, reddit, twitter) all insert new code objects
 * into the `mockShiftCodes` array. A historical bug inserted objects *inside*
 * the `ShiftCode[]` type annotation, producing invalid TypeScript that broke
 * the build on `main` (and had to be hand-repaired more than once). These
 * helpers centralise the insertion logic and validate the result before it can
 * be written, so a bad insert fails the workflow loudly instead of corrupting
 * the file.
 */

import { readFileSync, writeFileSync } from 'fs';

/** The exact declaration of the codes array. Used as the insertion anchor. */
export const ARRAY_ANCHOR = 'export const mockShiftCodes: ShiftCode[] = [';

/** Matches a `code: 'XXXXX-...'` field, used to count/extract existing codes. */
const CODE_FIELD_REGEX = /code:\s*['"]([A-Z0-9-]+)['"]/gi;

export function readShiftCodesFile(path) {
  return readFileSync(path, 'utf-8');
}

/** Returns a Set of all SHiFT code strings already present in the file. */
export function extractExistingCodeStrings(content) {
  const codes = new Set();
  for (const match of content.matchAll(CODE_FIELD_REGEX)) {
    codes.add(match[1].toUpperCase());
  }
  return codes;
}

/** Number of `code:` entries currently in the file. */
function countCodeEntries(content) {
  return [...content.matchAll(CODE_FIELD_REGEX)].length;
}

/**
 * Validate the structural integrity of shiftCodes.ts. Throws if the file looks
 * corrupted. This is the safety net that prevents committing broken TypeScript.
 */
export function assertValidShiftCodesFile(content) {
  const anchorCount = content.split(ARRAY_ANCHOR).length - 1;
  if (anchorCount !== 1) {
    throw new Error(
      `Expected exactly one mockShiftCodes anchor ("${ARRAY_ANCHOR}"), found ${anchorCount}. ` +
        'Refusing to write to avoid corrupting the file.',
    );
  }

  // Detect the exact corruption pattern seen previously: code objects wedged
  // inside the `ShiftCode[ ... ]` type annotation, e.g. `},] = [`.
  if (/ShiftCode\[\s*(?:\/\/|\{)/.test(content) || /\}\s*,?\s*\]\s*=\s*\[/.test(content)) {
    throw new Error(
      'Detected malformed array declaration (code objects inside the type annotation). ' +
        'Refusing to write.',
    );
  }

  // The array must still close with `];`.
  if (!content.trimEnd().endsWith('];')) {
    throw new Error(
      'shiftCodes.ts no longer ends with a closing "];" for the array. Refusing to write.',
    );
  }
}

/**
 * Insert a block of pre-formatted entry text immediately after the array anchor
 * and return the new file content. Validates the result and (optionally) that
 * the code-entry count grew by exactly `expectedNewCount`.
 */
export function insertEntriesAfterAnchor(content, entriesBlock, expectedNewCount) {
  if (!content.includes(ARRAY_ANCHOR)) {
    throw new Error(
      `Could not find the mockShiftCodes array anchor ("${ARRAY_ANCHOR}") in shiftCodes.ts. ` +
        'The file may be corrupted; refusing to write.',
    );
  }

  const before = countCodeEntries(content);
  const normalised = entriesBlock.replace(/^\n+/, '').replace(/\n+$/, '');
  const updated = content.replace(ARRAY_ANCHOR, `${ARRAY_ANCHOR}\n${normalised}\n`);

  assertValidShiftCodesFile(updated);

  if (typeof expectedNewCount === 'number') {
    const after = countCodeEntries(updated);
    if (after - before !== expectedNewCount) {
      throw new Error(
        `Entry-count sanity check failed: expected +${expectedNewCount} codes, ` +
          `but the file changed by ${after - before}. Refusing to write.`,
      );
    }
  }

  return updated;
}

/** Validate then write content to disk. */
export function writeShiftCodesFile(path, content) {
  assertValidShiftCodesFile(content);
  writeFileSync(path, content, 'utf-8');
}
