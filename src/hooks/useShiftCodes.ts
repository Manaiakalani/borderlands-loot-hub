import { useState, useEffect, useMemo } from 'react';
import { mockShiftCodes, ShiftCode, GameType, CodeStatus } from '@/data/shiftCodes';

const CACHE_KEY = 'shift_codes_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CacheData {
  codes: ShiftCode[];
  timestamp: number;
}

export function useShiftCodes() {
  const [codes, setCodes] = useState<ShiftCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Load from cache or fetch
  useEffect(() => {
    const loadCodes = () => {
      const cached = localStorage.getItem(CACHE_KEY);
      
      if (cached) {
        try {
          const cacheData: CacheData = JSON.parse(cached);
          const isExpired = Date.now() - cacheData.timestamp > CACHE_DURATION;
          
          if (!isExpired) {
            setCodes(cacheData.codes);
            setLastFetched(new Date(cacheData.timestamp));
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.error('Failed to parse cache:', e);
        }
      }
      
      // Simulate fetch with mock data
      fetchCodes();
    };

    loadCodes();
  }, []);

  const fetchCodes = async () => {
    setIsLoading(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // In real implementation, this would fetch from APIs
    const fetchedCodes = mockShiftCodes;
    
    // Cache the results
    const cacheData: CacheData = {
      codes: fetchedCodes,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    
    setCodes(fetchedCodes);
    setLastFetched(new Date());
    setIsLoading(false);
  };

  const refresh = async () => {
    // Clear cache and refetch
    localStorage.removeItem(CACHE_KEY);
    await fetchCodes();
  };

  // Check if code was added today
  const isNewToday = (code: ShiftCode): boolean => {
    const today = new Date();
    const addedDate = new Date(code.addedAt);
    return (
      addedDate.getDate() === today.getDate() &&
      addedDate.getMonth() === today.getMonth() &&
      addedDate.getFullYear() === today.getFullYear()
    );
  };

  // Check if code was added recently (within 3 days)
  const isRecent = (code: ShiftCode): boolean => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    return new Date(code.addedAt) >= threeDaysAgo;
  };

  const newTodayCodes = useMemo(() => 
    codes.filter(c => isNewToday(c) && c.status === 'active'),
    [codes]
  );

  const recentCodes = useMemo(() =>
    codes.filter(c => isRecent(c) && c.status === 'active' && !isNewToday(c)),
    [codes]
  );

  const activeCodes = useMemo(() => 
    codes.filter(c => c.status === 'active').length,
    [codes]
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
  };
}
