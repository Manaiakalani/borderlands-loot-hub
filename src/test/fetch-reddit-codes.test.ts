import { describe, it, expect } from "vitest";
import {
  decodeEntities,
  detectGame,
  detectRewardType,
  extractKeyCount,
  extractRewardLabel,
  parseExpiration,
  extractCodesFromPost,
  generateCodeEntry,
  dedupeCodes,
  applyPerRunCap,
  assessRunHealth,
  postHasCodeCandidate,
  looksLikeShiftCode,
  isAtomFeedBody,
  tallyPosts,
  MAX_NEW_CODES_PER_RUN,
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
    // Pin the post date instead of using "now": with a relative date this test
    // silently changes meaning depending on the month the suite runs in.
    const post = new Date(2026, 6, 1); // 2026-07-01, so 7/31 is still ahead
    expect(parseExpiration("until 7/31", post)).toBe("2026-07-31");
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

  // Regression: the next-year bump used to fire for ANY date >60 days before the
  // post, so "expires May 1" in an August post became 2027-05-01 — a code that
  // died 3 months ago was published with a 9-month-future expiry and rendered as
  // live. Refusing to claim an expiry is the honest outcome.
  it("does not invent a future expiry for a date that already passed", () => {
    const august = new Date(2026, 7, 4);
    expect(parseExpiration("expires May 1", august)).toBeNull();
    expect(parseExpiration("expires Jun 5", august)).toBeNull();
    expect(parseExpiration("expires 6/5", august)).toBeNull();
  });

  it("still resolves a genuine year rollover to the next year", () => {
    const december = new Date(2026, 11, 20);
    expect(parseExpiration("expires Jan 5", december)).toBe("2027-01-05");
    expect(parseExpiration("expires 1/15", december)).toBe("2027-01-15");
  });

  it("keeps a yearless date in the post's year when it is still ahead", () => {
    const august = new Date(2026, 7, 4);
    expect(parseExpiration("expires Aug 20", august)).toBe("2026-08-20");
    expect(parseExpiration("expires Sep 1", august)).toBe("2026-09-01");
  });

  it("never returns a date more than a year after the post", () => {
    const post = new Date(2026, 7, 4);
    const oneYearOut = new Date(2027, 7, 4).getTime();
    for (const text of ["expires Jan 5", "expires May 1", "expires 1/1", "expires Dec 31"]) {
      const result = parseExpiration(text, post);
      if (result) {
        expect(new Date(`${result}T00:00:00`).getTime()).toBeLessThanOrEqual(oneYearOut);
      }
    }
  });

  // Regression: post bodies were truncated to 300 chars before code extraction,
  // so codes listed after a long preamble were silently dropped.
  it("extracts codes that appear beyond the first 300 characters of a post", () => {
    const preamble = "Weekly SHiFT code megathread. ".repeat(20); // >300 chars
    expect(preamble.length).toBeGreaterThan(300);
    const post = {
      id: "p1",
      title: "BL4 codes",
      selftext: `${preamble} WXYZ4-BCDEF-GHIJK-LMNOP-QRSTU`,
      created_utc: Math.floor(Date.UTC(2026, 5, 15, 12) / 1000),
      ups: 10,
    };
    const codes = extractCodesFromPost(post, "borderlands4");
    expect(codes.map(c => c.code)).toContain("WXYZ4-BCDEF-GHIJK-LMNOP-QRSTU");
  });

  it("extracts every code from a multi-code post", () => {
    const post = {
      id: "p2",
      title: "Three codes",
      selftext:
        "AAAA1-BBBBB-CCCCC-DDDDD-EEEEE and " +
        "FFFF2-GGGGG-HHHHH-JJJJJ-KKKKK and " +
        "LLLL3-MMMMM-NNNNN-PPPPP-QQQQQ",
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
      selftext: "AAAA1-BBBBB-CCCCC-DDDDD-EEEEE",
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
      selftext: "Code: ZZZZ9-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ — 3 golden keys",
      created_utc: Math.floor(new Date("2026-06-01T12:00:00Z").getTime() / 1000),
      ups: 42,
    };
    const codes = extractCodesFromPost(post, "Borderlands4");
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe("ZZZZ9-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ");
    expect(codes[0].game).toBe("BL4");
    // Local date from UTC noon is June 1st in all reasonable timezones
    expect(codes[0].postDate).toBe("2026-06-01");
  });

  it("returns no codes for a post with no SHiFT code", () => {
    const post = { title: "BL4 discussion", selftext: "no codes here", created_utc: 0, ups: 1 };
    expect(extractCodesFromPost(post, "Borderlands4")).toHaveLength(0);
  });
});

