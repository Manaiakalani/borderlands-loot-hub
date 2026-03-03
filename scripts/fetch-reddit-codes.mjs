#!/usr/bin/env node
/**
 * Reddit SHiFT Code Scraper
 *
 * Fetches SHiFT codes from multiple Borderlands subreddits using
 * Reddit's public .json endpoints (no API key required) and writes
 * new codes directly into src/data/shiftCodes.ts.
 *
 * Usage:
 *   node scripts/fetch-reddit-codes.mjs
 *   Or via GitHub Actions (automatic daily)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHIFT_CODES_PATH = path.join(__dirname, '../src/data/shiftCodes.ts');

const USER_AGENT = 'BorderlandsLootHub/1.0 (SHiFT Code Aggregator)';

// ── Subreddits to scrape ───────────────────────────────────────────
const SUBREDDITS = [
  'Borderlands4',
  'Borderlands',
  'borderlands3',
  'Borderlandsshiftcodes',
];

// ── Patterns ───────────────────────────────────────────────────────
const SHIFT_CODE_REGEX = /\b([A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5})\b/gi;

const GAME_PATTERNS = {
  BL1: /\b(BL1|borderlands\s*1|borderlands\s*goty)\b/i,
  BL2: /\b(BL2|borderlands\s*2)\b/i,
  TPS: /\b(TPS|pre-sequel|presequel)\b/i,
  BL3: /\b(BL3|borderlands\s*3)\b/i,
  BL4: /\b(BL4|borderlands\s*4)\b/i,
  WONDERLANDS: /\b(wonderlands|ttw|tiny\s*tina)/i,
};

// Map subreddit names to default game when detection fails
const SUBREDDIT_GAME_DEFAULTS = {
  borderlands4: 'BL4',
  borderlands3: 'BL3',
  borderlands: 'BL3',
  borderlandsshiftcodes: 'BL4',
};

const REWARD_PATTERNS = {
  'golden-keys': /golden\s*key|(\d+)\s*key/i,
  'skeleton-keys': /skeleton\s*key/i,
  'diamond-keys': /diamond\s*key/i,
  'skin': /skin|outfit|head/i,
  'cosmetic': /cosmetic|echo|drone/i,
  'weapon': /weapon|gun|legendary/i,
};

// ── Helpers ────────────────────────────────────────────────────────

function detectGame(text, subreddit) {
  for (const [game, pattern] of Object.entries(GAME_PATTERNS)) {
    if (pattern.test(text)) return game;
  }
  return SUBREDDIT_GAME_DEFAULTS[subreddit.toLowerCase()] || 'BL4';
}

function detectRewardType(text) {
  for (const [type, pattern] of Object.entries(REWARD_PATTERNS)) {
    if (pattern.test(text)) return type;
  }
  return 'golden-keys';
}

function extractKeyCount(text) {
  const match = text.match(/(\d+)\s*(?:golden\s*)?key/i);
  return match ? parseInt(match[1], 10) : 1;
}

function extractRewardLabel(text) {
  const keyMatch = text.match(/(\d+)\s*(golden|skeleton|diamond)?\s*keys?/i);
  if (keyMatch) {
    const count = keyMatch[1];
    const type = keyMatch[2]?.toLowerCase() || 'golden';
    return `${count} ${type.charAt(0).toUpperCase() + type.slice(1)} Key${parseInt(count) > 1 ? 's' : ''}`;
  }
  if (/skin|head|outfit/i.test(text)) return 'Cosmetic Reward';
  if (/weapon|gun|legendary/i.test(text)) return 'Weapon Reward';
  return 'SHiFT Reward';
}

function parseExpiration(text) {
  const patterns = [
    /exp(?:ires?|iration)?[:\s]+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
    /exp(?:ires?)?[:\s]+([A-Z][a-z]+\.?\s+\d{1,2}(?:,?\s+\d{4})?)/i,
    /until\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
  ];

  const currentYear = new Date().getFullYear();

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const parsed = new Date(match[1]);
        if (!isNaN(parsed.getTime())) {
          if (parsed.getFullYear() < currentYear) {
            parsed.setFullYear(currentYear);
            if (parsed < new Date()) parsed.setFullYear(currentYear + 1);
          }
          return parsed.toISOString().split('T')[0];
        }
      } catch { /* continue */ }
    }
  }
  return null;
}

// ── Reddit API fetching ────────────────────────────────────────────

/**
 * Fetch posts from a subreddit via the public .json endpoint (no auth needed).
 */
