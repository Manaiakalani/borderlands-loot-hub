# Copilot Instructions - Borderlands SHiFT Vault

## Project Overview

This is a React + TypeScript web application that aggregates and displays SHiFT codes for Borderlands games (BL1, BL2, TPS, BL3, BL4, Wonderlands). It features a Borderlands-themed UI with automatic code expiration tracking, local caching, and a daily Reddit fetch via GitHub Actions.

## Build & Test Commands

```bash
# Development
npm run dev              # Start Vite dev server (http://localhost:5173)

# Building
npm run build            # Production build
npm run build:dev        # Development build
npm run preview          # Preview production build

# Testing
npm run test             # Run all tests once (Vitest)
npm run test:watch       # Run tests in watch mode
npx vitest src/hooks/useShiftCodes.test.ts  # Run single test file

# Linting
npm run lint             # Run ESLint on all files
```

## Architecture & Key Patterns

### Data Flow Architecture

The app uses a **three-tier data system**:

1. **Embedded data** (`src/data/shiftCodes.ts`) - Primary source, includes GitHub Actions-fetched Reddit codes
2. **LocalStorage cache** (`useShiftCodes` hook) - 7-day browser cache with version control
3. **Remote fetch** (optional) - Can fetch from external JSON endpoint if configured

**Critical**: Codes are NOT fetched client-side. The daily job is `.github/workflows/fetch-reddit-codes.yml`, which commits new rows directly to `shiftCodes.ts`.

### State Management Pattern

Uses **React Query pattern without React Query**:
- Single source of truth: `useShiftCodes` hook
- Automatic background refresh (24h intervals)
- Cache invalidation on data version changes
- Stale data detection (14-day threshold)

### Component Structure

```
Index.tsx (main page)
  └─ useShiftCodes() hook (data management)
      ├─ Header (stats display)
      ├─ NewTodaySection (highlighted new codes)
      ├─ FilterBar (game/status filters)
      └─ CodeList (grid of CodeCard components)
```

**Pattern**: Components are presentational, logic lives in hooks. `useShiftCodes` returns processed data and helper functions (`isNewToday`, `isRecent`, `refresh`).

### Auto-Expiration Logic

Codes have **dual status tracking**:
- `status` field: Manual status from data source
- `expiresAt` field: ISO date string for automatic expiration

Use `getEffectiveStatus(code)` helper to get computed status. This function auto-expires codes past their `expiresAt` date regardless of manual status.

### Theme System

Borderlands-themed with CSS variables in `src/index.css`:
- `--primary` (vault gold): `hsl(45 95% 55%)`
- `--accent` (orange): `hsl(25 95% 55%)`
- Game-specific colors in `GAME_INFO` constant

Uses **shadcn/ui** components (Radix primitives + Tailwind). Add new components with:
```bash
npx shadcn@latest add <component-name>
```

## Key Conventions

### File Organization

- **Components**: One component per file, named export matches filename
- **Hooks**: Custom hooks prefixed with `use`, live in `src/hooks/`
- **Types**: Defined in the file they're used most, exported for reuse
- **Constants**: Config objects use `as const` for type inference

### Type Definitions

```typescript
// Game codes: 'BL1' | 'BL2' | 'TPS' | 'BL3' | 'BL4' | 'WONDERLANDS'
// Status: 'active' | 'expired' | 'unknown'
// Reward types: 'golden-keys' | 'skeleton-keys' | 'diamond-keys' | 'skin' | 'cosmetic' | 'weapon' | 'other'
```

**Always use `GameType`, `CodeStatus`, `RewardType` types** from `src/data/shiftCodes.ts`.

### Data Updates

When adding new codes to `shiftCodes.ts`:
1. Generate unique ID: `{game}-{description}-{yyyymmdd}` (e.g., `bl4-golden-key-20260209`)
2. Set `addedAt` to current date (ISO format: `YYYY-MM-DD`)
3. Set `expiresAt` to `null` for indefinite codes, or ISO string for expiring codes
4. Include `source` (e.g., 'mentalmars.com', 'r/Borderlandsshiftcodes')
5. Increment `DATA_VERSION` in `dataConfig.ts` if changing data structure
6. **Never add a "verified" claim.** `lastVerifiedAt` was removed in v6 — nothing
   in this repo redeems a code, so any such field is an unsubstantiated claim.
   `assertValidCodeShape` rejects it outright.

`src/test/shiftCodesData.test.ts` runs integrity assertions against the committed
dataset (unique ids, well-formed codes, plausible expiry window, no self-
contradicting status). Keep those assertions **time-independent** — the scraper
workflows run `npm test` before committing, so a clock-dependent assertion would
eventually fail on its own and block automated updates.

