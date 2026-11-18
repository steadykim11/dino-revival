// 전장 분류 — 탄소강도(gCO₂/kWh) 구간. 임계값의 단일 출처.
//
// 화면의 전장 표시, 미션 보상 가중치(lib/missions/reward-calculator.ts),
// 전투에 등장하는 적(lib/battle/enemy-types.ts)이 모두 이 분류를 쓴다.
// DB에는 저장하지 않고 필요할 때 계산한다 (ADR 4).

export type Battlefield = "PURIFIED" | "NORMAL" | "POLLUTED";

/** 이 값 미만이면 해당 전장. NORMAL_BELOW 이상은 POLLUTED. */
export const BATTLEFIELD_THRESHOLDS = {
  PURIFIED_BELOW: 300,
  NORMAL_BELOW: 500,
} as const;

export function classifyBattlefield(carbonIntensity: number): Battlefield {
  if (carbonIntensity < BATTLEFIELD_THRESHOLDS.PURIFIED_BELOW) return "PURIFIED";
  if (carbonIntensity < BATTLEFIELD_THRESHOLDS.NORMAL_BELOW) return "NORMAL";
  return "POLLUTED";
}

export function battlefieldLabel(b: Battlefield): string {
  switch (b) {
    case "PURIFIED":
      return "정화된 전장";
    case "NORMAL":
      return "평범한 전장";
    case "POLLUTED":
      return "오염된 전장";
  }
}
