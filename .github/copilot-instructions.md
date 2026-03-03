# Copilot Instructions - Borderlands SHiFT Vault

## Project Overview

This is a React + TypeScript web application that aggregates and displays SHiFT codes for Borderlands games (BL1, BL2, TPS, BL3, BL4, Wonderlands). It features a Borderlands-themed UI with automatic code expiration tracking, local caching, and automated Twitter code fetching via GitHub Actions.

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

1. **Embedded data** (`src/data/shiftCodes.ts`) - Primary source, includes GitHub Actions-fetched Twitter codes
2. **LocalStorage cache** (`useShiftCodes` hook) - 7-day browser cache with version control
3. **Remote fetch** (optional) - Can fetch from external JSON endpoint if configured

**Critical**: Twitter codes are NOT fetched client-side. They're fetched daily by `.github/workflows/fetch-twitter-codes.yml` and committed directly to `shiftCodes.ts`.

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
4. Include `source` (e.g., 'mentalmars.com', 'twitter/@Borderlands')
5. Increment `DATA_VERSION` in `dataConfig.ts` if changing data structure

### Cache Management

The app uses **versioned caching**:
- Cache key: `shift_codes_cache` in localStorage
- Version: `DATA_VERSION` constant in `dataConfig.ts`
- **Increment `DATA_VERSION`** when making breaking changes to `ShiftCode` interface or data structure

Cache automatically invalidates when:
- Data version changes (prevents type mismatches)
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

The `fetch-twitter-codes.yml` workflow:
- Runs daily at 8 AM UTC
- Uses `TWITTER_BEARER_TOKEN` secret
- Commits new codes directly to `shiftCodes.ts`
- Uses `[skip ci]` to prevent recursive builds

The `fetch-reddit-codes.yml` workflow:
- Runs daily at 9 AM UTC (offset from Twitter)
- Uses Reddit's public `.json` endpoints — no API keys or secrets needed
- Scrapes 4 subreddits: r/Borderlands4, r/Borderlands, r/borderlands3, r/Borderlandsshiftcodes
- Commits new codes directly to `shiftCodes.ts`
- Uses `[skip ci]` to prevent recursive builds

**When debugging Twitter fetching**: Check `scripts/fetch-twitter-codes.mjs` (Node.js script, not browser code).
**When debugging Reddit fetching**: Check `scripts/fetch-reddit-codes.mjs` (Node.js script, uses Reddit OAuth2 API).

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

1. **Don't fetch Twitter codes client-side** - This is done by GitHub Actions
2. **Always use `getEffectiveStatus(code)`** - Never use `code.status` directly for display
3. **Increment `DATA_VERSION`** when changing ShiftCode interface structure
4. **Use `isUniversal: true`** for codes that work across all games (but still create separate entries per game for filtering)
5. **ESLint disables unused vars** - This is intentional for rapid prototyping, but clean up before committing

## Deployment

- **Production**: GitHub Pages via `.github/workflows/deploy-pages.yml`
- **Base path**: `/borderlands-loot-hub/` (configured in `vite.config.ts`)
- **Docker**: `Dockerfile` + `nginx.conf` for containerized deployment

The app is a static SPA with no backend - all data is embedded or fetched from public APIs.
