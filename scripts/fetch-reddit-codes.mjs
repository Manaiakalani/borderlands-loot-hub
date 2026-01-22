#!/usr/bin/env node
/**
 * Reddit SHiFT Code Scraper
 * 
 * Fetches SHiFT codes from r/Borderlandsshiftcodes subreddit
 * Uses Reddit's JSON API (no authentication required for public subreddits)
 * 
 * Usage:
 *   node scripts/fetch-reddit-codes.mjs
 * 
 * The script outputs new codes in a format ready to paste into shiftCodes.ts
 */

// SHiFT code pattern: 5 groups of 5 alphanumeric characters separated by hyphens
const SHIFT_CODE_PATTERN = /[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}/gi;

// Subreddit to scrape
const SUBREDDIT = 'Borderlandsshiftcodes';
const BASE_URL = `https://www.reddit.com/r/${SUBREDDIT}`;

// Game detection patterns
const GAME_PATTERNS = {
  BL1: /\b(BL1|borderlands\s*1|borderlands\s*goty)\b/i,
  BL2: /\b(BL2|borderlands\s*2)\b/i,
  TPS: /\b(TPS|pre-sequel|presequel)\b/i,
  BL3: /\b(BL3|borderlands\s*3)\b/i,
  BL4: /\b(BL4|borderlands\s*4)\b/i,
  WONDERLANDS: /\b(wonderlands|ttw|tiny\s*tina)/i,
};

// Reward detection patterns
const REWARD_PATTERNS = {
  'golden-keys': /golden\s*key|(\d+)\s*key/i,
  'skeleton-keys': /skeleton\s*key/i,
  'diamond-keys': /diamond\s*key/i,
  'skin': /skin|outfit|head/i,
  'cosmetic': /cosmetic|echo|drone/i,
  'weapon': /weapon|gun|legendary/i,
};

/**
 * Detect game type from post title/content
 */
function detectGame(text) {
  for (const [game, pattern] of Object.entries(GAME_PATTERNS)) {
    if (pattern.test(text)) {
      return game;
    }
  }
  return 'BL4'; // Default to BL4 since most recent codes are for it
}

/**
 * Detect reward type from post title/content
 */
function detectRewardType(text) {
  for (const [type, pattern] of Object.entries(REWARD_PATTERNS)) {
    if (pattern.test(text)) {
      return type;
    }
  }
  return 'golden-keys';
}

/**
 * Extract number of keys from text
 */
function extractKeyCount(text) {
  const match = text.match(/(\d+)\s*(?:golden\s*)?key/i);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Parse expiration date from text
 */
function parseExpiration(text) {
  // Match patterns like "Expires 1/13", "Exp. 12/31/2025", "Code Exp: Dec. 31, 2030"
  const patterns = [
    /exp(?:ires?|iration)?[:\s]+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
    /exp(?:ires?)?[:\s]+([A-Z][a-z]+\.?\s+\d{1,2}(?:,?\s+\d{4})?)/i,
    /until\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const dateStr = match[1];
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          // If year is missing, assume current/next year
          if (parsed.getFullYear() < 2000) {
            parsed.setFullYear(new Date().getFullYear());
            if (parsed < new Date()) {
              parsed.setFullYear(parsed.getFullYear() + 1);
            }
          }
          return parsed.toISOString().split('T')[0];
        }
      } catch (e) {
        // Continue to next pattern
      }
    }
  }
  return null;
}

/**
 * Fetch posts from subreddit
 */
async function fetchSubredditPosts(sort = 'hot', limit = 100) {
  const url = `${BASE_URL}/${sort}.json?limit=${limit}`;
  
  console.log(`Fetching from ${url}...`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'BorderlandsLootHub/1.0 (Code Aggregator)',
    },
  });

  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.data.children.map(child => child.data);
}

/**
 * Extract codes from a post
 */
function extractCodesFromPost(post) {
  const codes = [];
  const combinedText = `${post.title} ${post.selftext || ''}`;
  const matches = combinedText.match(SHIFT_CODE_PATTERN) || [];
  
  // Deduplicate codes within the same post
  const uniqueCodes = [...new Set(matches.map(c => c.toUpperCase()))];
  
  const game = detectGame(post.title);
  const rewardType = detectRewardType(combinedText);
  const keyCount = extractKeyCount(combinedText);
  const expiresAt = parseExpiration(combinedText);
  
  for (const code of uniqueCodes) {
    codes.push({
      code: code.toUpperCase(),
      game,
      rewardType,
      keys: rewardType === 'golden-keys' ? keyCount : undefined,
      expiresAt,
      postTitle: post.title,
      postUrl: `https://reddit.com${post.permalink}`,
      postDate: new Date(post.created_utc * 1000).toISOString().split('T')[0],
      upvotes: post.ups,
      flair: post.link_flair_text,
    });
  }
  
  return codes;
}

