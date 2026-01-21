import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { mockShiftCodes, ShiftCode } from '@/data/shiftCodes';
import { DATA_CONFIG, STORAGE_KEYS, DATA_VERSION } from '@/config/dataConfig';

const RECENT_DAYS_THRESHOLD = 3;

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
    
    const cacheData: CacheData = JSON.parse(cached);
    
    // Invalidate cache if data version changed
    if (cacheData.version !== DATA_VERSION) {
      console.log('Cache invalidated: data version changed');
      localStorage.removeItem(STORAGE_KEYS.CODES_CACHE);
      return null;
    }
    
    const age = Date.now() - cacheData.timestamp;
    const isExpired = age > DATA_CONFIG.CACHE_DURATION_MS;
    
    if (isExpired) {
      console.log(`Cache expired (age: ${Math.round(age / (1000 * 60 * 60))}h)`);
      return null;
    }
    
    return cacheData;
  } catch (e) {
    console.error('Failed to parse cache:', e);
    localStorage.removeItem(STORAGE_KEYS.CODES_CACHE);
    return null;
  }
};

/**
 * Saves data to localStorage cache with version info
 */
const setCacheData = (codes: ShiftCode[], source: 'local' | 'remote'): void => {
  const cacheData: CacheData = {
    codes,
    timestamp: Date.now(),
    version: DATA_VERSION,
    source,
  };
  localStorage.setItem(STORAGE_KEYS.CODES_CACHE, JSON.stringify(cacheData));
  localStorage.setItem(STORAGE_KEYS.LAST_FETCH_ATTEMPT, Date.now().toString());
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
    const codes: ShiftCode[] = Array.isArray(data) ? data : data.codes || data.record || [];
    
    if (!Array.isArray(codes) || codes.length === 0) {
      throw new Error('Invalid data format: expected non-empty array of codes');
    }

    console.log(`Fetched ${codes.length} codes from remote source`);
    return codes;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('Remote fetch timed out');
    } else {
      console.warn('Failed to fetch remote codes:', error);
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
      console.error('Failed to load codes:', error);
      // If we have no codes, load embedded data as last resort
      if (codes.length === 0) {
        setCodes(mockShiftCodes);
        setDataSource('local');
      }
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [fetchCodes, codes.length]);

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
      console.log('Background refresh triggered: cache expired');
      await loadData(true);
    }
    
    checkStaleness();
  }, [lastFetched, loadData, checkStaleness]);

  // Initial load
  useEffect(() => {
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
    checkStaleness();
  }, [checkStaleness]);

  /**
   * Force refresh - clears cache and fetches fresh data
   */
  const refresh = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEYS.CODES_CACHE);
    await loadData(true);
  }, [loadData]);

  // Memoized check if code was added today
  const isNewToday = useCallback((code: ShiftCode): boolean => {
    return isSameDay(new Date(code.addedAt), new Date());
  }, []);

  // Memoized check if code was added recently (within N days)
  const isRecent = useCallback((code: ShiftCode): boolean => {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - RECENT_DAYS_THRESHOLD);
    return new Date(code.addedAt) >= threshold;
  }, []);

  const newTodayCodes = useMemo(() => 
    codes.filter(c => isNewToday(c) && c.status === 'active'),
    [codes, isNewToday]
  );

  const recentCodes = useMemo(() =>
    codes.filter(c => isRecent(c) && c.status === 'active' && !isNewToday(c)),
    [codes, isRecent, isNewToday]
  );

  const activeCodes = useMemo(() => 
    codes.filter(c => c.status === 'active').length,
    [codes]
  );

  const nextRefreshIn = useMemo(() => 
    lastFetched ? getTimeUntilRefresh(lastFetched) : null,
    [lastFetched]
  );

  return {
    codes,
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
