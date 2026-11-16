import { describe, expect, it } from "vitest";
import {
  ADULT_THRESHOLD,
  getEvolutionProgress,
  HATCHLING_THRESHOLD,
  shouldEvolve,
} from "./evolution";

describe("shouldEvolve", () => {
  it("EGG는 임계값 미만이면 진화하지 않는다", () => {
    expect(shouldEvolve("EGG", HATCHLING_THRESHOLD - 1)).toBeNull();
  });

  it("EGG는 임계값에 도달하면 HATCHLING", () => {
    expect(shouldEvolve("EGG", HATCHLING_THRESHOLD)).toBe("HATCHLING");
  });

  it("HATCHLING은 임계값에 도달하면 ADULT", () => {
    expect(shouldEvolve("HATCHLING", ADULT_THRESHOLD - 1)).toBeNull();
    expect(shouldEvolve("HATCHLING", ADULT_THRESHOLD)).toBe("ADULT");
  });

  it("ADULT는 더 진화하지 않는다", () => {
    expect(shouldEvolve("ADULT", 999_999)).toBeNull();
  });

  it("한 번에 한 단계만 — EGG가 ADULT 임계값을 넘어도 HATCHLING", () => {
    expect(shouldEvolve("EGG", ADULT_THRESHOLD + 100)).toBe("HATCHLING");
  });
});

describe("getEvolutionProgress", () => {
  it("EGG: 다음 단계 HATCHLING, 진행률은 임계값 대비", () => {
    expect(getEvolutionProgress("EGG", 25)).toEqual({
      current: 25,
      target: HATCHLING_THRESHOLD,
      nextStage: "HATCHLING",
      percent: 25,
    });
  });

  it("HATCHLING: 다음 단계 ADULT", () => {
    const p = getEvolutionProgress("HATCHLING", 250);
    expect(p.target).toBe(ADULT_THRESHOLD);
    expect(p.nextStage).toBe("ADULT");
    expect(p.percent).toBe(50);
  });

  it("진행률은 100을 넘지 않는다", () => {
    expect(getEvolutionProgress("EGG", 500).percent).toBe(100);
  });

  it("ADULT: 목표 없음, 100%", () => {
    expect(getEvolutionProgress("ADULT", 700)).toEqual({
      current: 700,
      target: null,
      nextStage: null,
      percent: 100,
    });
  });
});