describe("dedupeCodes", () => {
  const make = (code, game, upvotes, postDate) => ({ code, game, upvotes, postDate });

  it("keeps the same code once per game rather than collapsing to one entry", () => {
    // The same code is routinely posted for several titles, and the UI filters by
    // game, so collapsing on code alone silently dropped the other games.
    const result = dedupeCodes([
      make("AAAA1-BBBBB-CCCCC-DDDDD-EEEEE", "BL3", 5, "2026-06-01"),
      make("AAAA1-BBBBB-CCCCC-DDDDD-EEEEE", "BL4", 3, "2026-06-01"),
    ]);
    expect(result).toHaveLength(2);
    expect(result.map(c => c.game).sort()).toEqual(["BL3", "BL4"]);
  });

  it("collapses repeat sightings of the same code and game, keeping the most upvoted", () => {
    const result = dedupeCodes([
      make("AAAA1-BBBBB-CCCCC-DDDDD-EEEEE", "BL4", 2, "2026-06-01"),
      make("AAAA1-BBBBB-CCCCC-DDDDD-EEEEE", "BL4", 90, "2026-06-01"),
      make("AAAA1-BBBBB-CCCCC-DDDDD-EEEEE", "BL4", 7, "2026-06-01"),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].upvotes).toBe(90);
  });

  it("orders results newest first so a per-run cap keeps the freshest codes", () => {
    const result = dedupeCodes([
      make("AAAA1-BBBBB-CCCCC-DDDDD-EEEEE", "BL4", 1, "2026-01-01"),
      make("FFFF2-GGGGG-HHHHH-JJJJJ-KKKKK", "BL4", 1, "2026-09-01"),
      make("LLLL3-MMMMM-NNNNN-PPPPP-QQQQQ", "BL4", 1, "2026-05-01"),
    ]);
    expect(result.map(c => c.postDate)).toEqual(["2026-09-01", "2026-05-01", "2026-01-01"]);
  });

  it("returns nothing for no input", () => {
    expect(dedupeCodes([])).toEqual([]);
  });
});

describe("generateCodeEntry", () => {
  const base = {
    code: "AAAA1-BBBBB-CCCCC-DDDDD-EEEEE",
    game: "BL4",
    reward: "1 Golden Key",
    rewardType: "golden-keys",
    keys: 1,
    subreddit: "Borderlands4",
    postDate: "2026-06-01",
    expiresAt: null,
    isUniversal: false,
  };

  it("derives the id from the whole code, not a prefix plus a loop index", () => {
    // Index-based ids collided across runs because the index resets each run,
    // and a 5-char prefix is not unique.
    const a = generateCodeEntry({ ...base, code: "AAAA1-BBBBB-CCCCC-DDDDD-EEEEE" }, 0);
    const b = generateCodeEntry({ ...base, code: "AAAA5-ZZZZZ-YYYYY-XXXXX-WWWWW" }, 0);
    const idOf = entry => entry.match(/id: '([^']+)'/)[1];
    expect(idOf(a)).not.toBe(idOf(b));
    expect(idOf(a)).toBe("reddit-bl4-aaaa1bbbbbcccccdddddeeeee");
  });

  it("never claims a scraped code was verified", () => {
    expect(generateCodeEntry(base, 0)).not.toContain("lastVerifiedAt");
  });

  it("treats a date-only expiry as end of the local day, matching isCodeExpired", () => {
    // A code expiring today is still redeemable today. Comparing against UTC
    // midnight would mark it expired a day early.
    const today = new Date();
    const iso = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    expect(generateCodeEntry({ ...base, expiresAt: iso }, 0)).toContain("status: 'unknown'");
  });

  it("marks a genuinely past expiry as expired", () => {
    expect(generateCodeEntry({ ...base, expiresAt: "2020-01-01" }, 0)).toContain("status: 'expired'");
  });

  it("emits an entry that parses back to the values it was given", () => {
    const entry = generateCodeEntry({ ...base, expiresAt: null }, 0);
    expect(entry).toContain("code: 'AAAA1-BBBBB-CCCCC-DDDDD-EEEEE'");
    expect(entry).toContain("game: 'BL4'");
    expect(entry).toContain("source: 'r/Borderlands4'");
    expect(entry).toContain("addedAt: '2026-06-01'");
    expect(entry).toContain("expiresAt: null");
  });
});