async function fetchSubredditPosts(subreddit, sort = 'hot', limit = 100) {
  const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}`;
  console.log(`  📡 Fetching /r/${subreddit}/${sort} ...`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    console.warn(`  ⚠️  /r/${subreddit}/${sort}: ${response.status} ${response.statusText}`);
    return [];
  }

  try {
    const data = await response.json();
    return data.data.children.map(child => child.data);
  } catch {
    console.warn(`  ⚠️  /r/${subreddit}/${sort}: failed to parse JSON response`);
    return [];
  }
}

/**
 * Extract SHiFT codes from a single post.
 */
function extractCodesFromPost(post, subreddit) {
  const codes = [];
  const combinedText = `${post.title} ${post.selftext || ''}`;
  const matches = combinedText.match(SHIFT_CODE_REGEX) || [];
  const uniqueCodes = [...new Set(matches.map(c => c.toUpperCase()))];

  const game = detectGame(combinedText, subreddit);
  const rewardType = detectRewardType(combinedText);
  const keyCount = extractKeyCount(combinedText);
  const expiresAt = parseExpiration(combinedText);
  const reward = extractRewardLabel(combinedText);

  for (const code of uniqueCodes) {
    codes.push({
      code,
      game,
      reward,
      rewardType,
      keys: rewardType.endsWith('-keys') ? keyCount : undefined,
      expiresAt,
      postDate: new Date(post.created_utc * 1000).toISOString().split('T')[0],
      upvotes: post.ups,
      subreddit,
    });
  }

  return codes;
}

// ── shiftCodes.ts read / write ─────────────────────────────────────

function readExistingCodes() {
  const content = fs.readFileSync(SHIFT_CODES_PATH, 'utf-8');

  const codeStrings = new Set();
  const codeRegex = /code:\s*['"]([A-Z0-9-]+)['"]/g;
  let m;
  while ((m = codeRegex.exec(content)) !== null) {
    codeStrings.add(m[1]);
  }

  return { existingCodeStrings: codeStrings, fileContent: content };
}

function generateCodeEntry(code, index) {
  const id = `reddit-${code.game.toLowerCase()}-${code.code.substring(0, 5).toLowerCase()}-${index}`;
  const status = code.expiresAt && new Date(code.expiresAt) < new Date() ? 'expired' : 'unknown';
  const today = new Date().toISOString().split('T')[0];

  return `  {
    id: '${id}',
    code: '${code.code}',
    game: '${code.game}',
    status: '${status}',
    reward: '${(code.reward ?? 'SHiFT Reward').replace(/'/g, "\\'")}',
    rewardType: '${code.rewardType}',${code.keys ? `\n    keys: ${code.keys},` : ''}
    source: 'r/${code.subreddit}',
    addedAt: '${code.postDate}',
    lastVerifiedAt: '${today}',
    expiresAt: ${code.expiresAt ? `'${code.expiresAt}'` : 'null'},
    isUniversal: true,
  },`;
}

function writeNewCodes(fileContent, newCodes) {
  const entries = newCodes.map((c, i) => generateCodeEntry(c, i)).join('\n');
  const today = new Date().toISOString().split('T')[0];
  const sectionHeader = `// ============================================\n  // REDDIT - Auto-fetched Codes (${today})\n  // ============================================\n${entries}`;

  // Insert after the opening bracket of the array
  const updatedContent = fileContent.replace(
    'export const mockShiftCodes: ShiftCode[] = [',
    `export const mockShiftCodes: ShiftCode[] = [\n  ${sectionHeader}\n`,
  );

  fs.writeFileSync(SHIFT_CODES_PATH, updatedContent);
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('🎮 Reddit SHiFT Code Scraper');
  console.log('============================\n');

  // 1. Fetch posts from all subreddits
  const allCodes = [];

  for (const subreddit of SUBREDDITS) {
    console.log(`\n📂 r/${subreddit}`);
    try {
      const [hotPosts, newPosts] = await Promise.all([
        fetchSubredditPosts(subreddit, 'hot', 50),
        fetchSubredditPosts(subreddit, 'new', 50),
      ]);

      // Deduplicate posts
      const seenIds = new Set();
      const uniquePosts = [...hotPosts, ...newPosts].filter(p => {
        if (seenIds.has(p.id)) return false;
        seenIds.add(p.id);
        return true;
      });
      console.log(`  Found ${uniquePosts.length} unique posts`);

      for (const post of uniquePosts) {
        allCodes.push(...extractCodesFromPost(post, subreddit));
      }

      // Respect Reddit rate limits (~1 req/sec for unauthenticated)
      await new Promise(r => setTimeout(r, 2000));
    } catch (error) {
      console.error(`  ❌ Error on r/${subreddit}: ${error.message}`);
    }
  }

  // 2. Deduplicate codes globally (keep highest upvotes)
  const codeMap = new Map();
  for (const code of allCodes) {
    const existing = codeMap.get(code.code);
    if (!existing || code.upvotes > existing.upvotes) {
      codeMap.set(code.code, code);
    }
  }
  const uniqueCodes = Array.from(codeMap.values())
    .sort((a, b) => new Date(b.postDate) - new Date(a.postDate));

  console.log(`\n📊 Total unique codes found: ${uniqueCodes.length}`);

  // 3. Filter against existing codes in shiftCodes.ts
  const { existingCodeStrings, fileContent } = readExistingCodes();
  console.log(`📁 Existing codes in shiftCodes.ts: ${existingCodeStrings.size}`);

  const newCodes = uniqueCodes.filter(c => !existingCodeStrings.has(c.code));
  console.log(`✨ New codes to add: ${newCodes.length}`);

  if (newCodes.length === 0) {
    console.log('\n✅ No new codes found. File unchanged.');
    return;
  }

  // 4. Write new codes to shiftCodes.ts
  writeNewCodes(fileContent, newCodes);

  console.log(`\n✅ Added ${newCodes.length} new codes to shiftCodes.ts:`);
  for (const c of newCodes) {
    console.log(`   + ${c.code} (${c.game}) — ${c.reward} [r/${c.subreddit}]`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
