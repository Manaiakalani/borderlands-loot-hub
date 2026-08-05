/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useShiftCodes, computeEmbeddedRevision } from '../hooks/useShiftCodes';
import { STORAGE_KEYS, DATA_VERSION } from '../config/dataConfig';
import { mockShiftCodes } from '../data/shiftCodes';
import type { ShiftCode } from '../data/shiftCodes';

// Derived from the hook's own exported helper rather than re-deriving the formula:
// the previous copy silently went stale when the revision became content-sensitive.
const EMBEDDED_REVISION = computeEmbeddedRevision(mockShiftCodes);

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

function makeCacheData(codes: ShiftCode[], opts: { timestamp?: number; version?: number; source?: string; embeddedRevision?: string } = {}) {
  return JSON.stringify({
    codes,
    timestamp: opts.timestamp ?? Date.now(),
    version: opts.version ?? DATA_VERSION,
    source: opts.source ?? 'local',
    embeddedRevision: opts.embeddedRevision ?? EMBEDDED_REVISION,
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

  it('invalidates legacy cache without embeddedRevision', async () => {
    const codes = [makeCode()];
    const legacyCache = JSON.stringify({
      codes,
      timestamp: Date.now(),
      version: DATA_VERSION,
      source: 'local',
      // no embeddedRevision field
    });
    localStorage.setItem(STORAGE_KEYS.CODES_CACHE, legacyCache);

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Should fall through to embedded data since legacy cache is invalidated
    expect(result.current.codes.length).toBeGreaterThan(1);
  });

  it('rejects codes with impossible calendar dates in expiresAt', async () => {
    const badDateCode = makeCode({
      id: 'bad-date',
      expiresAt: '2026-99-99', // impossible date
    });
    const codes = [badDateCode];
    localStorage.setItem(STORAGE_KEYS.CODES_CACHE, makeCacheData(codes));

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const found = result.current.codes.find(c => c.id === 'bad-date');
    // expiresAt should be stripped (undefined) since it's an impossible date
    expect(found?.expiresAt).toBeUndefined();
  });

  // Regression: the recency window was computed from the current wall-clock time
  // rather than start-of-day, so a code added exactly N days ago was excluded
  // for all but the first instant of the day.
  it('includes a code added exactly at the recency boundary, late in the day', async () => {
    // Fix "now" to late evening so the un-normalised threshold would be 22:45.
    const now = new Date(2026, 5, 15, 22, 45, 0);
    vi.setSystemTime(now);

    const boundary = new Date(2026, 5, 12); // exactly 3 days earlier (RECENT_DAYS_THRESHOLD)
    const boundaryStr = `${boundary.getFullYear()}-${String(boundary.getMonth() + 1).padStart(2, '0')}-${String(boundary.getDate()).padStart(2, '0')}`;
    const boundaryCode = makeCode({ id: 'boundary-code', addedAt: boundaryStr });

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isRecent(boundaryCode)).toBe(true);

    // One day beyond the window is still excluded.
    const outside = makeCode({ id: 'outside-code', addedAt: '2026-06-11' });
    expect(result.current.isRecent(outside)).toBe(false);

    vi.useRealTimers();
  });

  // Regression: staleness was derived from `lastFetched`, which resets on every
  // page load, so the stale warning could never fire.
  it('flags stale data based on the newest code date, not load time', async () => {
    const now = new Date(2026, 5, 15, 12, 0, 0);
    vi.setSystemTime(now);

    // Newest code is 30 days old — well past the 14-day stale threshold.
    const staleCodes = [makeCode({ id: 'stale-1', addedAt: '2026-05-16' })];
    localStorage.setItem(STORAGE_KEYS.CODES_CACHE, makeCacheData(staleCodes));

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.isStale).toBe(true));

    vi.useRealTimers();
  });

  it('does not flag stale data when codes are recent', async () => {
    const now = new Date(2026, 5, 15, 12, 0, 0);
    vi.setSystemTime(now);

    const freshCodes = [makeCode({ id: 'fresh-1', addedAt: '2026-06-14' })];
    localStorage.setItem(STORAGE_KEYS.CODES_CACHE, makeCacheData(freshCodes));

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isStale).toBe(false);

    vi.useRealTimers();
  });
});

