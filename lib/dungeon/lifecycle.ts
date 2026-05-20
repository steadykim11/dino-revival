// 던전 라이프사이클 SSoT
//
// - 단일 활성 보장은 애플리케이션 레이어. activate 시 이미 활성이면 그걸 반환 (idempotent).
// - 만료 = activatedAt + 60분 (요약본).
// - 자동 cron 미사용 (결정 3-B). 만료는 lazy + activate 시 sweep으로 충분.
// - 발령 시 활성 사용자에게 던전 미션 일괄 발급 (issueDungeonMissions 호출).

import type { Dungeon, Prisma, PrismaClient } from "@prisma/client";
import type { DungeonTriggerReason } from "@/lib/types/dungeon";

/** 던전 활성 시간 (분) */
export const DUNGEON_DURATION_MIN = 60;

/**
 * 현재 활성 던전 1개를 조회.
 * - isActive: true + expiresAt > now 가 정의.
 * - 둘 이상이면(이론상 발생 X) 최근 activatedAt 우선.
 */
export async function getCurrentActiveDungeon(
  client: PrismaClient | Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<Dungeon | null> {
  return client.dungeon.findFirst({
    where: { isActive: true, expiresAt: { gt: now } },
    orderBy: { activatedAt: "desc" },
  });
}

/**
 * 만료된 활성 던전을 청소.
 * isActive=true 인데 expiresAt <= now 인 row를 isActive=false + endedAt 채워서 마감.
 * activate / end / monitor cron 호출 시점에 한 번씩 청소되도록 호출.
 */
export async function sweepExpiredDungeons(
  client: PrismaClient | Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<number> {
  const result = await client.dungeon.updateMany({
    where: { isActive: true, expiresAt: { lte: now } },
    data: { isActive: false, endedAt: now },
  });
  return result.count;
}

/**
 * 던전 발령.
 * 이미 활성 던전이 있으면 idempotent하게 그걸 반환 — 중복 발령 방지.
 * 호출자가 활성 사용자 미션 발급을 별도로 트리거해야 함 (lifecycle은 row만 만듦).
 *
 * 트리거 사유와 메트릭(예비율·탄소강도)은 발령 시점에 기록. 감사용.
 *
 * @returns { dungeon, created } — created=false면 기존 활성을 그대로 반환한 경우.
 */
export interface ActivateResult {
  dungeon: Dungeon;
  created: boolean;
}

export async function activateDungeon(
  prisma: PrismaClient,
  params: {
    reason: DungeonTriggerReason;
    triggerReserveRate?: number | null;
    triggerCarbonIntensity?: number | null;
    now?: Date;
  },
): Promise<ActivateResult> {
  const now = params.now ?? new Date();

  // 트랜잭션 — sweep + 활성 확인 + 생성을 원자적으로.
  // 동시 호출(관리자 더블 클릭 등) 시 한쪽만 created=true.
  return prisma.$transaction(async (tx) => {
    await sweepExpiredDungeons(tx, now);

    const existing = await getCurrentActiveDungeon(tx, now);
    if (existing) {
      return { dungeon: existing, created: false };
    }

    const expiresAt = new Date(
      now.getTime() + DUNGEON_DURATION_MIN * 60 * 1000,
    );

    const dungeon = await tx.dungeon.create({
      data: {
        triggerReason: params.reason,
        isActive: true,
        activatedAt: now,
        expiresAt,
        triggerReserveRate: params.triggerReserveRate ?? null,
        triggerCarbonIntensity: params.triggerCarbonIntensity ?? null,
      },
    });

    return { dungeon, created: true };
  });
}

/**
 * 던전 즉시 종료.
 * - 관리자 종료 또는 만료 정리 호출용.
 * - 이미 isActive=false면 no-op (idempotent).
 * - 진행 중이던 던전 미션은 만료 처리 안 함 (당일 자정 expiresAt까지 유효).
 *   사용자가 던전 종료 후에도 발급된 미션을 마저 완료할 수 있음 — 시연 안전망.
 */
export async function endDungeon(
  prisma: PrismaClient,
  dungeonId: string,
  now: Date = new Date(),
): Promise<Dungeon | null> {
  // 트랜잭션 불필요 — 단일 update.
  const updated = await prisma.dungeon.updateMany({
    where: { id: dungeonId, isActive: true },
    data: { isActive: false, endedAt: now },
  });

  if (updated.count === 0) return null;

  return prisma.dungeon.findUnique({ where: { id: dungeonId } });
}
