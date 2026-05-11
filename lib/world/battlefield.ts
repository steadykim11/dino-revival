// lib/world/battlefield.ts
import type { Battlefield } from "@/lib/types/world-snapshot";

/**
 * 탄소강도(gCO₂/kWh)로부터 전장 상태 분류.
 * 게임 메커니즘 정책:
 *   < 300  → PURIFIED (가중치 1.0)
 *   < 500  → NORMAL   (가중치 1.2)
 *   else   → POLLUTED (가중치 1.5)
 */
export function classifyBattlefield(carbonIntensity: number): Battlefield {
  if (carbonIntensity < 300) return "PURIFIED";
  if (carbonIntensity < 500) return "NORMAL";
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
