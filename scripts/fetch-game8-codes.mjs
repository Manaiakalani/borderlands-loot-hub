/**
 * Fetch SHiFT Codes from Game8.co
 * 
 * This script scrapes the game8.co Borderlands 4 SHiFT codes page
 * and updates the shiftCodes.ts file with new codes.
 * 
 * Run: node scripts/fetch-game8-codes.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GAME8_URL = 'https://game8.co/games/Borderlands-4/archives/548406';
const SHIFT_CODES_PATH = join(__dirname, '../src/data/shiftCodes.ts');

// Regex to match SHiFT codes (5 groups of 5 alphanumeric characters)
const SHIFT_CODE_REGEX = /\b([A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5})\b/gi;

/**
 * Parse expiration date from game8 format
 */
function parseExpirationDate(text) {
  if (!text || text.toLowerCase().includes('indefinite')) {
    return null;
  }
  
  // Try to extract date patterns
  const patterns = [
    // "December 31, 2030"
    /(\w+ \d{1,2}, \d{4})/i,
    // "12/31/2030"
    /(\d{1,2}\/\d{1,2}\/\d{4})/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const date = new Date(match[1]);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  
  return null;
}

/**
 * Determine reward type from reward text
 */
function getRewardType(reward) {
  const lower = reward.toLowerCase();
  if (lower.includes('golden key')) return 'golden-keys';
  if (lower.includes('skeleton key')) return 'skeleton-keys';
  if (lower.includes('diamond key')) return 'diamond-keys';
  if (lower.includes('skin')) return 'skin';
  if (lower.includes('head') || lower.includes('outfit') || lower.includes('pack')) return 'cosmetic';
  if (lower.includes('weapon') && !lower.includes('skin')) return 'weapon';
  return 'other';
}

/**
 * Extract number of keys from reward text
 */
function extractKeyCount(reward) {
  const match = reward.match(/(\d+)\s*(golden|skeleton|diamond)?\s*key/i);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Fetch and parse codes from game8.co
 */
async function fetchGame8Codes() {
  console.log(`Fetching codes from ${GAME8_URL}...`);
  
  const response = await fetch(GAME8_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const html = await response.text();
  console.log(`Fetched ${html.length} bytes of HTML`);
  
  const codes = [];
  const today = new Date().toISOString().split('T')[0];
  
  // Parse the HTML for table rows containing codes
  // Look for patterns like: CODE | Rewards | Availability
  const tableRowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(tableRowRegex) || [];
  
  for (const row of rows) {
    // Extract code
    const codeMatch = row.match(SHIFT_CODE_REGEX);
    if (!codeMatch) continue;
    
    const code = codeMatch[0].toUpperCase();
    
    // Extract cells
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [...row.matchAll(cellRegex)].map(m => 
      m[1].replace(/<[^>]*>/g, '').trim()
    );
    
    if (cells.length < 2) continue;
    
    // cells[0] = code (with "Redeem via Website" text)
    // cells[1] = reward
    // cells[2] = availability/expiration
    
    const reward = cells[1] || 'SHiFT Reward';
    const availability = cells[2] || '';
    
    const isExpired = availability.toLowerCase().includes('expired');
    const expiresAt = parseExpirationDate(availability);
    
    codes.push({
      id: `game8-bl4-${code.replace(/-/g, '').toLowerCase().slice(0, 10)}`,
      code,
      game: 'BL4',
      status: isExpired ? 'expired' : 'active',
      reward,
      rewardType: getRewardType(reward),
      keys: extractKeyCount(reward),
      source: 'game8.co',
      addedAt: today,
      lastVerifiedAt: today,
      expiresAt: isExpired ? expiresAt : expiresAt,
      isUniversal: true,
    });
  }
  
  // Also try to find codes in plain text (for simpler page structures)
  const allCodes = html.match(SHIFT_CODE_REGEX) || [];
  const existingCodes = new Set(codes.map(c => c.code));
  
  for (const code of allCodes) {
    const upperCode = code.toUpperCase();
    if (!existingCodes.has(upperCode)) {
      codes.push({
        id: `game8-bl4-${upperCode.replace(/-/g, '').toLowerCase().slice(0, 10)}`,
        code: upperCode,
        game: 'BL4',
        status: 'unknown',
        reward: 'SHiFT Reward (from game8.co)',
        rewardType: 'other',
        source: 'game8.co',
        addedAt: today,
        lastVerifiedAt: today,
        expiresAt: null,
        isUniversal: true,
      });
      existingCodes.add(upperCode);
    }
  }
  
  console.log(`Found ${codes.length} codes from game8.co`);
  return codes;
}

/**
 * Read existing codes from shiftCodes.ts
 */
function getExistingCodes() {
  const content = readFileSync(SHIFT_CODES_PATH, 'utf-8');
  const codes = new Set();
  
  const matches = content.matchAll(SHIFT_CODE_REGEX);
  for (const match of matches) {
    codes.add(match[0].toUpperCase());
  }
  
  return codes;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('=== Game8.co SHiFT Code Fetcher ===\n');
    
    const newCodes = await fetchGame8Codes();
    const existingCodes = getExistingCodes();
    
    // Filter to only new codes
    const uniqueNewCodes = newCodes.filter(c => !existingCodes.has(c.code));
    
    if (uniqueNewCodes.length === 0) {
      console.log('\nNo new codes found. Database is up to date.');
      return;
    }
    
    console.log(`\n${uniqueNewCodes.length} new codes to add:`);
    uniqueNewCodes.forEach(c => console.log(`  - ${c.code}: ${c.reward}`));
    
    // Read existing file
    let content = readFileSync(SHIFT_CODES_PATH, 'utf-8');
    
    // Find insertion point (after the first mockShiftCodes = [ line)
    const insertPoint = content.indexOf('export const mockShiftCodes: ShiftCode[] = [');
    if (insertPoint === -1) {
      throw new Error('Could not find mockShiftCodes array in file');
    }
    
    const arrayStart = content.indexOf('[', insertPoint) + 1;
    
    // Generate new code entries
    const newEntries = uniqueNewCodes.map(code => `
  // Auto-added from game8.co on ${new Date().toISOString().split('T')[0]}
  {
    id: '${code.id}',
    code: '${code.code}',
    game: '${code.game}',
    status: '${code.status}',
    reward: '${code.reward.replace(/'/g, "\\'")}',
    rewardType: '${code.rewardType}',${code.keys ? `\n    keys: ${code.keys},` : ''}
    source: '${code.source}',
    addedAt: '${code.addedAt}',
    lastVerifiedAt: '${code.lastVerifiedAt}',
    expiresAt: ${code.expiresAt ? `'${code.expiresAt}'` : 'null'},
    isUniversal: ${code.isUniversal},
  },`).join('');
    
    // Insert new codes
    content = content.slice(0, arrayStart) + newEntries + content.slice(arrayStart);
    
    // Write updated file
    writeFileSync(SHIFT_CODES_PATH, content, 'utf-8');
    
    console.log(`\n✅ Successfully added ${uniqueNewCodes.length} new codes to shiftCodes.ts`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
