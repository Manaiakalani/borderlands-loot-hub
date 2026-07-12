/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useShiftCodes } from '../hooks/useShiftCodes';
import { STORAGE_KEYS, DATA_VERSION } from '../config/dataConfig';
import type { ShiftCode } from '../data/shiftCodes';

function makeCode(overrides: Partial<ShiftCode> = {}): ShiftCode {
  return {
    id: 'test-code-1',
    code: 'AAAAA-BBBBB-CCCCC-DDDDD-EEEEE',
    game: 'BL3',
    status: 'active',
    reward: '3 Golden Keys',
    rewardType: 'golden-keys',
    source: 'test',
    addedAt: new Date().toISOString().split('T')[0],
    ...overrides,
  };
}

function makeCacheData(codes: ShiftCode[], opts: { timestamp?: number; version?: number; source?: string } = {}) {
  return JSON.stringify({
    codes,
    timestamp: opts.timestamp ?? Date.now(),
    version: opts.version ?? DATA_VERSION,
    source: opts.source ?? 'local',
  });
}

// Mock localStorage for test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

describe('useShiftCodes', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads embedded data when no cache exists', async () => {
    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.codes.length).toBeGreaterThan(0);
    expect(result.current.dataSource).toBe('local');
  });

  it('loads from cache when valid cache exists', async () => {
    const codes = [makeCode()];
    localStorage.setItem(STORAGE_KEYS.CODES_CACHE, makeCacheData(codes));

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.codes.length).toBe(1);
    expect(result.current.codes[0].id).toBe('test-code-1');
  });

  it('invalidates cache with mismatched version', async () => {
    const codes = [makeCode()];
    localStorage.setItem(STORAGE_KEYS.CODES_CACHE, makeCacheData(codes, { version: DATA_VERSION - 1 }));

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Should fall through to embedded data (more than 1 code)
    expect(result.current.codes.length).toBeGreaterThan(1);
  });

  it('invalidates expired cache (older than 7 days)', async () => {
    const codes = [makeCode()];
    const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
    localStorage.setItem(STORAGE_KEYS.CODES_CACHE, makeCacheData(codes, { timestamp: oldTimestamp }));

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Should fall through to embedded data
    expect(result.current.codes.length).toBeGreaterThan(1);
  });

  it('recovers from corrupted cache gracefully', async () => {
    localStorage.setItem(STORAGE_KEYS.CODES_CACHE, '{invalid json!!!');

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Should recover and load embedded data
    expect(result.current.codes.length).toBeGreaterThan(0);
    expect(result.current.dataSource).toBe('local');
  });

  it('rejects cache with invalid code format', async () => {
    const badCodes = [{ ...makeCode(), code: 'NOT-A-VALID-CODE' }];
    localStorage.setItem(STORAGE_KEYS.CODES_CACHE, makeCacheData(badCodes));

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Invalid codes should be normalized out, fallback to embedded
    expect(result.current.codes.length).toBeGreaterThan(1);
  });

  it('applies effective status (auto-expiration)', async () => {
    const expiredCode = makeCode({
      id: 'expired-test',
      status: 'active',
      expiresAt: '2020-01-01',
    });
    const codes = [expiredCode, makeCode({ id: 'active-test' })];
    localStorage.setItem(STORAGE_KEYS.CODES_CACHE, makeCacheData(codes));

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const expired = result.current.codes.find(c => c.id === 'expired-test');
    const active = result.current.codes.find(c => c.id === 'active-test');
    expect(expired?.status).toBe('expired');
    expect(active?.status).toBe('active');
  });

  it('identifies new-today codes correctly', async () => {
    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Use local date formatting (not UTC via toISOString)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayCode = makeCode({ id: 'today-code', addedAt: todayStr });
    const oldCode = makeCode({ id: 'old-code', addedAt: '2020-01-01' });

    expect(result.current.isNewToday(todayCode)).toBe(true);
    expect(result.current.isNewToday(oldCode)).toBe(false);
  });

  it('identifies recent codes within threshold', async () => {
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const recentStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    const recentCode = makeCode({ id: 'recent-code', addedAt: recentStr });
    const oldCode = makeCode({ id: 'old-code', addedAt: '2020-01-01' });

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isRecent(recentCode)).toBe(true);
    expect(result.current.isRecent(oldCode)).toBe(false);
  });

  it('refresh clears cache and reloads', async () => {
    const codes = [makeCode()];
    localStorage.setItem(STORAGE_KEYS.CODES_CACHE, makeCacheData(codes));

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.codes.length).toBe(1);

    await act(async () => {
      await result.current.refresh();
    });

    // After refresh, cache is cleared and falls through to embedded data
    expect(result.current.codes.length).toBeGreaterThan(1);
  });
});
