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
const SAFE_CODE_PATTERN = /^[A-Z0-9]{5}(?:-[A-Z0-9]{5}){4}$/;
const SAFE_GAMES = new Set(['BL1', 'BL2', 'TPS', 'BL3', 'BL4', 'WONDERLANDS']);
const SAFE_REWARD_TYPES = new Set(['golden-keys', 'skeleton-keys', 'diamond-keys', 'skin', 'cosmetic', 'weapon', 'other']);
const SAFE_STATUSES = new Set(['active', 'expired', 'unknown']);

/**
 * Escape an arbitrary (possibly scraped) string so it is safe to embed inside a
 * single-quoted TypeScript string literal. Handles backslashes and quotes, and
 * collapses newlines / strips control characters so a crafted value can't break
 * the generated file.
 */
export function escapeTsString(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim();
}

export function sanitizeText(value, { maxLength = 200, fallback = '' } = {}) {
  if (typeof value !== 'string') return fallback;

  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned || fallback;
}

export function assertValidCodeShape(code) {
  if (!code || typeof code !== 'object') {
    throw new Error('Expected a code object.');
  }

  const candidate = code;
  if (typeof candidate.id !== 'string' || candidate.id.length > 100 || candidate.id.trim() === '') {
    throw new Error('Invalid code id.');
  }

  if (typeof candidate.code !== 'string' || !SAFE_CODE_PATTERN.test(candidate.code.toUpperCase())) {
    throw new Error(`Invalid SHiFT code: ${candidate.code}`);
  }

  if (typeof candidate.game !== 'string' || !SAFE_GAMES.has(candidate.game.toUpperCase())) {
    throw new Error(`Invalid game value: ${candidate.game}`);
  }

  if (typeof candidate.status !== 'string' || !SAFE_STATUSES.has(candidate.status)) {
    throw new Error(`Invalid status: ${candidate.status}`);
  }

  if (typeof candidate.reward !== 'string' || candidate.reward.length > 200) {
    throw new Error(`Invalid reward text: ${candidate.reward}`);
  }

  if (typeof candidate.rewardType !== 'string' || !SAFE_REWARD_TYPES.has(candidate.rewardType)) {
    throw new Error(`Invalid rewardType: ${candidate.rewardType}`);
  }

  if (candidate.keys !== undefined && (!Number.isInteger(candidate.keys) || candidate.keys < 1 || candidate.keys > 99)) {
    throw new Error(`Invalid key count: ${candidate.keys}`);
  }

  if (candidate.expiresAt !== undefined && candidate.expiresAt !== null && typeof candidate.expiresAt !== 'string') {
    throw new Error(`Invalid expiresAt: ${candidate.expiresAt}`);
  }

  if (candidate.lastVerifiedAt !== undefined && candidate.lastVerifiedAt !== null && typeof candidate.lastVerifiedAt !== 'string') {
    throw new Error(`Invalid lastVerifiedAt: ${candidate.lastVerifiedAt}`);
  }

  if (typeof candidate.source !== 'string' || candidate.source.length > 200) {
    throw new Error(`Invalid source: ${candidate.source}`);
  }

  if (typeof candidate.addedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(candidate.addedAt)) {
    throw new Error(`Invalid addedAt: ${candidate.addedAt}`);
  }

  if (candidate.isUniversal !== undefined && typeof candidate.isUniversal !== 'boolean') {
    throw new Error(`Invalid isUniversal: ${candidate.isUniversal}`);
  }

  return true;
}

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

/**
 * Skip a quoted string starting at `i` (which points at the opening quote).
 * Handles backslash escapes. Returns the index just past the closing quote.
 */
function skipString(content, i, quote) {
  i++;
  while (i < content.length) {
    const ch = content[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === quote) return i + 1;
    i++;
  }
  return i;
}

/**
 * Parse the mockShiftCodes array, returning the array bracket bounds and the
 * span of every top-level entry object. Aware of `//` and block comments and of
 * string literals, so apostrophes-in-comments and brackets-in-strings can't
 * throw off the brace/bracket counting.
 */
function parseShiftCodesArray(content) {
  const anchorPos = content.indexOf(ARRAY_ANCHOR);
  if (anchorPos === -1) {
    throw new Error(`Could not find the mockShiftCodes array anchor ("${ARRAY_ANCHOR}").`);
  }
  // The array-opening "[" is the final character of the anchor (using indexOf('[')
  // would wrongly match the "[" inside the `ShiftCode[]` type annotation).
  const open = anchorPos + ARRAY_ANCHOR.length - 1;

  let i = open + 1;
  let bracketDepth = 1;
  let braceDepth = 0;
  let objStart = -1;
  let arrayClose = -1;
  const objects = [];

  while (i < content.length) {
    const ch = content[i];
    if (ch === '/' && content[i + 1] === '/') {
      const nl = content.indexOf('\n', i);
      i = nl === -1 ? content.length : nl;
      continue;
    }
    if (ch === '/' && content[i + 1] === '*') {
      const close = content.indexOf('*/', i + 2);
      i = close === -1 ? content.length : close + 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(content, i, ch);
      continue;
    }
    if (ch === '[') {
      bracketDepth++;
    } else if (ch === ']') {
      bracketDepth--;
      if (bracketDepth === 0) { arrayClose = i; break; }
    } else if (ch === '{') {
      if (braceDepth === 0) objStart = i;
      braceDepth++;
    } else if (ch === '}') {
      braceDepth--;
      if (braceDepth === 0 && objStart !== -1) {
        objects.push({ start: objStart, endBrace: i });
        objStart = -1;
      }
    }
    i++;
  }

  if (arrayClose === -1) {
    throw new Error('Could not find the closing "]" of the mockShiftCodes array.');
  }
  return { open, close: arrayClose, objects };
}

/**
 * Remove code entries whose `expiresAt` is older than `thresholdDays` before
 * `now`. Pure function: returns { content, removedCodes } without writing.
 * Entries with no `expiresAt`, or expired more recently than the threshold, are
 * kept (the app intentionally still displays recently-expired codes).
 */
export function pruneExpiredCodes(content, { thresholdDays = 90, now = new Date() } = {}) {
  const { close, objects } = parseShiftCodesArray(content);
  const cutoffMs = now.getTime() - thresholdDays * 24 * 60 * 60 * 1000;

  const removals = [];
  for (const { start, endBrace } of objects) {
    let end = endBrace + 1;
    while (end < close && /\s/.test(content[end])) end++;
    if (content[end] === ',') end++;

    const objText = content.slice(start, endBrace + 1);
    const expiresAt = (objText.match(/expiresAt:\s*'([^']+)'/) || [])[1] || null;
    const code = (objText.match(/code:\s*'([^']+)'/) || [])[1] || '?';

    if (expiresAt) {
      const expMs = new Date(expiresAt).getTime();
      if (!Number.isNaN(expMs) && expMs < cutoffMs) {
        removals.push({ start, end, code });
      }
    }
  }

  if (removals.length === 0) return { content, removedCodes: [] };

  let result = content;
  const removedCodes = [];
  for (let r = removals.length - 1; r >= 0; r--) {
    let { start } = removals[r];
    const { end, code } = removals[r];
    // Consume the indentation and the single newline preceding the object.
    while (start > 0 && (content[start - 1] === ' ' || content[start - 1] === '\t')) start--;
    if (content[start - 1] === '\n') start--;
    result = result.slice(0, start) + result.slice(end);
    removedCodes.push(code);
  }

  assertValidShiftCodesFile(result);
  return { content: result, removedCodes: removedCodes.reverse() };
}
