import { describe, it, expect } from "vitest";
import {
  decodeEntities,
  detectGame,
  detectRewardType,
  extractKeyCount,
  extractRewardLabel,
  parseExpiration,
  extractCodesFromPost,
} from "../../scripts/fetch-reddit-codes.mjs";

describe("fetch-reddit-codes parsing", () => {
  it("decodes the HTML entities Reddit uses in RSS bodies", () => {
    expect(decodeEntities("&amp;")).toBe("&");
    expect(decodeEntities("a&#32;b")).toBe("a b");
    expect(decodeEntities("&lt;b&gt;")).toBe("<b>");
    expect(decodeEntities("it&#39;s")).toBe("it's");
  });

  it("detects the game from text, falling back to the subreddit default", () => {
    expect(detectGame("New BL2 golden key", "Borderlands")).toBe("BL2");
    expect(detectGame("Tiny Tina's Wonderlands code", "Borderlands")).toBe("WONDERLANDS");
    // No game token in text -> subreddit default
    expect(detectGame("here is a code", "borderlands4")).toBe("BL4");
    expect(detectGame("here is a code", "borderlands3")).toBe("BL3");
  });

  it("detects reward type and key count", () => {
    expect(detectRewardType("redeem for 5 golden keys")).toBe("golden-keys");
    expect(detectRewardType("diamond key reward")).toBe("diamond-keys");
    expect(extractKeyCount("3 golden keys")).toBe(3);
    expect(extractKeyCount("a golden key")).toBe(1);
    expect(extractRewardLabel("5 golden keys")).toBe("5 Golden Keys");
  });

  it("parses expiration dates and returns null when absent", () => {
    expect(parseExpiration("no expiry mentioned here")).toBeNull();
    const parsed = parseExpiration("expires 12/31");
    expect(parsed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("parses MM/DD without year as current or next year", () => {
    const currentYear = new Date().getFullYear();
    const result = parseExpiration("expires 12/31");
    // Should be current or next year, month 12, day 31
    expect(result).toMatch(/^\d{4}-12-31$/);
    const year = parseInt(result.split('-')[0], 10);
    expect(year).toBeGreaterThanOrEqual(currentYear);
    expect(year).toBeLessThanOrEqual(currentYear + 1);
  });

  it("parses MM/DD/YYYY with explicit year correctly", () => {
    const result = parseExpiration("expires 12/31/2026");
    expect(result).toBe("2026-12-31");
  });

  it("rejects dates more than 1 year in the future", () => {
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 2);
    const m = farFuture.getMonth() + 1;
    const d = farFuture.getDate();
    const y = farFuture.getFullYear();
    const result = parseExpiration(`expires ${m}/${d}/${y}`);
    expect(result).toBeNull();
  });

  it("parses 'until MM/DD' format", () => {
    const currentYear = new Date().getFullYear();
    const result = parseExpiration("until 7/31");
    expect(result).toMatch(/^\d{4}-07-31$/);
    const year = parseInt(result.split('-')[0], 10);
    expect(year).toBeGreaterThanOrEqual(currentYear);
    expect(year).toBeLessThanOrEqual(currentYear + 1);
  });

  // Regression: `new Date('Dec 31')` yields year 2001 in V8, which silently
  // marked freshly-scraped codes as long expired.
  it("anchors month-name dates without a year to the post's year", () => {
    const post = new Date(2026, 5, 15); // 15 Jun 2026
    expect(parseExpiration("expires Dec 31", post)).toBe("2026-12-31");
    expect(parseExpiration("expires Jul 4", post)).toBe("2026-07-04");
  });

  it("never returns a year-2001 date for month-name expirations", () => {
    const post = new Date(2026, 0, 20);
    for (const text of ["expires Dec 31", "expires Mar 1", "expires Sep 9"]) {
      const result = parseExpiration(text, post);
      expect(result).not.toBeNull();
      expect(parseInt(result.split('-')[0], 10)).toBeGreaterThanOrEqual(2026);
    }
  });

  it("bumps month-name dates far before the post into the next year", () => {
    // Post in December referencing a January expiry means *next* January.
    const post = new Date(2026, 11, 20); // 20 Dec 2026
    expect(parseExpiration("expires Jan 15", post)).toBe("2027-01-15");
  });

  it("still honours an explicit year in month-name form", () => {
    const post = new Date(2026, 5, 15);
    expect(parseExpiration("expires Dec 31, 2026", post)).toBe("2026-12-31");
  });

  // Regression: post bodies were truncated to 300 chars before code extraction,
  // so codes listed after a long preamble were silently dropped.
  it("extracts codes that appear beyond the first 300 characters of a post", () => {
    const preamble = "Weekly SHiFT code megathread. ".repeat(20); // >300 chars
    expect(preamble.length).toBeGreaterThan(300);
    const post = {
      id: "p1",
      title: "BL4 codes",
      selftext: `${preamble} WXYZA-BCDEF-GHIJK-LMNOP-QRSTU`,
      created_utc: Math.floor(Date.UTC(2026, 5, 15, 12) / 1000),
      ups: 10,
    };
    const codes = extractCodesFromPost(post, "borderlands4");
    expect(codes.map(c => c.code)).toContain("WXYZA-BCDEF-GHIJK-LMNOP-QRSTU");
  });

  it("extracts every code from a multi-code post", () => {
    const post = {
      id: "p2",
      title: "Three codes",
      selftext:
        "AAAAA-BBBBB-CCCCC-DDDDD-EEEEE and " +
        "FFFFF-GGGGG-HHHHH-JJJJJ-KKKKK and " +
        "LLLLL-MMMMM-NNNNN-PPPPP-QQQQQ",
      created_utc: Math.floor(Date.UTC(2026, 5, 15, 12) / 1000),
      ups: 5,
    };
    const codes = extractCodesFromPost(post, "borderlands4");
    expect(codes).toHaveLength(3);
  });

  // Regression: the scraper only discovers codes, it never confirms they redeem.
  // Stamping lastVerifiedAt made the UI show a "Verified" badge for unverified codes.
  it("does not claim scraped codes are verified", () => {
    const post = {
      id: "p3",
      title: "A code",
      selftext: "AAAAA-BBBBB-CCCCC-DDDDD-EEEEE",
      created_utc: Math.floor(Date.UTC(2026, 5, 15, 12) / 1000),
      ups: 1,
    };
    const [entry] = extractCodesFromPost(post, "borderlands4");
    expect(entry.lastVerifiedAt).toBeUndefined();
    expect(entry.status).toBe("unknown");
  });

  it("returns an empty array for malformed posts instead of throwing", () => {
    expect(extractCodesFromPost(null, "borderlands4")).toEqual([]);
    expect(extractCodesFromPost(undefined, "borderlands4")).toEqual([]);
    expect(extractCodesFromPost({}, "borderlands4")).toEqual([]);
  });

  it("extracts a SHiFT code from a post with the detected game", () => {
    const post = {
      title: "BL4",
      selftext: "Code: ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ — 3 golden keys",
      created_utc: Math.floor(new Date("2026-06-01T12:00:00Z").getTime() / 1000),
      ups: 42,
    };
    const codes = extractCodesFromPost(post, "Borderlands4");
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe("ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ");
    expect(codes[0].game).toBe("BL4");
    // Local date from UTC noon is June 1st in all reasonable timezones
    expect(codes[0].postDate).toBe("2026-06-01");
  });

  it("returns no codes for a post with no SHiFT code", () => {
    const post = { title: "BL4 discussion", selftext: "no codes here", created_utc: 0, ups: 1 };
    expect(extractCodesFromPost(post, "Borderlands4")).toHaveLength(0);
  });
});
