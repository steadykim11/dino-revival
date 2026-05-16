// 미션 완료 보상 계산
// 클라이언트(SC-06 모달 표시)와 서버(/api/missions/complete)에서 동일한 식 사용
//
// 메커니즘:
// - 탄소강도 가중치: <300 = 1.0 (PURIFIED), 300~500 = 1.2 (NORMAL), >500 = 1.5 (POLLUTED)
// - 던전 미션 배율: 2.0
// - 친밀도: 미션당 +5 고정 (cap 100)
//
// 식: final = round(baseReward × carbonWeight × (isDungeon ? 2.0 : 1.0))

import type { MissionType } from "@prisma/client";

export const CARBON_WEIGHT_THRESHOLDS = {
  PURIFIED: 300,
  NORMAL: 500,
} as const;

export const CARBON_WEIGHTS = {
  PURIFIED: 1.0, // < 300
  NORMAL: 1.2, // 300 ~ 500
  POLLUTED: 1.5, // ≥ 500
} as const;

export const DUNGEON_MULTIPLIER = 2.0;
export const INTIMACY_PER_MISSION = 5;
export const INTIMACY_CAP = 100;

export type Battlefield = "PURIFIED" | "NORMAL" | "POLLUTED";

export function getBattlefield(carbonIntensity: number): Battlefield {
  if (carbonIntensity < CARBON_WEIGHT_THRESHOLDS.PURIFIED) return "PURIFIED";
  if (carbonIntensity < CARBON_WEIGHT_THRESHOLDS.NORMAL) return "NORMAL";
  return "POLLUTED";
}

export function getCarbonWeight(carbonIntensity: number): number {
  return CARBON_WEIGHTS[getBattlefield(carbonIntensity)];
}

export interface RewardBreakdown {
  baseReward: number;
  carbonIntensity: number;
  carbonWeight: number;
  battlefield: Battlefield;
  isDungeon: boolean;
  dungeonMultiplier: number;
  /** 최종 클린에너지 (반올림) */
  finalReward: number;
  /** 친밀도 증가량 (cap 적용 전) */
  intimacyDelta: number;
}

export function calculateReward(input: {
  baseReward: number;
  carbonIntensity: number;
  missionType: MissionType;
}): RewardBreakdown {
  const { baseReward, carbonIntensity, missionType } = input;
  const battlefield = getBattlefield(carbonIntensity);
  const carbonWeight = CARBON_WEIGHTS[battlefield];
  const isDungeon = missionType === "DUNGEON";
  const dungeonMultiplier = isDungeon ? DUNGEON_MULTIPLIER : 1.0;
  const finalReward = Math.round(baseReward * carbonWeight * dungeonMultiplier);

  return {
    baseReward,
    carbonIntensity,
    carbonWeight,
    battlefield,
    isDungeon,
    dungeonMultiplier,
    finalReward,
    intimacyDelta: INTIMACY_PER_MISSION,
  };
}

// 친밀도 갱신값 (cap 100)
export function applyIntimacy(current: number, delta: number): number {
  return Math.min(INTIMACY_CAP, current + delta);
}

// CO₂ 감축량 (kg). estimatedKwh(Decimal string) × 배출계수 0.4781 kgCO₂/kWh (환경부 평균)
const CO2_FACTOR_KG_PER_KWH = 0.4781;
export function calculateCo2Reduced(estimatedKwh: number): number {
  return Math.round(estimatedKwh * CO2_FACTOR_KG_PER_KWH * 1000) / 1000;
}
