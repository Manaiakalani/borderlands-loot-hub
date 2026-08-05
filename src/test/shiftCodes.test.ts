import { describe, it, expect, afterEach, vi } from "vitest";
import {
  isCodeExpired,
  getEffectiveStatus,
  mockShiftCodes,
  GAME_INFO,
  type ShiftCode,
  type GameType,
} from "../data/shiftCodes";

function makeCode(overrides: Partial<ShiftCode> = {}): ShiftCode {
  return {
    id: "test-1",
    code: "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX",
    game: "BL3",
    status: "active",
    reward: "1 Golden Key",
    rewardType: "golden-keys",
    source: "test",
    addedAt: "2025-01-01",
    ...overrides,
  };
}

describe("isCodeExpired", () => {
  it("returns false for an active code with no expiration", () => {
    expect(isCodeExpired(makeCode())).toBe(false);
  });

  it("returns false for an active code with a future expiration", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(isCodeExpired(makeCode({ expiresAt: future }))).toBe(false);
  });

  it("returns true for a code with a past expiration date", () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(isCodeExpired(makeCode({ expiresAt: past }))).toBe(true);
  });

  it("returns true for a code with explicit 'expired' status", () => {
    expect(isCodeExpired(makeCode({ status: "expired" }))).toBe(true);
  });

  it("returns false for a code with 'unknown' status and no expiration", () => {
    expect(isCodeExpired(makeCode({ status: "unknown" }))).toBe(false);
  });

  it("returns false for a code with null expiresAt", () => {
    expect(isCodeExpired(makeCode({ expiresAt: null }))).toBe(false);
  });
});

describe("isCodeExpired date-only semantics", () => {
  // A bare YYYY-MM-DD expiry means "good through the end of that day, local time".
  // scripts/fetch-reddit-codes.mjs mirrors this rule and says so in a comment, but
  // only its half was pinned by a test. Parsing the string as plain UTC midnight
  // instead retires a still-valid code up to a day early and undercounts "Active".
  //
  // 23:30 local is chosen deliberately: it lands after UTC midnight of the same
  // date for every offset from UTC-12 to UTC+14, so the assertion distinguishes the
  // two readings no matter where this suite runs.
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a code expiring today active at 23:30 local", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 9, 23, 30, 0));
    expect(isCodeExpired(makeCode({ expiresAt: "2026-02-09" }))).toBe(false);
  });

  it("expires that same code once its local day has ended", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 10, 0, 0, 30));
    expect(isCodeExpired(makeCode({ expiresAt: "2026-02-09" }))).toBe(true);
  });

  it("reports the same thing through getEffectiveStatus", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 9, 23, 30, 0));
    expect(getEffectiveStatus(makeCode({ expiresAt: "2026-02-09" }))).toBe("active");
  });
});

describe("getEffectiveStatus", () => {
  it("returns 'active' for a non-expired active code", () => {
    expect(getEffectiveStatus(makeCode())).toBe("active");
  });

  it("returns 'expired' for an active code with a past expiration", () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(getEffectiveStatus(makeCode({ expiresAt: past }))).toBe("expired");
  });

  it("returns 'expired' for a code with explicit 'expired' status", () => {
    expect(getEffectiveStatus(makeCode({ status: "expired" }))).toBe("expired");
  });

  it("returns 'unknown' for an unknown-status code that is not expired", () => {
    expect(getEffectiveStatus(makeCode({ status: "unknown" }))).toBe("unknown");
  });

  it("returns 'active' for a code with a future expiration", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(getEffectiveStatus(makeCode({ expiresAt: future }))).toBe("active");
  });
});

describe("mockShiftCodes data integrity", () => {
  it("contains at least one code", () => {
    expect(mockShiftCodes.length).toBeGreaterThan(0);
  });

  it("every code has the required fields", () => {
    for (const code of mockShiftCodes) {
      expect(code.id).toBeTruthy();
      expect(code.code).toBeTruthy();
      expect(code.game).toBeTruthy();
      expect(code.status).toBeTruthy();
      expect(code.reward).toBeTruthy();
      expect(code.rewardType).toBeTruthy();
      expect(code.source).toBeTruthy();
      expect(code.addedAt).toBeTruthy();
    }
  });
});

describe("GAME_INFO", () => {
  const allGameTypes: GameType[] = ["BL1", "BL2", "TPS", "BL3", "BL4", "WONDERLANDS"];

  it("has entries for every GameType", () => {
    for (const game of allGameTypes) {
      expect(GAME_INFO[game]).toBeDefined();
      expect(GAME_INFO[game].name).toBeTruthy();
      expect(GAME_INFO[game].shortName).toBeTruthy();
      expect(GAME_INFO[game].color).toBeTruthy();
    }
  });
});