describe("MAX_NEW_CODES_PER_RUN", () => {
  it("is a small positive bound on what one unattended run can commit", () => {
    // These commits land on main without review, so the blast radius of a spam
    // or malformed feed has to stay bounded.
    expect(Number.isInteger(MAX_NEW_CODES_PER_RUN)).toBe(true);
    expect(MAX_NEW_CODES_PER_RUN).toBeGreaterThan(0);
    expect(MAX_NEW_CODES_PER_RUN).toBeLessThanOrEqual(50);
  });

  // The assertions above only describe the constant. These exercise the code path
  // that has to honour it, which is the part that could actually regress.
  it("truncates an oversized batch to the cap", () => {
    const codes = Array.from({ length: MAX_NEW_CODES_PER_RUN + 17 }, (_, i) => ({ code: `c${i}` }));
    const capped = applyPerRunCap(codes);
    expect(capped).toHaveLength(MAX_NEW_CODES_PER_RUN);
    // Keeps the most recent (leading) entries, leaving the tail for the next run.
    expect(capped[0]).toBe(codes[0]);
    expect(capped.at(-1)).toBe(codes[MAX_NEW_CODES_PER_RUN - 1]);
  });

  it("passes an under-cap batch through untouched", () => {
    const codes = Array.from({ length: 3 }, (_, i) => ({ code: `c${i}` }));
    expect(applyPerRunCap(codes)).toBe(codes);
    expect(applyPerRunCap([])).toEqual([]);
  });

  it("passes an exactly-at-cap batch through untouched", () => {
    const codes = Array.from({ length: MAX_NEW_CODES_PER_RUN }, (_, i) => ({ code: `c${i}` }));
    expect(applyPerRunCap(codes)).toHaveLength(MAX_NEW_CODES_PER_RUN);
  });
});

/**
 * The previous systemic-failure guard (`postsSkipped === postsSeen`) was close to
 * unreachable: a single ordinary post with no code defeated it, and an HTTP 200
 * carrying malformed XML produced `postsSeen === 0`, which exited green. These
 * cases pin the failure modes that must fail the workflow.
 */
describe("assessRunHealth", () => {
  const healthy = {
    anyReachable: true,
    subredditsWithPosts: 4,
    postsSeen: 80,
    postsSkipped: 0,
    postsWithCandidates: 3,
    codesExtracted: 5,
  };

  it("reports ok for a normal run", () => {
    expect(assessRunHealth(healthy).level).toBe("ok");
  });

  it("reports ok for a quiet day with no codes posted", () => {
    // Real and common: feeds work, nobody posted a code.
    expect(
      assessRunHealth({ ...healthy, postsWithCandidates: 0, codesExtracted: 0 }).level,
    ).toBe("ok");
  });

  it("skips softly when no source was reachable", () => {
    // A daily red X for a best-effort scraper is noise, not signal.
    const result = assessRunHealth({
      ...healthy,
      anyReachable: false,
      subredditsWithPosts: 0,
      postsSeen: 0,
      postsWithCandidates: 0,
      codesExtracted: 0,
    });
    expect(result.level).toBe("skip");
  });

  it("errors when every source answered but no post could be parsed", () => {
    // HTTP 200 + malformed XML. The old guard exited 0 here.
    const result = assessRunHealth({
      ...healthy,
      subredditsWithPosts: 0,
      postsSeen: 0,
      postsWithCandidates: 0,
      codesExtracted: 0,
    });
    expect(result.level).toBe("error");
    expect(result.message).toMatch(/feed format/i);
  });

  it("errors when extraction threw for every post fetched", () => {
    const result = assessRunHealth({ ...healthy, postsSkipped: healthy.postsSeen });
    expect(result.level).toBe("error");
  });

  it("errors when code-shaped posts exist but nothing was extracted", () => {
    // The regression the old guard could never see: parsing works, extraction broke.
    const result = assessRunHealth({ ...healthy, postsWithCandidates: 6, codesExtracted: 0 });
    expect(result.level).toBe("error");
    expect(result.message).toMatch(/extraction path is broken/i);
  });
});

