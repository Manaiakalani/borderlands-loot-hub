import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { mockShiftCodes, ShiftCode, isCodeExpired, getEffectiveStatus, GameType, CodeStatus, RewardType } from '@/data/shiftCodes';
import { DATA_CONFIG, STORAGE_KEYS, DATA_VERSION } from '@/config/dataConfig';

const RECENT_DAYS_THRESHOLD = 3;
const VALID_GAMES = new Set<GameType>(['BL1', 'BL2', 'TPS', 'BL3', 'BL4', 'WONDERLANDS']);
const VALID_STATUSES = new Set<CodeStatus>(['active', 'expired', 'unknown']);
const VALID_REWARD_TYPES = new Set<RewardType>(['golden-keys', 'skeleton-keys', 'diamond-keys', 'skin', 'cosmetic', 'weapon', 'other']);

/** Simple hash of embedded data length + first/last IDs to detect new deployments */
const EMBEDDED_REVISION = `${mockShiftCodes.length}-${mockShiftCodes[0]?.id ?? ''}-${mockShiftCodes[mockShiftCodes.length - 1]?.id ?? ''}`;

/** Safe localStorage helper — graceful no-op when storage is unavailable */
const safeRemoveItem = (key: string): void => {
  try { localStorage.removeItem(key); } catch { /* private browsing or quota */ }
};

/** Validates a YYYY-MM-DD string represents a real calendar date */
const isValidDateString = (s: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

const sanitizeCacheText = (value: unknown, fallback = ''): string => {
  if (typeof value !== 'string') return fallback;

  const cleaned = Array.from(value).map((char) => {
    const codePoint = char.codePointAt(0) ?? 0;
    return codePoint >= 0x20 && codePoint !== 0x7f ? char : ' ';
  }).join('').replace(/\s+/g, ' ').trim();

  return cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned || fallback;
};

const normalizeCodes = (codes: unknown): ShiftCode[] => {
  if (!Array.isArray(codes)) return [];

  return codes.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as Partial<ShiftCode> & Record<string, unknown>;

    if (typeof candidate.id !== 'string' || !candidate.id.trim()) return [];
    if (typeof candidate.code !== 'string' || !/^[A-Z0-9]{5}(?:-[A-Z0-9]{5}){4}$/.test(candidate.code.toUpperCase())) return [];
    if (typeof candidate.game !== 'string' || !VALID_GAMES.has(candidate.game as GameType)) return [];
    if (typeof candidate.status !== 'string' || !VALID_STATUSES.has(candidate.status as CodeStatus)) return [];
    if (typeof candidate.reward !== 'string') return [];
    if (typeof candidate.rewardType !== 'string' || !VALID_REWARD_TYPES.has(candidate.rewardType as RewardType)) return [];
    if (candidate.source !== undefined && typeof candidate.source !== 'string') return [];
    if (typeof candidate.addedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(candidate.addedAt)) return [];

    const normalized: ShiftCode = {
      id: candidate.id.trim(),
      code: candidate.code.toUpperCase(),
      game: candidate.game as GameType,
      status: candidate.status as CodeStatus,
      reward: sanitizeCacheText(candidate.reward, 'SHiFT Reward'),
      rewardType: candidate.rewardType as RewardType,
      source: sanitizeCacheText(candidate.source, 'unknown'),
      addedAt: candidate.addedAt,
    };

    if (typeof candidate.keys === 'number' && Number.isInteger(candidate.keys)) {
      normalized.keys = candidate.keys;
    }
    if (typeof candidate.expiresAt === 'string' && isValidDateString(candidate.expiresAt.slice(0, 10))) {
      normalized.expiresAt = candidate.expiresAt;
    } else if (candidate.expiresAt === null) {
      normalized.expiresAt = null;
    }
    if (typeof candidate.lastVerifiedAt === 'string' && isValidDateString(candidate.lastVerifiedAt.slice(0, 10))) {
      normalized.lastVerifiedAt = candidate.lastVerifiedAt;
    }
    if (typeof candidate.isUniversal === 'boolean') {
      normalized.isUniversal = candidate.isUniversal;
    }

    return [normalized];
  });
};

interface CacheData {
  codes: ShiftCode[];
  timestamp: number;
  version: number;
  source: 'local' | 'remote';
}

interface FetchResult {
  codes: ShiftCode[];
  source: 'local' | 'remote';
}

/**
 * Parses a date-only string (YYYY-MM-DD) as local time, not UTC.
 * Prevents off-by-one day errors in negative UTC offsets (e.g. US Pacific).
 */
const parseLocalDate = (dateStr: string): Date => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00');
  }
  return new Date(dateStr);
};

/**
 * Checks if a date is today
 */
