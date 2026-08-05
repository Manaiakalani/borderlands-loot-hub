import { describe, expect, it } from 'vitest';
import { evaluateAudit } from '../../scripts/audit-triage.mjs';

/**
 * The triage script decides whether a dependency advisory blocks the build. Its two
 * real bugs so far both lived in branches that could only be reached by hand — most
 * seriously, npm's own JSON error envelope was parsed as "zero vulnerabilities",
 * which turned a broken audit into a passing security gate. These tests drive the
 * pure decision function directly so those paths stay covered.
 */

const ACCEPTED = [
  {
    id: 'GHSA-test-0001',
    module: 'demo-pkg',
    title: 'Example advisory',
    reason: 'Not reachable in this app.',
    verify: 'grep for the vulnerable API',
    reviewed: '2026-01-01',
  },
];

const reportWith = (advisories: Array<{ id: string; name: string; severity: string }>) => ({
  vulnerabilities: Object.fromEntries(
    advisories.map((a) => [
      a.name,
      {
        name: a.name,
        severity: a.severity,
        via: [
          {
            name: a.name,
            severity: a.severity,
            title: `${a.name} issue`,
            url: `https://github.com/advisories/${a.id}`,
          },
        ],
      },
    ]),
  ),
});

describe('evaluateAudit', () => {
  it('passes when the only advisory is a documented acceptance', () => {
    const result = evaluateAudit(
      reportWith([{ id: 'GHSA-test-0001', name: 'demo-pkg', severity: 'high' }]),
      ACCEPTED,
    );
    expect(result.ok).toBe(true);
    expect(result.fatal).toBeNull();
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].acceptance.reason).toMatch(/not reachable/i);
  });

  it('fails on an advisory nobody has triaged', () => {
    const result = evaluateAudit(
      reportWith([
        { id: 'GHSA-test-0001', name: 'demo-pkg', severity: 'high' },
        { id: 'GHSA-brand-new', name: 'other-pkg', severity: 'critical' },
      ]),
      ACCEPTED,
    );
    expect(result.ok).toBe(false);
    expect(result.unexpected.map((a: { id: string }) => a.id)).toEqual(['GHSA-brand-new']);
  });

  it('fails when an accepted advisory is no longer reported', () => {
    // Otherwise the allowlist quietly decays into a list of stale excuses that
    // suppress advisories nobody has looked at in years.
    const result = evaluateAudit(reportWith([]), ACCEPTED);
    expect(result.ok).toBe(false);
    expect(result.stale.map((a: { id: string }) => a.id)).toEqual(['GHSA-test-0001']);
  });

  it('treats an npm error envelope as fatal, never as a clean report', () => {
    // This is the regression that matters most: a valid-JSON error response has no
    // `vulnerabilities` key, so a naive reader concludes there is nothing wrong.
    const result = evaluateAudit(
      { error: { code: 'EALLOWSCRIPTS', summary: 'not allowed in project-scoped installs' } },
      ACCEPTED,
    );
    expect(result.ok).toBe(false);
    expect(result.fatal).toMatch(/EALLOWSCRIPTS/);
  });

  it('treats a report with no vulnerabilities field as fatal', () => {
    const result = evaluateAudit({ metadata: {} }, ACCEPTED);
    expect(result.ok).toBe(false);
    expect(result.fatal).toMatch(/vulnerabilities/);
  });

  it('passes on a genuinely clean report with an empty allowlist', () => {
    const result = evaluateAudit(reportWith([]), []);
    expect(result.ok).toBe(true);
    expect(result.fatal).toBeNull();
    expect(result.accepted).toHaveLength(0);
  });

  it('ignores string `via` entries, which point at packages rather than advisories', () => {
    const report = {
      vulnerabilities: {
        'downstream-pkg': { name: 'downstream-pkg', severity: 'high', via: ['upstream-pkg'] },
      },
    };
    const result = evaluateAudit(report, []);
    expect(result.ok).toBe(true);
    expect(result.unexpected).toHaveLength(0);
  });
});
