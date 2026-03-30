import { describe, it, expect } from "vitest";
import { cn } from "../lib/utils";

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