describe("postHasCodeCandidate", () => {
  it("detects a code in the title or the body", () => {
    expect(postHasCodeCandidate({ title: "AAAA1-BBBBB-CCCCC-DDDDD-EEEEE", selftext: "" })).toBe(true);
    expect(postHasCodeCandidate({ title: "hi", selftext: "ZZZZ9-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ" })).toBe(true);
  });

  it("returns false for ordinary posts and malformed input", () => {
    expect(postHasCodeCandidate({ title: "what is the best gun", selftext: "no codes here" })).toBe(false);
    expect(postHasCodeCandidate(null)).toBe(false);
    expect(postHasCodeCandidate(undefined)).toBe(false);
    expect(postHasCodeCandidate({})).toBe(false);
  });

  it("is not corrupted by the shared regex's lastIndex", () => {
    // SHIFT_CODE_REGEX is a module-level /g regex; .test() advances lastIndex, so
    // repeated calls silently returned false before lastIndex was reset.
    const post = { title: "AAAA1-BBBBB-CCCCC-DDDDD-EEEEE", selftext: "" };
    expect(postHasCodeCandidate(post)).toBe(true);
    expect(postHasCodeCandidate(post)).toBe(true);
    expect(postHasCodeCandidate(post)).toBe(true);
  });
});

describe("looksLikeShiftCode (hyphenated-prose false positives)", () => {
  // SHIFT_CODE_REGEX is case-insensitive so a lowercase-typed code is still
  // recovered, but that also matches chains of five-letter words.
  it("rejects five-letter-word prose that matches the code shape", () => {
    expect(looksLikeShiftCode("SUPER-CLEAN-WATER-THING-STUFF")).toBe(false);
    expect(looksLikeShiftCode("CHECK-THESE-CODES-BELOW-GUIDE")).toBe(false);
  });

  it("accepts real codes, which always contain a digit", () => {
    expect(looksLikeShiftCode("WZKJT-XRT9J-9JCWK-JJJ3B-Z9WHF")).toBe(true);
  });

  it("does not extract prose as a redeemable code", () => {
    const post = {
      title: "This is a super-clean-water-thing-stuff guide for BL4 golden keys",
      selftext: "",
      created_utc: Math.floor(Date.now() / 1000),
    };
    expect(extractCodesFromPost(post, "Borderlands4")).toHaveLength(0);
  });

  it("still extracts a genuine code from the same post shape", () => {
    const post = {
      title: "BL4 code WZKJT-XRT9J-9JCWK-JJJ3B-Z9WHF 1 golden key",
      selftext: "",
      created_utc: Math.floor(Date.now() / 1000),
    };
    expect(extractCodesFromPost(post, "Borderlands4")[0].code).toBe(
      "WZKJT-XRT9J-9JCWK-JJJ3B-Z9WHF",
    );
  });

  it("keeps postHasCodeCandidate in step with extraction", () => {
    // If these disagree, a prose-only post counts as "codes present, none
    // extracted" and assessRunHealth fails the run.
    const prose = {
      title: "a super-clean-water-thing-stuff post",
      selftext: "",
      created_utc: Math.floor(Date.now() / 1000),
    };
    expect(postHasCodeCandidate(prose)).toBe(false);
    expect(extractCodesFromPost(prose, "Borderlands4")).toHaveLength(0);
  });
});

describe("isAtomFeedBody (HTTP 200 challenge pages)", () => {
  it("rejects an interstitial served with a 200 status", () => {
    expect(isAtomFeedBody("<html><body>Just a moment...</body></html>")).toBe(false);
  });

  it("accepts a valid but empty feed, so a quiet subreddit stays reachable", () => {
    expect(isAtomFeedBody('<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>')).toBe(true);
  });

  it("accepts a populated feed", () => {
    expect(isAtomFeedBody("<feed><entry><title>x</title></entry></feed>")).toBe(true);
  });

  it("handles a non-string body without throwing", () => {
    expect(isAtomFeedBody(undefined)).toBe(false);
  });
});

