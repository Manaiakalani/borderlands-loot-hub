import { describe, it, expect, afterEach, vi } from "vitest";
import { cn, copyToClipboard } from "../lib/utils";

describe("cn", () => {
  it("handles a single class", () => {
    expect(cn("px-2")).toBe("px-2");
  });

  it("merges multiple classes", () => {
    expect(cn("px-2", "py-4")).toBe("px-2 py-4");
  });

  it("filters out falsy values", () => {
    const isHidden = false;
    expect(cn("px-2", isHidden && "hidden", null, undefined, "py-4")).toBe("px-2 py-4");
  });

  it("resolves Tailwind merge conflicts (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("resolves conflicting text colors", () => {
    expect(cn("text-red-500", "text-blue-700")).toBe("text-blue-700");
  });

  it("returns empty string for no arguments", () => {
    expect(cn()).toBe("");
  });
});

describe("copyToClipboard", () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");

  function setClipboard(value: unknown) {
    Object.defineProperty(navigator, "clipboard", {
      value,
      configurable: true,
      writable: true,
    });
  }

  afterEach(() => {
    if (original) {
      Object.defineProperty(navigator, "clipboard", original);
    } else {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it("copies the text and reports success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await expect(copyToClipboard("ABCDE-12345")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("ABCDE-12345");
  });

  it("reports failure when the clipboard API is missing entirely", async () => {
    setClipboard(undefined);
    await expect(copyToClipboard("x")).resolves.toBe(false);
  });

  it("reports failure when clipboard is null", async () => {
    setClipboard(null);
    await expect(copyToClipboard("x")).resolves.toBe(false);
  });

  // The bug this helper exists for: optional chaining guards `clipboard` being
  // nullish, but `navigator.clipboard?.writeText(x)` still throws a TypeError
  // when the object is present and the method is not.
  it("reports failure when clipboard exists but writeText is missing", async () => {
    setClipboard({});
    await expect(copyToClipboard("x")).resolves.toBe(false);
  });

  it("reports failure when writeText is not callable", async () => {
    setClipboard({ writeText: "nope" });
    await expect(copyToClipboard("x")).resolves.toBe(false);
  });

  it("reports failure when writeText rejects (permission denied)", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    await expect(copyToClipboard("x")).resolves.toBe(false);
  });

  it("reports failure when writeText throws synchronously", async () => {
    setClipboard({
      writeText: () => {
        throw new Error("insecure context");
      },
    });
    await expect(copyToClipboard("x")).resolves.toBe(false);
  });

  it("never throws, whatever the environment does", async () => {
    for (const value of [undefined, null, {}, { writeText: 1 }, { writeText: () => { throw new Error("x"); } }]) {
      setClipboard(value);
      await expect(copyToClipboard("x")).resolves.toBe(false);
    }
  });
});
