import { describe, it, expect } from "vitest";
import { mockShiftCodes, type ShiftCode } from "../data/shiftCodes";

describe("ShiftCode type structure", () => {
  it("mockShiftCodes entries have the expected shape", () => {
    const code: ShiftCode = mockShiftCodes[0];
    expect(code).toMatchObject({
      id: expect.any(String),
      code: expect.any(String),
      game: expect.any(String),
      status: expect.any(String),
      reward: expect.any(String),
      rewardType: expect.any(String),
      source: expect.any(String),
      addedAt: expect.any(String),
    });
  });
});
