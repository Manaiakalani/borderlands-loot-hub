#!/usr/bin/env node
/**
 * Manual maintenance tool: prune SHiFT codes that expired long ago.
 *
 * `src/data/shiftCodes.ts` only ever grows (the fetch bots append). The app
 * intentionally still shows recently-expired codes, so this is NOT wired into
 * any workflow — run it by hand occasionally to trim very old entries.
 *
 * Usage:
 *   node scripts/prune-expired-codes.mjs               # dry-run (default), 90-day threshold
 *   node scripts/prune-expired-codes.mjs --days 180    # custom threshold
 *   node scripts/prune-expired-codes.mjs --apply       # actually write the file
 *
 * After --apply, run `npm run build` to confirm the file is still valid.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import {
  readShiftCodesFile,
  writeShiftCodesFile,
  pruneExpiredCodes,
} from './lib/shift-codes-file.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHIFT_CODES_PATH = path.join(__dirname, '../src/data/shiftCodes.ts');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const daysArg = args.indexOf('--days');
const thresholdDays = daysArg !== -1 ? parseInt(args[daysArg + 1], 10) : 90;

if (Number.isNaN(thresholdDays) || thresholdDays < 0) {
  console.error('Invalid --days value; expected a non-negative number.');
  process.exit(1);
}

const content = readShiftCodesFile(SHIFT_CODES_PATH);
const { content: pruned, removedCodes } = pruneExpiredCodes(content, { thresholdDays });

console.log(`🧹 Prune SHiFT codes expired more than ${thresholdDays} days ago`);
console.log(`   Candidates to remove: ${removedCodes.length}`);
removedCodes.forEach(c => console.log(`   - ${c}`));

if (removedCodes.length === 0) {
  console.log('\n✅ Nothing to prune.');
  process.exit(0);
}

if (!apply) {
  console.log('\nℹ️  Dry-run only. Re-run with --apply to write the changes.');
  process.exit(0);
}

writeShiftCodesFile(SHIFT_CODES_PATH, pruned);
console.log(`\n✅ Removed ${removedCodes.length} expired codes. Run "npm run build" to verify.`);