const isSameDay = (date1: Date, date2: Date): boolean => (
  date1.getDate() === date2.getDate() &&
  date1.getMonth() === date2.getMonth() &&
  date1.getFullYear() === date2.getFullYear()
);

/**
 * Gets cached data from localStorage, checking version and expiration
 */
const getCachedData = (): CacheData | null => {
  try {
    const cached = localStorage.getItem(STORAGE_KEYS.CODES_CACHE);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    if (!parsed || typeof parsed !== 'object') {
      safeRemoveItem(STORAGE_KEYS.CODES_CACHE);
      return null;
    }

    const cacheData = parsed as Partial<CacheData> & Record<string, unknown>;
    if (typeof cacheData.version !== 'number' || typeof cacheData.timestamp !== 'number' || typeof cacheData.source !== 'string') {
      safeRemoveItem(STORAGE_KEYS.CODES_CACHE);
      return null;
    }

    // Invalidate cache if data version changed
    if (cacheData.version !== DATA_VERSION) {
      safeRemoveItem(STORAGE_KEYS.CODES_CACHE);
      return null;
    }

    // Invalidate cache if embedded data changed or revision is missing (legacy cache)
    if (cacheData.embeddedRevision !== EMBEDDED_REVISION) {
      safeRemoveItem(STORAGE_KEYS.CODES_CACHE);
      return null;
    }
    
    const age = Date.now() - cacheData.timestamp;
    const isExpired = age > DATA_CONFIG.CACHE_DURATION_MS;
    
    if (isExpired) {
      return null;
    }

    const normalizedCodes = normalizeCodes(cacheData.codes);
    if (normalizedCodes.length === 0 && Array.isArray(cacheData.codes) && cacheData.codes.length > 0) {
      safeRemoveItem(STORAGE_KEYS.CODES_CACHE);
      return null;
    }
    
    return {
      codes: normalizedCodes,
      timestamp: cacheData.timestamp,
      version: cacheData.version,
      source: cacheData.source === 'remote' ? 'remote' : 'local',
    };
  } catch (e) {
    safeRemoveItem(STORAGE_KEYS.CODES_CACHE);
    return null;
  }
};

/**
 * Saves data to localStorage cache with version info
 */
const setCacheData = (codes: ShiftCode[], source: 'local' | 'remote'): void => {
  try {
    const cacheData = {
      codes: normalizeCodes(codes),
      timestamp: Date.now(),
      version: DATA_VERSION,
      source,
      embeddedRevision: EMBEDDED_REVISION,
    };
    localStorage.setItem(STORAGE_KEYS.CODES_CACHE, JSON.stringify(cacheData));
    localStorage.setItem(STORAGE_KEYS.LAST_FETCH_ATTEMPT, Date.now().toString());
  } catch { /* private browsing, quota exceeded — continue without caching */ }
};

/**
 * Fetches codes from remote source with timeout
 */
