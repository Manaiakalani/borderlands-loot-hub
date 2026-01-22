/**
 * Data source configuration for SHiFT codes
 * 
 * The app supports two data sources:
 * 1. LOCAL: Uses embedded data from shiftCodes.ts (default)
 *    - Twitter codes are automatically added via GitHub Actions
 * 2. REMOTE: Fetches from a remote JSON endpoint
 * 
 * To enable remote fetching, set USE_REMOTE_DATA to true and provide DATA_SOURCE_URL.
 */

export const DATA_CONFIG = {
  /**
   * Whether to fetch data from a remote source
   * Set to true when you have a hosted JSON endpoint
   */
  USE_REMOTE_DATA: false,

  /**
   * Remote data source URL
   * Examples:
   * - GitHub raw: 'https://raw.githubusercontent.com/user/repo/main/data/shiftCodes.json'
   * - JSONBin: 'https://api.jsonbin.io/v3/b/<bin-id>/latest'
   * - Your own API: 'https://api.example.com/shift-codes'
   */
  DATA_SOURCE_URL: '',

  /**
   * Cache duration in milliseconds
   * Default: 7 days (1 week)
   */
  CACHE_DURATION_MS: 7 * 24 * 60 * 60 * 1000,

  /**
   * Stale data threshold - when to show "data may be outdated" warning
   * Default: 14 days (2 weeks)
   */
  STALE_THRESHOLD_MS: 14 * 24 * 60 * 60 * 1000,

  /**
   * How often to check for updates in the background (when app is open)
   * Default: 1 day
   */
  BACKGROUND_CHECK_INTERVAL_MS: 24 * 60 * 60 * 1000,

  /**
   * Request timeout for remote fetches
   * Default: 10 seconds
   */
  FETCH_TIMEOUT_MS: 10 * 1000,
} as const;

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  CODES_CACHE: 'shift_codes_cache',
  LAST_FETCH_ATTEMPT: 'shift_codes_last_fetch_attempt',
  DATA_VERSION: 'shift_codes_data_version',
} as const;

/**
 * Current data version - increment when making breaking changes to data structure
 * v2: Initial version with weekly cache
 * v3: Added expiresAt and lastVerifiedAt fields
 * v4: Added Borderlands 4 support and game8.co codes
 * v5: Added r/Borderlandsshiftcodes Reddit codes
 */
export const DATA_VERSION = 5;
