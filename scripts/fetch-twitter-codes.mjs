/**
 * Script to fetch SHiFT codes from Twitter and update shiftCodes.ts
 * 
 * Run manually: TWITTER_BEARER_TOKEN=your_token node scripts/fetch-twitter-codes.mjs
 * Or via GitHub Actions (automatic daily)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHIFT_CODES_PATH = path.join(__dirname, '../src/data/shiftCodes.ts');

// Twitter API config
const TWITTER_API_BASE = 'https://api.twitter.com/2';
const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

const ACCOUNTS = [
  { username: 'Borderlands', displayName: '@Borderlands (Official)' },
  { username: 'ShiftCodesTK', displayName: '@ShiftCodesTK' },
  { username: 'borderlands4HQ', displayName: '@borderlands4HQ' },
  { username: 'DuvalMagic', displayName: '@DuvalMagic (Randy Pitchford)' },
];

const LOOKBACK_DAYS = 30;
const MAX_TWEETS = 50;

// SHiFT code regex pattern
const SHIFT_CODE_REGEX = /\b([A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5})\b/gi;

// Game detection patterns
const GAME_PATTERNS = {
  BL1: /borderlands\s*(1|goty|game\s*of\s*the\s*year|remastered|enhanced)/i,
  BL2: /borderlands\s*2/i,
  TPS: /(pre-?sequel|tps|borderlands:\s*the\s*pre)/i,
  BL3: /borderlands\s*3/i,
  WONDERLANDS: /(wonderlands|tiny\s*tina)/i,
};

// Keywords indicating SHiFT code content
const SHIFT_KEYWORDS = ['shift code', 'golden key', 'skeleton key', 'diamond key', 'redeem'];

/**
 * Detect which game a tweet is about
 */
function detectGame(text) {
  if (GAME_PATTERNS.WONDERLANDS.test(text)) return 'WONDERLANDS';
  if (GAME_PATTERNS.BL3.test(text)) return 'BL3';
  if (GAME_PATTERNS.TPS.test(text)) return 'TPS';
  if (GAME_PATTERNS.BL2.test(text)) return 'BL2';
  if (GAME_PATTERNS.BL1.test(text)) return 'BL1';
  if (/borderlands/i.test(text)) return 'BL3'; // Default
  return null;
}

/**
 * Extract reward description from tweet
 */
function extractReward(text) {
  const keyMatch = text.match(/(\d+)\s*(golden|skeleton|diamond)?\s*keys?/i);
  if (keyMatch) {
    const count = keyMatch[1];
    const type = keyMatch[2]?.toLowerCase() || 'golden';
    return `${count} ${type.charAt(0).toUpperCase() + type.slice(1)} Key${parseInt(count) > 1 ? 's' : ''}`;
  }
  if (text.toLowerCase().includes('head') || text.toLowerCase().includes('skin')) return 'Cosmetic Reward';
  if (text.toLowerCase().includes('weapon')) return 'Weapon Reward';
  return 'SHiFT Reward';
}

/**
 * Determine reward type
 */
function getRewardType(text) {
  const lower = text.toLowerCase();
  if (lower.includes('skeleton')) return 'skeleton-keys';
  if (lower.includes('diamond')) return 'diamond-keys';
  if (lower.includes('key')) return 'golden-keys';
  if (lower.includes('skin') || lower.includes('head')) return 'skin';
  if (lower.includes('weapon')) return 'weapon';
  if (lower.includes('cosmetic') || lower.includes('trinket')) return 'cosmetic';
  return 'other';
}

/**
 * Fetch user ID from username
 */
async function getUserId(username) {
  const response = await fetch(`${TWITTER_API_BASE}/users/by/username/${username}`, {
    headers: { 'Authorization': `Bearer ${BEARER_TOKEN}` }
  });
  
  if (!response.ok) {
    console.warn(`Failed to fetch user ${username}: ${response.status}`);
    return null;
  }
  
  const data = await response.json();
  return data.data?.id;
}

/**
 * Fetch recent tweets from a user
 */