const fetchRemoteCodes = async (): Promise<ShiftCode[] | null> => {
  if (!DATA_CONFIG.USE_REMOTE_DATA || !DATA_CONFIG.DATA_SOURCE_URL) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DATA_CONFIG.FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(DATA_CONFIG.DATA_SOURCE_URL, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Handle different response formats (direct array or wrapped in object)
    const parsed = Array.isArray(data) ? data : data.codes || data.record || [];
    const codes = normalizeCodes(parsed);
    
    if (codes.length === 0) {
      throw new Error('Invalid data format: expected non-empty array of codes');
    }

    return codes;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Remote fetch timed out
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Calculates time until next scheduled refresh
 */
const getTimeUntilRefresh = (lastFetched: Date): string => {
  const nextRefresh = new Date(lastFetched.getTime() + DATA_CONFIG.CACHE_DURATION_MS);
  const diff = nextRefresh.getTime() - Date.now();
  
  if (diff <= 0) return 'now';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return 'soon';
};

export function useShiftCodes() {
  const [codes, setCodes] = useState<ShiftCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [dataSource, setDataSource] = useState<'local' | 'remote'>('local');
  const [isStale, setIsStale] = useState(false);
  const fetchingRef = useRef(false);
  const backgroundCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Fetches codes from local data or remote source
   * Note: Twitter codes are fetched via GitHub Actions and merged into shiftCodes.ts
   */
  const fetchCodes = useCallback(async (forceRemote = false): Promise<FetchResult> => {
    // Try remote fetch first if enabled
    if (DATA_CONFIG.USE_REMOTE_DATA || forceRemote) {
      const remoteCodes = await fetchRemoteCodes();
      if (remoteCodes && remoteCodes.length > 0) {
        return { codes: remoteCodes, source: 'remote' };
      }
    }

    // Use embedded data (includes Twitter codes fetched by GitHub Actions)
    return { codes: mockShiftCodes, source: 'local' };
  }, []);

  /**
   * Main data loading function
   */
  const loadData = useCallback(async (skipCache = false) => {
    // Prevent concurrent fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    
    setIsLoading(true);
    
    try {
      // Check cache first (unless skipping)
      if (!skipCache) {
        const cachedData = getCachedData();
        if (cachedData) {
          setCodes(cachedData.codes);
          setLastFetched(new Date(cachedData.timestamp));
          setDataSource(cachedData.source);
          setIsStale(false);
          setIsLoading(false);
          fetchingRef.current = false;
          return;
        }
      }

      // Fetch fresh data
      const { codes: fetchedCodes, source } = await fetchCodes();
      
      setCacheData(fetchedCodes, source);
      setCodes(fetchedCodes);
      setLastFetched(new Date());
      setDataSource(source);
      setIsStale(false);
    } catch (error) {
      // Load embedded data as last resort
      setCodes(prev => prev.length === 0 ? mockShiftCodes : prev);
      setDataSource('local');
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [fetchCodes]);

  /**
   * Checks if data is stale (older than threshold)
   */
  const checkStaleness = useCallback(() => {
    if (!lastFetched) return;
    
    const age = Date.now() - lastFetched.getTime();
    setIsStale(age > DATA_CONFIG.STALE_THRESHOLD_MS);
  }, [lastFetched]);

  /**
   * Background check for updates (runs periodically when app is open)
   */
  const backgroundCheck = useCallback(async () => {
    if (!lastFetched || fetchingRef.current) return;
    
    const age = Date.now() - lastFetched.getTime();
    
    // Refresh if cache is expired
    if (age > DATA_CONFIG.CACHE_DURATION_MS) {
      await loadData(true);
    }
    
    checkStaleness();
  }, [lastFetched, loadData, checkStaleness]);

  // Initial load
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  // Set up background check interval
  useEffect(() => {
    // Clear any existing interval
    if (backgroundCheckRef.current) {
      clearInterval(backgroundCheckRef.current);
    }

    // Set up new interval for background checks
    backgroundCheckRef.current = setInterval(
      backgroundCheck,
      DATA_CONFIG.BACKGROUND_CHECK_INTERVAL_MS
    );

    return () => {
      if (backgroundCheckRef.current) {
        clearInterval(backgroundCheckRef.current);
      }
    };
  }, [backgroundCheck]);

  // Check staleness when lastFetched changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkStaleness();
  }, [checkStaleness]);

  /**
   * Force refresh - clears cache and fetches fresh data
   */
  const refresh = useCallback(async () => {
    safeRemoveItem(STORAGE_KEYS.CODES_CACHE);
    await loadData(true);
  }, [loadData]);

  // "Today" state that auto-updates at local midnight
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    const timerId = setTimeout(() => {
      setToday(new Date());
    }, msUntilMidnight + 100); // +100ms buffer past midnight

    return () => clearTimeout(timerId);
  }, [today]);

  // Memoized check if code was added today
  const isNewToday = useCallback((code: ShiftCode): boolean => {
    return isSameDay(parseLocalDate(code.addedAt), today);
  }, [today]);

  // Memoized check if code was added recently (within N days)
  const isRecent = useCallback((code: ShiftCode): boolean => {
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() - RECENT_DAYS_THRESHOLD);
    return parseLocalDate(code.addedAt) >= threshold;
  }, [today]);

  const newTodayCodes = useMemo(() => 
    codes.filter(c => isNewToday(c) && getEffectiveStatus(c) === 'active'),
    [codes, isNewToday]
  );

  const recentCodes = useMemo(() =>
    codes.filter(c => isRecent(c) && getEffectiveStatus(c) === 'active' && !isNewToday(c)),
    [codes, isRecent, isNewToday]
  );

  const activeCodes = useMemo(() => 
    codes.filter(c => getEffectiveStatus(c) === 'active').length,
    [codes]
  );

  // Process codes to apply auto-expiration logic
  const processedCodes = useMemo(() => 
    codes.map(code => ({
      ...code,
      status: getEffectiveStatus(code),
    })),
    [codes]
  );

  const nextRefreshIn = useMemo(() => 
    lastFetched ? getTimeUntilRefresh(lastFetched) : null,
    [lastFetched]
  );

  return {
    codes: processedCodes,
    isLoading,
    lastFetched,
    refresh,
    newTodayCodes,
    recentCodes,
    activeCodes,
    isNewToday,
    isRecent,
    // Refresh status
    dataSource,
    isStale,
    nextRefreshIn,
    cacheConfig: {
      cacheDuration: DATA_CONFIG.CACHE_DURATION_MS,
      staleThreshold: DATA_CONFIG.STALE_THRESHOLD_MS,
      useRemote: DATA_CONFIG.USE_REMOTE_DATA,
    },
  };
}
