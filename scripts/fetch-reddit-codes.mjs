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

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  readShiftCodesFile,
  extractExistingCodeStrings,
  insertEntriesAfterAnchor,
  writeShiftCodesFile,
  escapeTsString,
  sanitizeText,
  assertValidCodeShape,
} from './lib/shift-codes-file.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHIFT_CODES_PATH = path.join(__dirname, '../src/data/shiftCodes.ts');

const USER_AGENT = 'Mozilla/5.0 (compatible; BorderlandsLootHubBot/1.0; +https://manaiakalani.github.io/borderlands-loot-hub/)';

const COMMON_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

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

function normalizeText(value, fallback = '') {
  return sanitizeText(value, { maxLength: 300, fallback });
}

function detectGame(text, subreddit) {
  const normalizedText = normalizeText(text, '');
  for (const [game, pattern] of Object.entries(GAME_PATTERNS)) {
    if (pattern.test(normalizedText)) return game;
  }
  return SUBREDDIT_GAME_DEFAULTS[normalizeText(subreddit, '').toLowerCase()] || 'BL4';
}

function detectRewardType(text) {
  const normalizedText = normalizeText(text, '');
  for (const [type, pattern] of Object.entries(REWARD_PATTERNS)) {
    if (pattern.test(normalizedText)) return type;
  }
  return 'golden-keys';
}

function extractKeyCount(text) {
  const normalizedText = normalizeText(text, '');
  const match = normalizedText.match(/(\d+)\s*(?:golden\s*)?key/i);
  return match ? parseInt(match[1], 10) : 1;
}

function extractRewardLabel(text) {
  const normalizedText = normalizeText(text, '');
  const keyMatch = normalizedText.match(/(\d+)\s*(golden|skeleton|diamond)?\s*keys?/i);
  if (keyMatch) {
    const count = keyMatch[1];
    const type = keyMatch[2]?.toLowerCase() || 'golden';
    return `${count} ${type.charAt(0).toUpperCase() + type.slice(1)} Key${parseInt(count) > 1 ? 's' : ''}`;
  }
  if (/skin|head|outfit/i.test(normalizedText)) return 'Cosmetic Reward';
  if (/weapon|gun|legendary/i.test(normalizedText)) return 'Weapon Reward';
  return 'SHiFT Reward';
}

function parseExpiration(text, postDateObj = new Date()) {
  const normalizedText = normalizeText(text, '');
  const patterns = [
    /exp(?:ires?|iration)?[:\s]+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
    /exp(?:ires?)?[:\s]+([A-Z][a-z]+\.?\s+\d{1,2}(?:,?\s+\d{4})?)/i,
    /until\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
  ];

  const currentYear = postDateObj.getFullYear();

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      try {
        const raw = match[1];
        const slashParts = raw.split('/');
        const hasExplicitYear = slashParts.length >= 3 || /\d{4}/.test(raw);

        let parsed;
        if (!hasExplicitYear && slashParts.length === 2) {
          const month = parseInt(slashParts[0], 10) - 1;
          const day = parseInt(slashParts[1], 10);
          if (month < 0 || month > 11 || day < 1 || day > 31) continue;
          parsed = new Date(currentYear, month, day);
          // Only bump year if the date is more than 60 days before the post
          // (likely refers to next year, e.g. Dec post with Jan expiry)
          const diffMs = postDateObj.getTime() - parsed.getTime();
          if (diffMs > 60 * 24 * 60 * 60 * 1000) {
            parsed.setFullYear(currentYear + 1);
          }
        } else {
          parsed = new Date(raw);
          if (isNaN(parsed.getTime())) continue;
        }

        if (isNaN(parsed.getTime())) continue;

        // Reject dates more than 1 year in the future (likely misparse)
        const oneYearAhead = new Date(postDateObj);
        oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
        if (parsed > oneYearAhead) return null;

        // Format as YYYY-MM-DD using local date parts (not UTC)
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      } catch { /* continue */ }
    }
  }
  return null;
}

/** Format a Date as YYYY-MM-DD using local date parts (avoids UTC off-by-one) */
function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Reddit fetching (no-auth sources) ──────────────────────────────
//
// Reddit blocks unauthenticated `.json` requests from datacenter IPs (used by
// GitHub Actions) with HTTP 403. Two sources still work without API keys:
//   1. Reddit RSS feeds (`/.rss`) — official, current, more permissive.
//   2. PullPush.io — a third-party Reddit archive, independent of Reddit's IP
//      blocking (used as a fallback when RSS is unavailable).

