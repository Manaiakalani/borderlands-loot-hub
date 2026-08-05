#!/usr/bin/env node
/**
 * Triaged production dependency audit.
 *
 * `npm audit` is all-or-nothing: one advisory that cannot affect this app leaves the
 * check permanently red, and a permanently red check is one nobody reads. That is the
 * failure mode this script exists to prevent — not to silence findings.
 *
 * Behaviour:
 *   - Any advisory NOT in ACCEPTED fails the run, so genuinely new vulnerabilities
 *     still break the build.
 *   - An ACCEPTED entry that no longer appears also fails the run, so the allowlist
 *     cannot quietly rot into a list of stale excuses.
 *   - Each acceptance carries a written, checkable reason and a review date.
 *
 * Dev-only dependencies are excluded (`--omit=dev`): they never reach a user's browser
 * because the deployed artifact is a static bundle.
 */

import { execSync } from 'node:child_process';

/**
 * Advisories consciously accepted, with the reason they cannot affect this app.
 * `verify` is a human-checkable assertion, not a vibe — if it stops being true, the
 * entry must be removed and the dependency upgraded.
 */
const ACCEPTED = [
  {
    id: 'GHSA-qwww-vcr4-c8h2',
    module: 'react-router',
    title: 'RSC Mode CSRF Bypass Allows Action Execution Before 400 Response',
    reason:
      'The vulnerability is reachable only through React Router RSC server request handlers ' +
      '(matchRSCServerRequest / routeRSCServerRequest). This app ships a static bundle to ' +
      'GitHub Pages with no server runtime of any kind, and uses only the declarative client ' +
      'APIs: BrowserRouter, Routes, Route, Link. There is no server action to bypass CSRF on.',
    verify:
      'grep the src tree for RSC/server APIs — expected zero hits: ' +
      'unstable_RSC, matchRSCServerRequest, routeRSCServerRequest, createRequestHandler',
    reviewed: '2026-02-10',
  },
];

const acceptedById = new Map(ACCEPTED.map((a) => [a.id, a]));

function runAudit() {
  // A constant command string: there is no interpolated input anywhere here, so there
  // is no injection surface. Note this deliberately avoids execFileSync with an args
  // array — on Windows npm is a .cmd shim, which Node refuses to spawn without a shell
  // (EINVAL), and passing an args array *with* a shell trips DEP0190.
  //
  // The npm_config_* variables are stripped because npm exports its own resolved config
  // into the environment of the scripts it runs. A nested `npm audit` then inherits
  // settings it rejects (EALLOWSCRIPTS), which made this check pass standalone but fail
  // under `npm run`. Stripping them makes the result independent of how it was invoked.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toLowerCase().startsWith('npm_config_')),
  );
  try {
    return execSync('npm audit --omit=dev --json', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env,
    });
  } catch (error) {
    // npm audit exits non-zero whenever findings exist; the JSON is still on stdout.
    if (error.stdout) return error.stdout;
    throw error;
  }
}

/** Collect the advisory ids npm reported, mapped to a readable summary. */
function collectAdvisories(report) {
  const found = new Map();
  for (const vuln of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      // A string `via` is a transitive pointer to another package, not an advisory.
      if (typeof via !== 'object' || !via.url) continue;
      const id = via.url.split('/').pop();
      found.set(id, {
        id,
        module: via.name ?? vuln.name,
        severity: via.severity ?? vuln.severity,
        title: via.title ?? '(no title)',
        url: via.url,
      });
    }
  }
  return found;
}

const report = JSON.parse(runAudit());

// npm reports its own failures as a well-formed JSON envelope with an `error` key and
// no `vulnerabilities`. Parsing that as "nothing found" would turn a broken audit into
// a green check — the single worst outcome for a security gate — so treat it as fatal.
if (report.error) {
  console.error('FAIL: npm audit did not run.');
  console.error(`  ${report.error.code ?? 'unknown'}: ${report.error.summary ?? ''}`);
  if (report.error.detail) console.error(`  ${report.error.detail}`);
  process.exit(1);
}
if (typeof report.vulnerabilities !== 'object' || report.vulnerabilities === null) {
  console.error('FAIL: npm audit returned no `vulnerabilities` field; the output format may have changed.');
  console.error(`  received keys: ${Object.keys(report).join(', ') || '(none)'}`);
  process.exit(1);
}

const found = collectAdvisories(report);

const unexpected = [...found.values()].filter((a) => !acceptedById.has(a.id));
const stale = ACCEPTED.filter((a) => !found.has(a.id));

for (const advisory of found.values()) {
  const accepted = acceptedById.get(advisory.id);
  if (!accepted) continue;
  console.log(`accepted  ${advisory.id}  ${advisory.module} (${advisory.severity})`);
  console.log(`          ${accepted.reason}`);
  console.log(`          verify: ${accepted.verify}`);
  console.log(`          last reviewed: ${accepted.reviewed}`);
}

if (unexpected.length > 0) {
  console.error(`\nFAIL: ${unexpected.length} untriaged advisory/advisories in production dependencies:`);
  for (const a of unexpected) {
    console.error(`  ${a.severity.toUpperCase()}  ${a.module}  ${a.id}  ${a.title}`);
    console.error(`         ${a.url}`);
  }
  console.error('\nFix the dependency, or add a justified entry to ACCEPTED in scripts/audit-triage.mjs.');
}

if (stale.length > 0) {
  console.error(`\nFAIL: ${stale.length} accepted advisory/advisories no longer reported:`);
  for (const a of stale) {
    console.error(`  ${a.id} (${a.module}) — resolved or renamed. Remove it from ACCEPTED.`);
  }
}

if (unexpected.length > 0 || stale.length > 0) process.exit(1);

console.log(
  `\nOK: ${found.size} production advisory/advisories, all triaged and documented (0 untriaged).`,
);
