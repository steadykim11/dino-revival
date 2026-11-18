// 던전 도메인 타입 SSoT

/**
 * 던전 발령 사유.
 * - "auto"  : 예비율 < 10% 자동 트리거 (cron 미활성, 실제로는 발생 거의 없음)
 * - "manual": 관리자 수동 트리거 (시연 시 사용)
 */
export type DungeonTriggerReason = "auto" | "manual";

/**
 * 던전 종류. MVP는 PEAK 단일, Phase 2에서 컬럼화 + 종류 확장.
 */
export type DungeonType = "PEAK";

/**
 * /world/state 응답의 던전 instance.
 * snapshot-reader.ts가 이 형태로 직렬화. 클라이언트는 그대로 소비.
 *
 * 시각은 모두 ISO 문자열 — DB UTC → JSON 직렬화 → 클라이언트가 KST로 표시.
 */
export interface DungeonInstance {
  id: string;
  type: DungeonType;
  activatedAt: string;
  expiresAt: string;

  /**
   * 만료까지 남은 초.
   * 서버 빌드 시점 기준. 클라이언트는 자체 카운트다운에 활용.
   */
  remainingSec: number;

  triggerReserveRate: number | null;
  triggerCarbonIntensity: number | null;
}

/**
 * /world/state의 dungeon 필드.
 * discriminated union — active 여부로 instance 존재 보장.
 */
export type DungeonState =
  | { active: false; instance: null }
  | { active: true; instance: DungeonInstance };

/**
 * 동네 기여도 응답 — /dungeon 페이지에서 사용.
 * - 길드 전체 멤버 중 던전 미션을 완료한 비율
 * - 본인 진척만 실제, 더미는 결정론적 hash로 가상 카운트
 */
export interface GuildContribution {
  guildId: string;
  guildDisplayName: string;

  /** 길드 전체 멤버 수 (본인 + 더미) */
  totalMembers: number;

  /**
   * 던전 미션을 1개 이상 완료한 멤버 수.
   * 본인은 실제 MissionLog 카운트, 더미는 가상.
   */
  contributedMembers: number;

  /** 본인의 던전 미션 완료 수 */
  myContributedMissions: number;

  /** 던전 미션 누적 클린에너지 합 (본인 + 더미 가상치 합) */
  totalCleanEnergy: number;
}
