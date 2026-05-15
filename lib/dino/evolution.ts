// lib/dino/evolution.ts
// 진화 임계값 + 다음 단계 계산.
//
// 요약본 게임 메커니즘:
//   EGG → HATCHLING: 100 클린에너지
//   HATCHLING → ADULT: 500 클린에너지
//
// 이 파일이 임계값의 SSoT. D12 미션 보상 처리·D14 진화 시스템도 import.

import type { DinoStage } from "@prisma/client";

export const HATCHLING_THRESHOLD = 100;
export const ADULT_THRESHOLD = 500;

/**
 * 현재 단계의 진화 진행도 정보.
 * - target: 다음 단계 임계값 (ADULT는 null — 더 이상 진화 없음)
 * - nextStage: 다음 단계 (없으면 null)
 */
export interface EvolutionProgress {
  current: number;
  target: number | null;
  nextStage: DinoStage | null;
  /** 0~100 (%). target이 null이면 100. */
  percent: number;
}

export function getEvolutionProgress(
  stage: DinoStage,
  totalCleanEnergy: number,
): EvolutionProgress {
  if (stage === "EGG") {
    return {
      current: totalCleanEnergy,
      target: HATCHLING_THRESHOLD,
      nextStage: "HATCHLING",
      percent: Math.min(100, (totalCleanEnergy / HATCHLING_THRESHOLD) * 100),
    };
  }
  if (stage === "HATCHLING") {
    return {
      current: totalCleanEnergy,
      target: ADULT_THRESHOLD,
      nextStage: "ADULT",
      percent: Math.min(100, (totalCleanEnergy / ADULT_THRESHOLD) * 100),
    };
  }
  // ADULT — 최종 단계
  return {
    current: totalCleanEnergy,
    target: null,
    nextStage: null,
    percent: 100,
  };
}

/**
 * totalCleanEnergy가 도달해야 할 다음 단계가 있는지 확인.
 * D14 진화 시스템이 미션 완료 후 호출.
 */
export function shouldEvolve(
  stage: DinoStage,
  totalCleanEnergy: number,
): DinoStage | null {
  if (stage === "EGG" && totalCleanEnergy >= HATCHLING_THRESHOLD) {
    return "HATCHLING";
  }
  if (stage === "HATCHLING" && totalCleanEnergy >= ADULT_THRESHOLD) {
    return "ADULT";
  }
  return null;
}
