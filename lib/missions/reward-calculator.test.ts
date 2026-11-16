import { describe, expect, it } from "vitest";
import {
  applyIntimacy,
  calculateCo2Reduced,
  calculateReward,
  getBattlefield,
  getCarbonWeight,
  INTIMACY_CAP,
  INTIMACY_PER_MISSION,
} from "./reward-calculator";

describe("getBattlefield", () => {
  it.each([
    [0, "PURIFIED"],
    [299.99, "PURIFIED"],
    [300, "NORMAL"],
    [499.99, "NORMAL"],
    [500, "POLLUTED"],
    [900, "POLLUTED"],
  ] as const)("탄소강도 %d → %s", (ci, expected) => {
    expect(getBattlefield(ci)).toBe(expected);
  });
});

describe("getCarbonWeight", () => {
  it("전장별 가중치: 1.0 / 1.2 / 1.5", () => {
    expect(getCarbonWeight(100)).toBe(1.0);
    expect(getCarbonWeight(400)).toBe(1.2);
    expect(getCarbonWeight(600)).toBe(1.5);
  });
});

describe("calculateReward", () => {
  it("일반 미션: baseReward × 탄소 가중치", () => {
    const r = calculateReward({
      baseReward: 50,
      carbonIntensity: 400,
      missionType: "DAILY",
    });
    expect(r.finalReward).toBe(60);
    expect(r.battlefield).toBe("NORMAL");
    expect(r.isDungeon).toBe(false);
    expect(r.dungeonMultiplier).toBe(1.0);
    expect(r.intimacyDelta).toBe(INTIMACY_PER_MISSION);
  });

  it("던전 미션: 2배 배율이 추가로 곱해진다", () => {
    const r = calculateReward({
      baseReward: 50,
      carbonIntensity: 600,
      missionType: "DUNGEON",
    });
    expect(r.finalReward).toBe(150); // 50 × 1.5 × 2
    expect(r.isDungeon).toBe(true);
    expect(r.dungeonMultiplier).toBe(2.0);
  });

  it("정화된 전장에서는 기본 보상 그대로", () => {
    const r = calculateReward({
      baseReward: 20,
      carbonIntensity: 250,
      missionType: "DAILY",
    });
    expect(r.finalReward).toBe(20);
  });

  it("소수 결과는 반올림한다", () => {
    const r = calculateReward({
      baseReward: 45,
      carbonIntensity: 400,
      missionType: "DAILY",
    });
    expect(r.finalReward).toBe(54); // 45 × 1.2 = 54
    const r2 = calculateReward({
      baseReward: 33,
      carbonIntensity: 600,
      missionType: "DAILY",
    });
    expect(r2.finalReward).toBe(50); // 49.5 → 50
  });
});

describe("applyIntimacy", () => {
  it("cap 미만이면 그대로 더한다", () => {
    expect(applyIntimacy(10, 5)).toBe(15);
  });

  it("cap을 넘지 않는다", () => {
    expect(applyIntimacy(98, 5)).toBe(INTIMACY_CAP);
    expect(applyIntimacy(INTIMACY_CAP, 5)).toBe(INTIMACY_CAP);
  });
});

describe("calculateCo2Reduced", () => {
  it("kWh × 0.4781, 소수 셋째 자리까지", () => {
    expect(calculateCo2Reduced(0.5)).toBe(0.239);
    expect(calculateCo2Reduced(1)).toBe(0.478);
    expect(calculateCo2Reduced(0)).toBe(0);
  });
});
