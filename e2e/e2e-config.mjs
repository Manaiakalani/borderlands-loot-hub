/**
 * Shared configuration for both E2E suites (Playwright and Puppeteer).
 *
 * The port is deliberately NOT Vite's default 4173. That default is shared by
 * every Vite project on the machine, and a preview server left running by an
 * unrelated project will happily answer on it — which silently produced a full
 * suite of false failures. A project-specific port plus --strictPort means a
 * collision fails loudly instead of testing somebody else's app.
 */
export const PREVIEW_PORT = 4273;
export const BASE_PATH = '/borderlands-loot-hub/';
export const BASE_URL = `http://localhost:${PREVIEW_PORT}${BASE_PATH}`;

/**
 * Third-party origins the site is allowed to contact.
 *
 * Single source of truth for both E2E suites. This must stay consistent with the
 * Content-Security-Policy in nginx.conf — if you add an origin here, add it to
 * the matching CSP directive too, and vice versa.
 */
export const ALLOWED_THIRD_PARTY_ORIGINS = [
  'https://analytics.manaiakalani.info', // connect-src / script-src
  'https://fonts.googleapis.com', // style-src
  'https://fonts.gstatic.com', // font-src
];

/** True when a request URL is either same-origin/local or an allowlisted third party. */
export function isAllowedRequestUrl(url) {
  if (url.startsWith('http://localhost') || url.startsWith('data:') || url.startsWith('blob:')) {
    return true;
  }
  return ALLOWED_THIRD_PARTY_ORIGINS.some((origin) => url.startsWith(origin));
}
