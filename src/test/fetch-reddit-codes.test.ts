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

  it("extracts a SHiFT code from a post with the detected game", () => {
    const post = {
      title: "BL4",
      selftext: "Code: ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ — 3 golden keys",
      created_utc: Math.floor(new Date("2026-06-01T00:00:00Z").getTime() / 1000),
      ups: 42,
    };
    const codes = extractCodesFromPost(post, "Borderlands4");
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe("ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ");
    expect(codes[0].game).toBe("BL4");
    expect(codes[0].postDate).toBe("2026-06-01");
  });

  it("returns no codes for a post with no SHiFT code", () => {
    const post = { title: "BL4 discussion", selftext: "no codes here", created_utc: 0, ups: 1 };
    expect(extractCodesFromPost(post, "Borderlands4")).toHaveLength(0);
  });
});