// normalizeCodes is the trust boundary for everything that isn't the embedded
// dataset: today that's localStorage, but the same function guards fetchRemoteCodes
// the moment VITE_DATA_SOURCE_URL is configured. Two of these rules are crash
// guards rather than cosmetics — CodeCard indexes STATUS_CONFIG[code.status] and
// GAME_INFO[code.game] directly, so an unrecognised value throws and takes the
// whole list down. Only the code-format rule had a test.
describe('useShiftCodes cache validation', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // A known-good entry rides along in every cache so a rejection is visible as
  // "only the sentinel survived" rather than as a fallback to the embedded data,
  // which would look identical no matter which rule fired.
  const sentinel = makeCode({ id: 'sentinel', code: 'ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ' });

  const rejected: Array<[string, Record<string, unknown>]> = [
    ['id is missing', { id: undefined }],
    ['id is blank', { id: '   ' }],
    ['id is not a string', { id: 42 }],
    ['code is malformed', { code: 'NOT-A-VALID-CODE' }],
    ['game is unrecognised', { game: 'BL9' }],
    ['game is not a string', { game: 3 }],
    ['status is unrecognised', { status: 'pending' }],
    ['status is not a string', { status: null }],
    ['reward is not a string', { reward: { text: 'keys' } }],
    ['rewardType is unrecognised', { rewardType: 'mystery-box' }],
    ['source is a non-string', { source: 12345 }],
    ['addedAt is not a date', { addedAt: 'yesterday' }],
    ['addedAt is missing', { addedAt: undefined }],
  ];

  it.each(rejected)('drops a cached entry when %s', async (_label, overrides) => {
    const bad = { ...makeCode({ id: 'bad-entry' }), ...overrides };
    localStorage.setItem(STORAGE_KEYS.CODES_CACHE, makeCacheData([sentinel, bad] as ShiftCode[]));

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.codes.map((c) => c.id)).toEqual(['sentinel']);
  });

  it('falls back to embedded data when the cached codes are not an array', async () => {
    localStorage.setItem(
      STORAGE_KEYS.CODES_CACHE,
      JSON.stringify({
        codes: { '0': sentinel },
        timestamp: Date.now(),
        version: DATA_VERSION,
        source: 'local',
        embeddedRevision: EMBEDDED_REVISION,
      })
    );

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.codes.length).toBeGreaterThan(1);
    expect(result.current.codes.some((c) => c.id === 'sentinel')).toBe(false);
    // Left in place it would keep blanking the page for the whole 7-day window.
    // The hook re-caches the embedded data it fell back to, so the key exists
    // again — what matters is that the malformed payload is gone.
    expect(localStorage.getItem(STORAGE_KEYS.CODES_CACHE)).not.toContain('sentinel');
  });

  it('falls back to embedded data when the cache holds an empty code list', async () => {
    localStorage.setItem(STORAGE_KEYS.CODES_CACHE, makeCacheData([]));

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.codes.length).toBeGreaterThan(1);
  });

  it('falls back to embedded data when every cached entry fails validation', async () => {
    const allBad = [
      { ...makeCode({ id: 'bad-1' }), game: 'BL9' },
      { ...makeCode({ id: 'bad-2' }), code: 'NOPE' },
    ] as unknown as ShiftCode[];
    localStorage.setItem(STORAGE_KEYS.CODES_CACHE, makeCacheData(allBad));

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.codes.length).toBeGreaterThan(1);
    expect(localStorage.getItem(STORAGE_KEYS.CODES_CACHE)).not.toContain('bad-1');
  });

  it('strips control characters out of cached free text', async () => {
    const code = makeCode({ id: 'ctrl', reward: '5 Golden\u0000\u001b Keys', source: 'r/test\u0007' });
    localStorage.setItem(STORAGE_KEYS.CODES_CACHE, makeCacheData([code]));

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.codes[0].reward).toBe('5 Golden Keys');
    expect(result.current.codes[0].source).toBe('r/test');
  });

  it('caps cached free text at 200 characters', async () => {
    const code = makeCode({ id: 'long', reward: 'A'.repeat(500) });
    localStorage.setItem(STORAGE_KEYS.CODES_CACHE, makeCacheData([code]));

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.codes[0].reward).toHaveLength(200);
  });

  it('substitutes a fallback when cached free text sanitizes to nothing', async () => {
    const code = makeCode({ id: 'empty', reward: '\u0000\u0001\u0002' });
    localStorage.setItem(STORAGE_KEYS.CODES_CACHE, makeCacheData([code]));

    const { result } = renderHook(() => useShiftCodes());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.codes[0].reward).toBe('SHiFT Reward');
  });
});
