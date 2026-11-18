import { describe, expect, it } from "vitest";
import {
  BATTLEFIELD_THRESHOLDS,
  battlefieldLabel,
  classifyBattlefield,
} from "./battlefield";

describe("classifyBattlefield", () => {
  it.each([
    [0, "PURIFIED"],
    [299.99, "PURIFIED"],
    [300, "NORMAL"],
    [499.99, "NORMAL"],
    [500, "POLLUTED"],
    [900, "POLLUTED"],
  ] as const)("탄소강도 %d → %s", (ci, expected) => {
    expect(classifyBattlefield(ci)).toBe(expected);
  });

  it("임계값은 300 / 500", () => {
    expect(BATTLEFIELD_THRESHOLDS).toEqual({
      PURIFIED_BELOW: 300,
      NORMAL_BELOW: 500,
    });
  });
});

describe("battlefieldLabel", () => {
  it("한글 라벨", () => {
    expect(battlefieldLabel("PURIFIED")).toBe("정화된 전장");
    expect(battlefieldLabel("NORMAL")).toBe("평범한 전장");
    expect(battlefieldLabel("POLLUTED")).toBe("오염된 전장");
  });
});
