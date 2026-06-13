#!/usr/bin/env node
/**
 * One-shot importer: fetch SHiFT codes from mentalmars + progameguides,
 * dedupe against existing src/data/shiftCodes.ts, and append the new ones.
 *
 * Run from repo root:  node scripts/import-from-mentalmars.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import {
  readShiftCodesFile,
  extractExistingCodeStrings,
  insertEntriesAfterAnchor,
  writeShiftCodesFile,
  escapeTsString,
} from './lib/shift-codes-file.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHIFT_CODES_PATH = path.join(__dirname, '../src/data/shiftCodes.ts');

const SHIFT_CODE_REGEX = /\b([A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5})\b/g;

const SOURCES = [
  { game: 'BL4', source: 'mentalmars.com', url: 'https://mentalmars.com/game-news/borderlands-4-shift-codes/' },
  { game: 'WONDERLANDS', source: 'mentalmars.com', url: 'https://mentalmars.com/game-news/tiny-tinas-wonderlands-shift-codes/' },
  { game: 'BL2', source: 'mentalmars.com', url: 'https://mentalmars.com/game-news/borderlands-2-golden-keys/' },
  { game: 'BL3', source: 'mentalmars.com', url: 'https://mentalmars.com/game-news/borderlands-3-golden-keys/' },
  { game: 'TPS', source: 'progameguides.com', url: 'https://progameguides.com/borderlands/borderlands-the-pre-sequel-shift-codes/' },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const stripHtml = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8217;/g, "'").replace(/&#?[a-z0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

function extractContext(html, code) {
  const idx = html.indexOf(code);
  if (idx === -1) return '';
  const start = Math.max(0, idx - 400);
  const end = Math.min(html.length, idx + 400);
  return stripHtml(html.slice(start, end));
}

function detectReward(ctx) {
  const lower = ctx.toLowerCase();
  // Try to find "N golden key/skeleton key/diamond key" first
  const keyMatch = ctx.match(/(\d+)\s*(golden|skeleton|diamond)?\s*key/i);
  if (keyMatch) {
    const n = parseInt(keyMatch[1], 10);
    const kind = (keyMatch[2] || 'golden').toLowerCase();
    const cap = kind.charAt(0).toUpperCase() + kind.slice(1);
    return { reward: `${n} ${cap} Key${n > 1 ? 's' : ''}`, rewardType: `${kind}-keys`, keys: n };
  }
  if (/skin|cosmetic|head|outfit/i.test(lower)) return { reward: 'Cosmetic Reward', rewardType: 'cosmetic' };
  if (/weapon|gun|legendary/i.test(lower)) return { reward: 'Weapon Reward', rewardType: 'weapon' };
  return { reward: 'SHiFT Reward', rewardType: 'other' };
}

function detectExpiration(ctx) {
  const lower = ctx.toLowerCase();
  if (/permanent|never\s+expires?|no\s+expiration|indefinite|unknown/i.test(lower)) return null;
  // Match dates like "December 31, 2026" or "12/31/2026" or "Dec 31, 2026"
  const m = ctx.match(/((?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4})/i)
    || ctx.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
  if (m) {
    const d = new Date(m[1]);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

async function fetchSource({ game, source, url }) {
  console.log(`📡 ${game} ← ${url}`);
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const html = await res.text();
  if (html.length < 50000) throw new Error(`${url}: only ${html.length} bytes (Cloudflare?)`);
  const codes = [...new Set([...html.matchAll(SHIFT_CODE_REGEX)].map(m => m[1].toUpperCase()))];
  console.log(`   found ${codes.length} unique codes`);
  return codes.map(code => {
    const ctx = extractContext(html, code);
    const { reward, rewardType, keys } = detectReward(ctx);
    return { code, game, source, reward, rewardType, keys, expiresAt: detectExpiration(ctx) };
  });
}

function readExisting() {
  const content = readShiftCodesFile(SHIFT_CODES_PATH);
  return { content, set: extractExistingCodeStrings(content) };
}

function buildEntry(c, today) {
  const idCore = c.code.replace(/-/g, '').slice(0, 10).toLowerCase();
  const id = `mm-${c.game.toLowerCase()}-${idCore}`;
  const status = c.expiresAt && new Date(c.expiresAt) < new Date() ? 'expired' : 'unknown';
  const lines = [
    `  {`,
    `    id: '${id}',`,
    `    code: '${c.code}',`,
    `    game: '${c.game}',`,
    `    status: '${status}',`,
    `    reward: '${escapeTsString(c.reward)}',`,
    `    rewardType: '${c.rewardType}',`,
  ];
  if (c.keys) lines.push(`    keys: ${c.keys},`);
  lines.push(
    `    source: '${c.source}',`,
    `    addedAt: '${today}',`,
    `    lastVerifiedAt: '${today}',`,
    `    expiresAt: ${c.expiresAt ? `'${c.expiresAt}'` : 'null'},`,
    `    isUniversal: false,`,
    `  },`,
  );
  return lines.join('\n');
}

async function main() {
  const all = [];
  for (const src of SOURCES) {
    try { all.push(...await fetchSource(src)); }
    catch (e) { console.error(`   ❌ ${e.message}`); }
    await new Promise(r => setTimeout(r, 1000));
  }
  // Dedupe within fetched batch (same code might appear under multiple games on a single page)
  const byCode = new Map();
  for (const c of all) {
    const existing = byCode.get(c.code);
    // Prefer entries where we detected an expiration or a key count
    if (!existing || (c.expiresAt && !existing.expiresAt) || (c.keys && !existing.keys)) {
      byCode.set(c.code, c);
    }
  }
  const fetched = [...byCode.values()];
  console.log(`\n📊 Total fetched: ${fetched.length} unique codes`);

  const { content, set } = readExisting();
  console.log(`📁 Existing in shiftCodes.ts: ${set.size}`);

  const newCodes = fetched.filter(c => !set.has(c.code));
  console.log(`✨ New codes to add: ${newCodes.length}`);
  if (newCodes.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);
  const byGame = new Map();
  for (const c of newCodes) {
    if (!byGame.has(c.game)) byGame.set(c.game, []);
    byGame.get(c.game).push(c);
  }

  const blocks = [];
  for (const [game, list] of byGame) {
    blocks.push(`  // ============================================`);
    blocks.push(`  // ${game} - Auto-imported from ${list[0].source} (${today})`);
    blocks.push(`  // ============================================`);
    for (const c of list) blocks.push(buildEntry(c, today));
  }
  const insert = blocks.join('\n') + '\n';

  // Insert right after the array anchor; validated before writing.
  const updated = insertEntriesAfterAnchor(content, insert, newCodes.length);
  writeShiftCodesFile(SHIFT_CODES_PATH, updated);

  console.log(`\n✅ Inserted ${newCodes.length} new codes:`);
  const counts = {};
  for (const c of newCodes) counts[c.game] = (counts[c.game] || 0) + 1;
  for (const [g, n] of Object.entries(counts)) console.log(`   ${g}: ${n}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