### Cache Management

The app uses **versioned caching**:
- Cache key: `shift_codes_cache` in localStorage
- Version: `DATA_VERSION` constant in `dataConfig.ts`
- **Increment `DATA_VERSION`** when making breaking changes to `ShiftCode` interface or data structure
- Content revision: `computeEmbeddedRevision()` in `useShiftCodes.ts` is an FNV-1a
  hash over the rendered fields, so *editing* an existing entry also invalidates
  the cache. Don't reduce it to a length/id summary — corrections would then stay
  invisible to returning visitors for the full 7-day window.

Cache automatically invalidates when:
- Data version changes (prevents type mismatches)
- The embedded data content changes (any field that affects rendering)
- 7 days have passed since last fetch
- User manually refreshes

### Path Aliases

Uses TypeScript path aliases configured in `tsconfig.json` and `vite.config.ts`:
```typescript
import { useShiftCodes } from '@/hooks/useShiftCodes';
import { ShiftCode } from '@/data/shiftCodes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
```

**Always use `@/` imports**, never relative paths for `src/` files.

### GitHub Actions Integration

The `fetch-reddit-codes.yml` workflow is the only scheduled fetch:
- Runs daily at 9 AM UTC
- No API keys or secrets. Reddit blocks the unauthenticated `.json` endpoint from
  GitHub Actions, and a burst of RSS requests returns HTTP 429, so the script
  requests one feed at a time, retries 429/502/503, and falls through to Arctic
  Shift and then PullPush when RSS returns nothing
- Scrapes 4 subreddits: r/Borderlands4, r/Borderlands, r/borderlands3, r/Borderlandsshiftcodes
- A bare `MULTI` title is filed on BL1, BL2, TPS, BL3, and BL4. Wonderlands is
  included only when the post names it. Existing rows are matched on code and game
- Fails **soft** (exit 0) when every source is unreachable, so it doesn't go red daily
- Fails **hard** when the sources answer but nothing can be parsed or extracted —
  see `assessRunHealth()`. A green run with zero output used to be indistinguishable
  from a silently broken scraper.
- Caps additions per run via `applyPerRunCap()`; these commits land on `main` unattended
- Commits new codes directly to `shiftCodes.ts`

**Shared safety net:** the fetch script inserts via `scripts/lib/shift-codes-file.mjs`,
a validated helper that refuses to write malformed output. The workflow also runs
`npx tsc -b --noEmit`, `npm run lint`, `npm test` and `npm run build` as a gate before
committing, then dispatches `deploy-pages.yml` so new codes reach the live site.

**When debugging Reddit fetching**: Check `scripts/fetch-reddit-codes.mjs` (Node.js script, not browser code).

## Testing Patterns

- Test files: `*.test.ts` or `*.test.tsx`
- Setup: `src/test/setup.ts` configures jsdom and global test utilities
- **Focus on testing hooks and utility functions**, not UI snapshots
- Mock `localStorage` for cache tests

Example test structure:
```typescript
describe('useShiftCodes', () => {
  it('should return processed codes with effective status', () => {
    // Test auto-expiration logic
  });
});
```

## Common Pitfalls

1. **Don't fetch codes client-side** - The daily Reddit workflow commits them into `shiftCodes.ts`
2. **Always use `getEffectiveStatus(code)`** - Never use `code.status` directly for display
3. **Increment `DATA_VERSION`** when changing ShiftCode interface structure
4. **Use `isUniversal: true`** for codes that work across all games (but still create separate entries per game for filtering)
5. **ESLint disables unused vars** - This is intentional for rapid prototyping, but clean up before committing
6. **`src/data/shiftCodes.ts` is CRLF on disk but LF in the git blob.** Any script
   that parses it must `.replace(/\r\n/g, "\n")` first, or it will silently match
   nothing and report a false all-clear.
7. **Every Tailwind colour must exist in `tailwind.config.ts`.** An undeclared name
   emits no CSS at all and fails silently — `vault-gold` shipped that way across
   ~44 utilities. `src/test/tailwind-colors.test.ts` now guards this.
8. **Check contrast on alpha-modified text** (`text-<token>/70`), not just the
   opaque token. `src/test/contrast.test.ts` composites and asserts both.

## Deployment

- **Production**: GitHub Pages via `.github/workflows/deploy-pages.yml`
- **Base path**: `/borderlands-loot-hub/` (configured in `vite.config.ts`)
- **Docker**: `Dockerfile` + `nginx.conf` for containerized deployment

The app is a static SPA with no backend - all data is embedded or fetched from public APIs.
