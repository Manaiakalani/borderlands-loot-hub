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

// Post bodies are scanned for codes, so the window must be wide enough to reach
// codes listed after a long preamble. 300 chars silently dropped them. Values
// actually written to shiftCodes.ts are constructed labels, not raw post text,
// and are separately bounded by assertValidCodeShape().
const SCAN_MAX_LENGTH = 10000;
const FIELD_MAX_LENGTH = 300;

/** Upper bound on how many codes a single unattended run may commit. */
const MAX_NEW_CODES_PER_RUN = 25;

function normalizeText(value, fallback = '') {
  return sanitizeText(value, { maxLength: SCAN_MAX_LENGTH, fallback });
}

/** Bounded normalizer for short values that end up in the generated file. */
function normalizeField(value, fallback = '') {
  return sanitizeText(value, { maxLength: FIELD_MAX_LENGTH, fallback });
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

/**
 * Decide which year a yearless date ("Dec 31", "6/5") refers to, relative to the
 * post that mentioned it.
 *
 * SHiFT codes expire days-to-weeks after they are posted, so a yearless date is
 * only read as *next* year when that lands shortly after the post (the genuine
 * Dec-post/Jan-expiry rollover). A date that sits well before the post is far more
 * likely to be a regex false positive than a reference ~10 months out, so we
 * return null and let the caller claim no expiry at all. Fabricating a future
 * date there would mark an already-dead code as live for months.
 *
 * @returns {Date|null} the resolved date, or null if the year can't be trusted
 */
function resolveYearlessDate(anchored, postDateObj) {
  if (isNaN(anchored.getTime())) return null;

  // Allow a day of slack so a same-day expiry isn't pushed a year out.
  const graceMs = 24 * 60 * 60 * 1000;
  if (anchored.getTime() >= postDateObj.getTime() - graceMs) return anchored;

  const bumped = new Date(anchored);
  bumped.setFullYear(anchored.getFullYear() + 1);

  const ROLLOVER_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
  if (bumped.getTime() - postDateObj.getTime() <= ROLLOVER_WINDOW_MS) return bumped;

  return null;
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
          parsed = resolveYearlessDate(new Date(currentYear, month, day), postDateObj);
          if (!parsed) continue;
        } else if (!hasExplicitYear) {
          // Month-name form without a year, e.g. "Dec 31". `new Date('Dec 31')`
          // silently yields year 2001 in V8, which would expire the code instantly.
          // Anchor to the post's year, then resolve the year the same way.
          const anchored = new Date(`${raw} ${currentYear}`);
          if (isNaN(anchored.getTime())) continue;
          parsed = resolveYearlessDate(anchored, postDateObj);
          if (!parsed) continue;
        } else {
          parsed = new Date(raw);
          if (isNaN(parsed.getTime())) continue;
        }

        if (isNaN(parsed.getTime())) continue;

        // Reject dates more than 1 year in the future (likely misparse).
        // `continue` rather than `return null` so a later pattern still gets a
        // chance to match a valid date elsewhere in the same post.
        const oneYearAhead = new Date(postDateObj);
        oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
        if (parsed > oneYearAhead) continue;

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
  const normalizedSubreddit = normalizeField(subreddit, 'unknown');
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
      // Deliberately not setting lastVerifiedAt: the scraper only *discovers*
      // codes, it never confirms they redeem. Stamping it here made the UI show
      // a green "Verified" badge for entirely unverified codes.
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

/**
 * Collapse duplicate sightings, keeping the most-upvoted one.
 *
 * Keyed per (code, game) rather than per code alone: the same code is frequently
 * posted for multiple titles, and collapsing on code discarded the per-game
 * entries the UI filters on.
 */
function dedupeCodes(codes) {
  const codeMap = new Map();
  for (const code of codes) {
    const key = `${code.code}::${code.game}`;
    const existing = codeMap.get(key);
    if (!existing || code.upvotes > existing.upvotes) {
      codeMap.set(key, code);
    }
  }
  return Array.from(codeMap.values())
    .sort((a, b) => new Date(b.postDate) - new Date(a.postDate));
}

function generateCodeEntry(code, index) {
  // Derive the ID from the full code (not a 5-char prefix + loop index), because the
  // index resets every run — two different codes sharing a prefix would collide.
  const slug = code.code.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  const id = `reddit-${code.game.toLowerCase()}-${slug}`;
  // Match isCodeExpired() in src/data/shiftCodes.ts: a date-only deadline is
  // valid through the end of that local day, not from its UTC midnight.
  const expiryDate = code.expiresAt
    ? (/^\d{4}-\d{2}-\d{2}$/.test(code.expiresAt)
        ? new Date(`${code.expiresAt}T23:59:59`)
        : new Date(code.expiresAt))
    : null;
  const status = expiryDate && expiryDate < new Date() ? 'expired' : 'unknown';

  return `  {
    id: '${id}',
    code: '${code.code}',
    game: '${code.game}',
    status: '${status}',
    reward: '${escapeTsString(code.reward ?? 'SHiFT Reward')}',
    rewardType: '${code.rewardType}',${code.keys ? `\n    keys: ${code.keys},` : ''}
    source: 'r/${escapeTsString(code.subreddit)}',
    addedAt: '${code.postDate}',
    expiresAt: ${code.expiresAt ? `'${code.expiresAt}'` : 'null'},
    isUniversal: ${code.isUniversal ? 'true' : 'false'},
  },`;
}

function writeNewCodes(fileContent, newCodes) {
  const entries = newCodes.map((c, i) => generateCodeEntry(c, i)).join('\n');
  const today = formatLocalDate(new Date());
  const sectionHeader = `  // ============================================\n  // REDDIT - Auto-fetched Codes (${today})\n  // ============================================\n${entries}`;

  // insertEntriesAfterAnchor validates the result before we write, so a bad
  // insert fails loudly instead of corrupting shiftCodes.ts.
  const updatedContent = insertEntriesAfterAnchor(fileContent, sectionHeader, newCodes.length);
  writeShiftCodesFile(SHIFT_CODES_PATH, updatedContent);
}

/**
 * Bound how many codes a single unattended run may append.
 *
 * Extracted from main() so the cap is actually exercised by tests rather than
 * merely asserting the constant's value.
 */
function applyPerRunCap(codes) {
  if (codes.length <= MAX_NEW_CODES_PER_RUN) return codes;
  console.warn(
    `\n⚠️  ${codes.length} new codes exceeds the per-run cap of ` +
      `${MAX_NEW_CODES_PER_RUN}; adding the ${MAX_NEW_CODES_PER_RUN} most recent ` +
      'and leaving the rest for the next run.',
  );
  return codes.slice(0, MAX_NEW_CODES_PER_RUN);
}

/**
 * Does this post contain anything that *looks* like a SHiFT code?
 *
 * Counted separately from successful extraction so a run can tell "no new codes
 * were posted today" (normal) apart from "codes were posted and we failed to read
 * them" (a regression that must fail the workflow).
 */
function postHasCodeCandidate(post) {
  if (!post || typeof post !== 'object') return false;
  const combinedText = `${normalizeText(post.title, '')} ${normalizeText(post.selftext, '')}`;
  SHIFT_CODE_REGEX.lastIndex = 0;
  return SHIFT_CODE_REGEX.test(combinedText);
}

/**
 * Decide whether a completed run was healthy, benignly empty, or systemically broken.
 *
 * Pure and exported so the failure modes are unit-testable without any network.
 * The previous guard (`postsSkipped === postsSeen`) was near-unreachable: a single
 * ordinary no-code post defeated it, and an HTTP 200 with malformed XML produced
 * `postsSeen === 0`, which sailed straight through as success.
 */
function assessRunHealth(stats) {
  const {
    anyReachable,
    subredditsWithPosts,
    postsSeen,
    postsSkipped,
    postsWithCandidates,
    codesExtracted,
  } = stats;

  if (!anyReachable) {
    return {
      level: 'skip',
      message:
        'All Reddit sources were unreachable this run (RSS + PullPush). ' +
        'Skipping update; will retry on the next schedule.',
    };
  }

  if (subredditsWithPosts === 0) {
    return {
      level: 'error',
      message:
        'Every Reddit source responded but not one post could be parsed from any subreddit. ' +
        'This means the feed format changed, not that the subreddits are empty.',
    };
  }

  if (postsSeen > 0 && postsSkipped === postsSeen) {
    return {
      level: 'error',
      message: `Extraction threw for all ${postsSeen} posts fetched. This usually means the feed format changed.`,
    };
  }

  if (postsWithCandidates > 0 && codesExtracted === 0) {
    return {
      level: 'error',
      message:
        `${postsWithCandidates} post(s) contained code-shaped text but zero codes were extracted. ` +
        'The extraction path is broken.',
    };
  }

  return { level: 'ok', message: `Scanned ${postsSeen} post(s) across ${subredditsWithPosts} subreddit(s).` };
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('🎮 Reddit SHiFT Code Scraper');
  console.log('============================\n');

  // 1. Fetch posts from all subreddits (RSS primary, PullPush fallback)
  const allCodes = [];
  let anyReachable = false;
  let subredditsWithPosts = 0;
  let postsSeen = 0;
  let postsSkipped = 0;
  let postsWithCandidates = 0;

  for (const subreddit of SUBREDDITS) {
    console.log(`\n📂 r/${subreddit}`);
    try {
      const { posts, reachable } = await fetchSubreddit(subreddit);
      if (reachable) anyReachable = true;
      if (posts.length > 0) subredditsWithPosts++;

      for (const post of posts) {
        postsSeen++;
        if (postHasCodeCandidate(post)) postsWithCandidates++;
        // Isolate per post: assertValidCodeShape() throws on implausible values
        // (e.g. a post claiming "100 keys"). Without this, one bad post aborted
        // every remaining post in the subreddit.
        try {
          allCodes.push(...extractCodesFromPost(post, subreddit));
        } catch (error) {
          postsSkipped++;
          console.warn(`  ⚠️  Skipping post ${post?.id ?? '<unknown>'}: ${error.message}`);
        }
      }

      // Be polite to the upstream services between subreddits.
      await new Promise(r => setTimeout(r, 1500));
    } catch (error) {
      console.error(`  ❌ Error on r/${subreddit}: ${error.message}`);
    }
  }

  // Fail *soft* when nothing was reachable — a daily red X for a best-effort
  // scraper is just noise. Fail *hard* when the sources answered but the parsing
  // or extraction path is broken, so the scraper can't silently rot for weeks.
  const health = assessRunHealth({
    anyReachable,
    subredditsWithPosts,
    postsSeen,
    postsSkipped,
    postsWithCandidates,
    codesExtracted: allCodes.length,
  });

  if (health.level === 'skip') {
    console.warn(`\n⚠️  ${health.message}`);
    return;
  }

  if (health.level === 'error') {
    console.error(`::error::${health.message}`);
    process.exitCode = 1;
    return;
  }

  // 2. Deduplicate per (code, game) rather than per code alone.
  const uniqueCodes = dedupeCodes(allCodes);

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

  // Bound the blast radius of a spam or malformed feed. Reddit is an untrusted
  // source and these commits land on main unattended, so cap what one run can
  // add. An upvote threshold is not usable here: the RSS feeds always report 0.
  const codesToAdd = applyPerRunCap(newCodes);

  // 4. Write new codes to shiftCodes.ts
  writeNewCodes(fileContent, codesToAdd);

  console.log(`\n✅ Added ${codesToAdd.length} new codes to shiftCodes.ts:`);
  for (const c of codesToAdd) {
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
  resolveYearlessDate,
  extractCodesFromPost,
  postHasCodeCandidate,
  assessRunHealth,
  generateCodeEntry,
  dedupeCodes,
  applyPerRunCap,
  MAX_NEW_CODES_PER_RUN,
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