/**
 * Generate TypeScript code entry
 */
function generateCodeEntry(code, index) {
  const id = `reddit-${code.game.toLowerCase()}-${code.code.substring(0, 5).toLowerCase()}-${index}`;
  const reward = code.keys > 1 ? `${code.keys} Golden Keys` : '1 Golden Key';
  const status = code.expiresAt && new Date(code.expiresAt) < new Date() ? 'expired' : 'active';
  
  return `  {
    id: '${id}',
    code: '${code.code}',
    game: '${code.game}',
    status: '${status}',
    reward: '${reward}',
    rewardType: '${code.rewardType}',${code.keys ? `
    keys: ${code.keys},` : ''}
    source: 'r/Borderlandsshiftcodes',
    addedAt: '${code.postDate}',
    lastVerifiedAt: '${new Date().toISOString().split('T')[0]}',
    expiresAt: ${code.expiresAt ? `'${code.expiresAt}'` : 'null'},
    isUniversal: true,
  },`;
}

/**
 * Main function
 */
async function main() {
  console.log('🎮 Reddit SHiFT Code Scraper');
  console.log('============================\n');
  
  try {
    // Fetch from both hot and new posts
    const [hotPosts, newPosts] = await Promise.all([
      fetchSubredditPosts('hot', 50),
      fetchSubredditPosts('new', 50),
    ]);
    
    // Combine and deduplicate posts
    const allPosts = [...hotPosts, ...newPosts];
    const seenIds = new Set();
    const uniquePosts = allPosts.filter(post => {
      if (seenIds.has(post.id)) return false;
      seenIds.add(post.id);
      return true;
    });
    
    console.log(`Found ${uniquePosts.length} unique posts\n`);
    
    // Extract codes from posts
    const allCodes = [];
    for (const post of uniquePosts) {
      const codes = extractCodesFromPost(post);
      allCodes.push(...codes);
    }
    
    // Deduplicate codes
    const codeMap = new Map();
    for (const code of allCodes) {
      const existing = codeMap.get(code.code);
      // Keep the one with more upvotes (more reliable)
      if (!existing || code.upvotes > existing.upvotes) {
        codeMap.set(code.code, code);
      }
    }
    
    const uniqueCodes = Array.from(codeMap.values())
      .sort((a, b) => new Date(b.postDate) - new Date(a.postDate)); // Newest first
    
    console.log(`📋 Found ${uniqueCodes.length} unique SHiFT codes:\n`);
    
    // Group by game
    const byGame = {};
    for (const code of uniqueCodes) {
      if (!byGame[code.game]) byGame[code.game] = [];
      byGame[code.game].push(code);
    }
    
    // Print summary by game
    for (const [game, codes] of Object.entries(byGame)) {
      const active = codes.filter(c => !c.expiresAt || new Date(c.expiresAt) >= new Date()).length;
      console.log(`  ${game}: ${codes.length} codes (${active} likely active)`);
    }
    
    console.log('\n-------------------------------------------');
    console.log('TypeScript entries (copy to shiftCodes.ts):');
    console.log('-------------------------------------------\n');
    
    // Generate TypeScript entries
    let index = 0;
    for (const code of uniqueCodes) {
      console.log(generateCodeEntry(code, index++));
      console.log('');
    }
    
    // Print detailed list
    console.log('\n-------------------------------------------');
    console.log('Detailed Code List:');
    console.log('-------------------------------------------\n');
    
    for (const code of uniqueCodes) {
      const status = code.expiresAt && new Date(code.expiresAt) < new Date() ? '❌' : '✅';
      console.log(`${status} ${code.code}`);
      console.log(`   Game: ${code.game} | Keys: ${code.keys || 'N/A'} | Upvotes: ${code.upvotes}`);
      console.log(`   Posted: ${code.postDate} | Expires: ${code.expiresAt || 'Unknown'}`);
      console.log(`   Post: ${code.postTitle.substring(0, 60)}...`);
      console.log('');
    }
    
  } catch (error) {
    console.error('Error fetching codes:', error.message);
    process.exit(1);
  }
}

main();