/** Decode the HTML entities Reddit uses inside RSS <content> bodies. */
function decodeEntities(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#32;/g, ' ')
    .replace(/&amp;/g, '&');
}

/**
 * Fetch posts from a subreddit's RSS feed. Returns normalised post objects
 * compatible with extractCodesFromPost().
 */
async function fetchSubredditRSS(subreddit, sort = 'new', limit = 100) {
  const url = `https://www.reddit.com/r/${subreddit}/${sort}/.rss?limit=${limit}`;
  console.log(`  📡 RSS /r/${subreddit}/${sort} ...`);

  let response;
  try {
    response = await fetch(url, { headers: { ...COMMON_HEADERS, Accept: 'application/atom+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(15000) });
  } catch (err) {
    console.warn(`  ⚠️  RSS /r/${subreddit}/${sort}: ${err.message}`);
    return { posts: [], reachable: false };
  }

  if (!response.ok) {
    console.warn(`  ⚠️  RSS /r/${subreddit}/${sort}: ${response.status} ${response.statusText}`);
    return { posts: [], reachable: false };
  }

  const xml = await response.text();
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m => m[1]);

  const posts = entries.map(entry => {
    const title = decodeEntities((entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    const updated = (entry.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1] || '';
    const link = (entry.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '';
    const id = (entry.match(/<id>([\s\S]*?)<\/id>/) || [])[1] || link;
    const rawContent = (entry.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1] || '';
    const selftext = decodeEntities(rawContent).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const created_utc = updated ? Math.floor(new Date(updated).getTime() / 1000) : Math.floor(Date.now() / 1000);
    return { id, title, selftext, created_utc, ups: 0, permalink: link };
  });

  return { posts, reachable: true };
}

/**
 * Fallback: fetch posts from PullPush.io (a third-party Reddit archive).
 */
async function fetchSubredditPullPush(subreddit, size = 100) {
  const url = `https://api.pullpush.io/reddit/search/submission/?subreddit=${subreddit}&size=${size}&sort=desc&sort_type=created_utc`;
  console.log(`  📡 PullPush r/${subreddit} ...`);

  let response;
  try {
    response = await fetch(url, { headers: COMMON_HEADERS, signal: AbortSignal.timeout(15000) });
  } catch (err) {
    console.warn(`  ⚠️  PullPush r/${subreddit}: ${err.message}`);
    return { posts: [], reachable: false };
  }

  if (!response.ok) {
    console.warn(`  ⚠️  PullPush r/${subreddit}: ${response.status} ${response.statusText}`);
    return { posts: [], reachable: false };
  }

  try {
    const data = await response.json();
    const posts = (data.data || []).map(p => ({
      id: p.id,
      title: p.title || '',
      selftext: p.selftext || '',
      created_utc: p.created_utc,
      ups: p.score ?? p.ups ?? 0,
      permalink: p.permalink || '',
    }));
    return { posts, reachable: true };
  } catch {
    console.warn(`  ⚠️  PullPush r/${subreddit}: failed to parse JSON`);
    return { posts: [], reachable: false };
  }
}

/** Deduplicate posts by id. */
function dedupePosts(posts) {
  const seen = new Set();
  return posts.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

/**
 * Fetch a single subreddit: RSS (new + hot) first, PullPush as fallback.
 * `reachable` is true if *any* source responded successfully.
 */
async function fetchSubreddit(subreddit) {
  const [rssNew, rssHot] = await Promise.all([
    fetchSubredditRSS(subreddit, 'new'),
    fetchSubredditRSS(subreddit, 'hot'),
  ]);

  let posts = dedupePosts([...rssNew.posts, ...rssHot.posts]);
  let reachable = rssNew.reachable || rssHot.reachable;
  let source = 'rss';

  if (posts.length === 0) {
    const pp = await fetchSubredditPullPush(subreddit);
    reachable = reachable || pp.reachable;
    if (pp.posts.length > 0) {
      posts = pp.posts;
      source = 'pullpush';
    }
  }

  console.log(`  Found ${posts.length} posts via ${source}`);
  return { posts, reachable };
}

/**
 * Extract SHiFT codes from a single post.
 */
function extractCodesFromPost(post, subreddit) {
  if (!post || typeof post !== 'object') return [];

  const title = normalizeText(post.title, '');
  const selftext = normalizeText(post.selftext, '');
  const combinedText = `${title} ${selftext}`.trim();
  const matches = combinedText.match(SHIFT_CODE_REGEX) || [];
  const uniqueCodes = [...new Set(matches.map(c => c.toUpperCase()))];

  const createdUtc = Number(post.created_utc);
  const postDateObj = Number.isFinite(createdUtc) && createdUtc > 0
    ? new Date(createdUtc * 1000)
    : new Date();

  const game = detectGame(combinedText, subreddit);
  const rewardType = detectRewardType(combinedText);
  const keyCount = extractKeyCount(combinedText);
  const expiresAt = parseExpiration(combinedText, postDateObj);
  const reward = extractRewardLabel(combinedText);

  const postDate = formatLocalDate(postDateObj);
  const upvotes = Number.isFinite(Number(post.ups)) ? Number(post.ups) : 0;
  const normalizedSubreddit = normalizeText(subreddit, 'unknown');
  const today = formatLocalDate(new Date());
  const codes = [];

  for (const [index, code] of uniqueCodes.entries()) {
    const codeEntry = {
      id: `reddit-${normalizedSubreddit.toLowerCase()}-${code.slice(0, 5).toLowerCase()}-${index}`,
      code,
      game,
      status: 'unknown',
      reward,
      rewardType,
      keys: rewardType.endsWith('-keys') ? keyCount : undefined,
      expiresAt,
      source: `r/${normalizedSubreddit}`,
      addedAt: postDate,
      lastVerifiedAt: today,
      isUniversal: /universal|all\s*games|every\s*game/i.test(combinedText),
      postDate,
      upvotes,
      subreddit: normalizedSubreddit,
    };

    assertValidCodeShape(codeEntry);
    codes.push(codeEntry);
  }

  return codes;
}

// ── shiftCodes.ts read / write ─────────────────────────────────────

function readExistingCodes() {
  const content = readShiftCodesFile(SHIFT_CODES_PATH);
  return { existingCodeStrings: extractExistingCodeStrings(content), fileContent: content };
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
    reward: '${escapeTsString(code.reward ?? 'SHiFT Reward')}',
    rewardType: '${code.rewardType}',${code.keys ? `\n    keys: ${code.keys},` : ''}
    source: 'r/${escapeTsString(code.subreddit)}',
    addedAt: '${code.postDate}',
    lastVerifiedAt: '${today}',
    expiresAt: ${code.expiresAt ? `'${code.expiresAt}'` : 'null'},
    isUniversal: true,
  },`;
}

function writeNewCodes(fileContent, newCodes) {
  const entries = newCodes.map((c, i) => generateCodeEntry(c, i)).join('\n');
  const today = new Date().toISOString().split('T')[0];
  const sectionHeader = `  // ============================================\n  // REDDIT - Auto-fetched Codes (${today})\n  // ============================================\n${entries}`;

  // insertEntriesAfterAnchor validates the result before we write, so a bad
  // insert fails loudly instead of corrupting shiftCodes.ts.
  const updatedContent = insertEntriesAfterAnchor(fileContent, sectionHeader, newCodes.length);
  writeShiftCodesFile(SHIFT_CODES_PATH, updatedContent);
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('🎮 Reddit SHiFT Code Scraper');
  console.log('============================\n');

  // 1. Fetch posts from all subreddits (RSS primary, PullPush fallback)
  const allCodes = [];
  let anyReachable = false;

  for (const subreddit of SUBREDDITS) {
    console.log(`\n📂 r/${subreddit}`);
    try {
      const { posts, reachable } = await fetchSubreddit(subreddit);
      if (reachable) anyReachable = true;

      for (const post of posts) {
        allCodes.push(...extractCodesFromPost(post, subreddit));
      }

      // Be polite to the upstream services between subreddits.
      await new Promise(r => setTimeout(r, 1500));
    } catch (error) {
      console.error(`  ❌ Error on r/${subreddit}: ${error.message}`);
    }
  }

  // Fail *soft* if every source for every subreddit was unreachable. A daily red
  // X for a best-effort scraper is just noise — we simply do nothing this run.
  if (!anyReachable) {
    console.warn(
      '\n⚠️  All Reddit sources were unreachable this run (RSS + PullPush). ' +
        'Skipping update; will retry on the next schedule.',
    );
    return;
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

export {
  decodeEntities,
  detectGame,
  detectRewardType,
  extractKeyCount,
  extractRewardLabel,
  parseExpiration,
  extractCodesFromPost,
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