describe("assessRunHealth false positives", () => {
  const base = {
    anyReachable: true,
    subredditsWithPosts: 4,
    postsSeen: 80,
    postsSkipped: 0,
    postsWithCandidates: 0,
    codesExtracted: 0,
  };

  it("stays ok when a couple of odd posts are rejected among many", () => {
    // A handful of malformed posts is normal noise, not a broken extraction path.
    expect(assessRunHealth({ ...base, postsSkipped: 2 }).level).toBe("ok");
  });

  it("does not call breakage on a one-post sample where that post threw", () => {
    expect(
      assessRunHealth({ ...base, subredditsWithPosts: 1, postsSeen: 1, postsSkipped: 1 }).level,
    ).toBe("ok");
  });

  it("does not call breakage on a single code-shaped post that yielded nothing", () => {
    expect(assessRunHealth({ ...base, postsWithCandidates: 1 }).level).toBe("ok");
  });

  it("still reports breakage once the sample is large enough", () => {
    expect(assessRunHealth({ ...base, postsSeen: 80, postsSkipped: 80 }).level).toBe("error");
  });

  it("still reports breakage when several candidates yield nothing", () => {
    // The guard that catches silent extraction rot. It must stay reachable.
    expect(assessRunHealth({ ...base, postsWithCandidates: 5 }).level).toBe("error");
  });

  it("reports breakage on partial rot, not just total failure", () => {
    // A degradation to most-posts-failing used to exit green and look like a
    // quiet day, because only a 100% failure rate escalated.
    expect(assessRunHealth({ ...base, postsSeen: 80, postsSkipped: 60 }).level).toBe("error");
  });

  it("treats an ordinary low failure rate as healthy", () => {
    expect(assessRunHealth({ ...base, postsSeen: 80, postsSkipped: 3 }).level).toBe("ok");
  });
});

describe("tallyPosts (counters that drive assessRunHealth)", () => {
  const now = () => Math.floor(Date.now() / 1000);
  const REAL = "WZKJT-XRT9J-9JCWK-JJJ3B-Z9WHF";

  it("keeps the code from a giveaway post and drops only the implausible count", () => {
    // "Giveaway: 100 golden keys!" advertises a quantity assertValidCodeShape
    // caps at 99. Rejecting the whole entry silently discarded a perfectly real
    // code; the count is the unreliable part, so only that is dropped.
    const posts = [
      { id: "1", title: `Giveaway: 100 golden keys! ${REAL}`, selftext: "", created_utc: now() },
    ];
    const tally = tallyPosts(posts, "Borderlands4");
    expect(tally.postsSkipped).toBe(0);
    expect(tally.codes).toHaveLength(1);
    expect(tally.codes[0].code).toBe(REAL);
    expect(tally.codes[0].keys).toBeUndefined();
  });

  it("counts code-shaped posts even when extraction throws", () => {
    // Candidacy is counted before extraction on purpose. Counting it only on
    // success made the "candidates but no codes" guard unreachable, because a
    // successful extraction of a candidate always yields at least one code.
    const posts = [
      { id: "1", title: `code ${REAL}`, selftext: "", created_utc: now() },
    ];
    const tally = tallyPosts(posts, "Borderlands4");
    expect(tally.postsWithCandidates).toBe(1);
  });

  it("counts a genuine code post as both candidate and extraction", () => {
    const posts = [
      { id: "1", title: `BL4 code ${REAL} 1 golden key`, selftext: "", created_utc: now() },
    ];
    const tally = tallyPosts(posts, "Borderlands4");
    expect(tally.postsSeen).toBe(1);
    expect(tally.postsSkipped).toBe(0);
    expect(tally.postsWithCandidates).toBe(1);
    expect(tally.codes).toHaveLength(1);
    expect(tally.codes[0].keys).toBe(1);
  });

  it("keeps processing the remaining posts after one throws", () => {
    const posts = [
      { id: "1", title: `bad expiry ${REAL} expires 2026-13-45`, selftext: "", created_utc: now() },
      { id: "2", title: "BL4 code AAAA1-BBBBB-CCCCC-DDDDD-EEEEE 1 golden key", selftext: "", created_utc: now() },
    ];
    const tally = tallyPosts(posts, "Borderlands4");
    expect(tally.postsSeen).toBe(2);
    expect(tally.codes.length).toBeGreaterThanOrEqual(1);
  });

  it("ignores posts with no code-shaped text at all", () => {
    const posts = [{ id: "1", title: "What is everyone farming today?", selftext: "", created_utc: now() }];
    const tally = tallyPosts(posts, "Borderlands4");
    expect(tally).toMatchObject({ postsSeen: 1, postsSkipped: 0, postsWithCandidates: 0 });
    expect(tally.codes).toHaveLength(0);
  });
});
