// lib/profile/cooldown.ts
// 닉네임·동네 변경 쿨다운 계산.
// 정책: 닉네임 30일, 동네 90일 (요약본 운영 정책)

export const NICKNAME_COOLDOWN_DAYS = 30;
export const REGION_COOLDOWN_DAYS = 90;

/**
 * 마지막 변경 시각으로부터 경과 일수 (소수점 포함)
 * lastChangedAt이 null이면 변경 이력 없음 -> Infinity 반환 (쿨다운 통과)
 */
export function daysSince(lastChangedAt: Date | string | null): number {
  if (!lastChangedAt) return Infinity;
  const last =
    typeof lastChangedAt === "string" ? new Date(lastChangedAt) : lastChangedAt;
  const diffMs = Date.now() - last.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

/**
 * 쿨다운 상태:
 * - canChange: 변경 가능 여부
 * - remainingDays: 남은 일수 (canChange=true면 0)
 */
export interface CooldownStatus {
  canChange: boolean;
  remainingDays: number;
}

export function getCooldownStatus(
  lastChangedAt: Date | string | null,
  cooldownDays: number,
): CooldownStatus {
  const elapsed = daysSince(lastChangedAt);
  if (elapsed >= cooldownDays) {
    return { canChange: true, remainingDays: 0 };
  }
  return {
    canChange: false,
    remainingDays: Math.ceil(cooldownDays - elapsed),
  };
}