async function fetchUserTweets(userId) {
  const startTime = new Date();
  startTime.setDate(startTime.getDate() - LOOKBACK_DAYS);
  
  const url = new URL(`${TWITTER_API_BASE}/users/${userId}/tweets`);
  url.searchParams.set('max_results', MAX_TWEETS.toString());
  url.searchParams.set('start_time', startTime.toISOString());
  url.searchParams.set('tweet.fields', 'created_at,text');
  
  const response = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${BEARER_TOKEN}` }
  });
  
  if (!response.ok) {
    console.warn(`Failed to fetch tweets: ${response.status}`);
    return [];
  }
  
  const data = await response.json();
  return data.data || [];
}

/**
 * Extract codes from tweets
 */
function extractCodesFromTweets(tweets, author) {
  const codes = [];
  
  for (const tweet of tweets) {
    const text = tweet.text;
    
    // Check if tweet is about SHiFT codes
    const isShiftTweet = SHIFT_KEYWORDS.some(kw => text.toLowerCase().includes(kw)) ||
                         SHIFT_CODE_REGEX.test(text);
    
    if (!isShiftTweet) continue;
    
    // Reset regex
    SHIFT_CODE_REGEX.lastIndex = 0;
    
    // Find all codes in tweet
    let match;
    while ((match = SHIFT_CODE_REGEX.exec(text)) !== null) {
      const code = match[1].toUpperCase();
      const game = detectGame(text);
      const reward = extractReward(text);
      const rewardType = getRewardType(text);
      
      codes.push({
        code,
        game: game || 'BL3',
        reward,
        rewardType,
        tweetId: tweet.id,
        tweetDate: tweet.created_at.split('T')[0],
        author,
        isUniversal: !game,
      });
    }
  }
  
  return codes;
}

/**
 * Read existing codes from shiftCodes.ts
 */
function readExistingCodes() {
  const content = fs.readFileSync(SHIFT_CODES_PATH, 'utf-8');
  
  // Extract the array content using regex
  const match = content.match(/export const mockShiftCodes: ShiftCode\[\] = \[([\s\S]*?)\];/);
  if (!match) {
    console.error('Could not parse existing codes');
    return { existingCodes: [], fileContent: content };
  }
  
  // Parse existing code strings to dedupe
  const codeStrings = new Set();
  const codeRegex = /code:\s*['"]([A-Z0-9-]+)['"]/g;
  let codeMatch;
  while ((codeMatch = codeRegex.exec(match[1])) !== null) {
    codeStrings.add(codeMatch[1]);
  }
  
  return { existingCodeStrings: codeStrings, fileContent: content, arrayContent: match[1] };
}

/**
 * Generate TypeScript code for new entries
 */
function generateCodeEntry(code, index) {
  const entry = `
  {
    id: 'twitter-${Date.now()}-${index}',
    code: '${code.code}',
    game: '${code.game}',
    status: 'unknown',
    reward: '${code.reward.replace(/'/g, "\\'")}',
    rewardType: '${code.rewardType}',
    source: 'Twitter ${code.author}',
    addedAt: '${code.tweetDate}',
    isUniversal: ${code.isUniversal},
  },`;
  
  return entry;
}

/**
 * Main function
 */
async function main() {
  if (!BEARER_TOKEN) {
    console.error('❌ TWITTER_BEARER_TOKEN environment variable not set');
    process.exit(1);
  }
  
  console.log('🐦 Fetching SHiFT codes from Twitter...\n');
  
  const allNewCodes = [];
  
  for (const account of ACCOUNTS) {
    console.log(`📡 Checking @${account.username}...`);
    
    try {
      const userId = await getUserId(account.username);
      if (!userId) continue;
      
      const tweets = await fetchUserTweets(userId);
      console.log(`   Found ${tweets.length} tweets`);
      
      const codes = extractCodesFromTweets(tweets, account.displayName);
      console.log(`   Extracted ${codes.length} codes`);
      
      allNewCodes.push(...codes);
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      console.error(`   Error: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Total codes found: ${allNewCodes.length}`);
  
  // Read existing codes
  const { existingCodeStrings, fileContent, arrayContent } = readExistingCodes();
  console.log(`📁 Existing unique codes: ${existingCodeStrings.size}`);
  
  // Filter out duplicates
  const newUniqueCodes = allNewCodes.filter(c => !existingCodeStrings.has(c.code));
  console.log(`✨ New unique codes: ${newUniqueCodes.length}`);
  
  if (newUniqueCodes.length === 0) {
    console.log('\n✅ No new codes to add. File unchanged.');
    return;
  }
  
  // Generate new entries
  const newEntries = newUniqueCodes.map((c, i) => generateCodeEntry(c, i)).join('');
  
  // Find insertion point (after the opening comment block in the array)
  const insertionMarker = '// ============================================\n  // BORDERLANDS 3 - Active Codes';
  
  let updatedContent;
  if (fileContent.includes(insertionMarker)) {
    // Insert after the first section header
    updatedContent = fileContent.replace(
      insertionMarker,
      `// ============================================\n  // TWITTER - Auto-fetched Codes (${new Date().toISOString().split('T')[0]})\n  // ============================================${newEntries}\n\n  // ============================================\n  // BORDERLANDS 3 - Active Codes`
    );
  } else {
    // Fallback: insert at the beginning of the array
    updatedContent = fileContent.replace(
      'export const mockShiftCodes: ShiftCode[] = [',
      `export const mockShiftCodes: ShiftCode[] = [${newEntries}`
    );
  }
  
  // Write updated file
  fs.writeFileSync(SHIFT_CODES_PATH, updatedContent);
  
  console.log(`\n✅ Added ${newUniqueCodes.length} new codes to shiftCodes.ts`);
  newUniqueCodes.forEach(c => console.log(`   + ${c.code} (${c.game}) - ${c.reward}`));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
