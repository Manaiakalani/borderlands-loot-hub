import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * GitHub Pages serves 404.html for any path it cannot resolve, and this app relies on
 * that file to hand the original route to the SPA. These tests run the *real*
 * public/404.html capture expression and the *real* public/restore-route.js against a
 * simulated navigation, rather than restating their logic, so a change to either file
 * that drops part of the URL fails here.
 */

const BASE = '/borderlands-loot-hub';

const captureExpression = (() => {
  const html = readFileSync('public/404.html', 'utf-8');
  const match = html.match(/const path = ([^;]+);/);
  if (!match) throw new Error('public/404.html no longer assigns `const path = ...`');
  return match[1];
})();

const restoreSource = readFileSync('public/restore-route.js', 'utf-8');

/** Simulate the full GH Pages round trip: 404 capture, redirect to root, then restore. */
const roundTrip = (pathname: string, search = '', hash = '') => {
  const store: Record<string, string> = {};
  const sessionStorage = {
    setItem: (k: string, v: string) => { store[k] = v; },
    getItem: (k: string) => store[k] ?? null,
    removeItem: (k: string) => { delete store[k]; },
  };

  let restoredUrl: string | null = null;
  const windowStub = {
    location: { pathname, search, hash },
    history: { replaceState: (_s: unknown, _t: unknown, url: string) => { restoredUrl = url; } },
  };

  const captured = new Function('window', `return ${captureExpression}`)(windowStub) as string;
  if (windowStub.location.pathname.startsWith(BASE)) sessionStorage.setItem('redirect', captured);

  // The browser then loads the SPA at the repo root, where restore-route.js runs.
  windowStub.location = { pathname: `${BASE}/`, search: '', hash: '' };
  new Function('sessionStorage', 'window', restoreSource)(sessionStorage, windowStub);

  return { restoredUrl: restoredUrl ?? `${BASE}/`, stored: store.redirect };
};

describe('GitHub Pages deep-link restoration', () => {
  it('restores a plain route', () => {
    expect(roundTrip(`${BASE}/about`).restoredUrl).toBe(`${BASE}/about`);
  });

  it('preserves the query string', () => {
    // Campaign and referral links carry ?utm_*; dropping them silently loses attribution.
    expect(roundTrip(`${BASE}/privacy`, '?utm_source=x&ref=y').restoredUrl).toBe(
      `${BASE}/privacy?utm_source=x&ref=y`,
    );
  });

  it('preserves the hash fragment', () => {
    expect(roundTrip(`${BASE}/about`, '', '#section-2').restoredUrl).toBe(`${BASE}/about#section-2`);
  });

  it('preserves query and hash together', () => {
    expect(roundTrip(`${BASE}/about`, '?q=1', '#s').restoredUrl).toBe(`${BASE}/about?q=1#s`);
  });

  it('leaves the root route alone', () => {
    // Guards the `route !== '/'` branch: rewriting the root would be a pointless
    // history entry, and an off-by-one in the slice would surface here.
    expect(roundTrip(`${BASE}/`).restoredUrl).toBe(`${BASE}/`);
  });

  it('clears the stored redirect so a later reload does not replay it', () => {
    const store: Record<string, string> = { redirect: `${BASE}/about` };
    const sessionStorage = {
      setItem: (k: string, v: string) => { store[k] = v; },
      getItem: (k: string) => store[k] ?? null,
      removeItem: (k: string) => { delete store[k]; },
    };
    const windowStub = {
      location: { pathname: `${BASE}/`, search: '', hash: '' },
      history: { replaceState: () => {} },
    };
    new Function('sessionStorage', 'window', restoreSource)(sessionStorage, windowStub);
    expect(store.redirect).toBeUndefined();
  });

  it('ignores paths outside the repo base', () => {
    expect(roundTrip('/somewhere-else').stored).toBeUndefined();
  });
});
