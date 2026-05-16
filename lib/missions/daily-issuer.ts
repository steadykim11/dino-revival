// 한 사용자에게 오늘자 Mission 3개를 DB에 발급
// - 이미 오늘자 미션이 있으면 skip (idempotent)
// - 직전일(어제) Mission을 조회해 풀 회피 기준으로 사용
// - selectDailyMissions로 풀 선정 후 Mission 레코드 3개 createMany

import type { PrismaClient } from "@prisma/client";
import { selectDailyMissions } from "./daily-selector";
import { toKstDateString } from "@/lib/time/kst";

export interface IssueResult {
  userId: string;
  /** 'issued' (새로 발급) | 'skipped' (이미 있음) | 'failed' */
  status: "issued" | "skipped" | "failed";
  missionIds?: string[];
  error?: string;
}

export async function issueDailyMissions(
  prisma: PrismaClient,
  userId: string,
  now: Date = new Date(),
): Promise<IssueResult> {
  const todayKst = toKstDateString(now); // "yyyy-MM-dd"

  // 오늘자 만료 시각: 다음 KST 자정 (= 오늘 KST 24:00)
  // KST 자정 = UTC 15:00 전일
  // expiresAt 계산은 KST 다음날 00:00 → UTC로
  const expiresAt = kstNextMidnight(now);

  // assignedDate는 KST 기준 날짜의 UTC 자정으로 저장 (DB는 @db.Date)
  const assignedDate = new Date(`${todayKst}T00:00:00.000Z`);

  try {
    // 1) 이미 오늘자 미션이 있으면 skip
    const existing = await prisma.mission.findMany({
      where: { userId, assignedDate, type: "DAILY" },
      select: { id: true },
    });
    if (existing.length >= 3) {
      return {
        userId,
        status: "skipped",
        missionIds: existing.map((m) => m.id),
      };
    }

    // 2) 풀 + 직전일 사용 풀 ID 조회 (병렬)
    const yesterdayKst = toKstDateString(
      new Date(now.getTime() - 24 * 60 * 60 * 1000),
    );
    const yesterdayDate = new Date(`${yesterdayKst}T00:00:00.000Z`);

    const [pool, yesterdayMissions] = await Promise.all([
      prisma.missionPool.findMany({
        where: { isActive: true },
        select: { id: true, category: true, timeSlot: true },
      }),
      prisma.mission.findMany({
        where: { userId, assignedDate: yesterdayDate, type: "DAILY" },
        select: { poolId: true },
      }),
    ]);

    if (pool.length < 3) {
      return {
        userId,
        status: "failed",
        error: `pool too small: ${pool.length}`,
      };
    }

    // 3) 선정
    const { selectedPoolIds } = selectDailyMissions({
      pool,
      previousPoolIds: yesterdayMissions.map((m) => m.poolId),
    });

    // 4) Mission 3개 createMany (트랜잭션 불필요 — createMany 자체가 원자적)
    const created = await prisma.mission.createManyAndReturn({
      data: selectedPoolIds.map((poolId) => ({
        userId,
        poolId,
        type: "DAILY" as const,
        assignedDate,
        expiresAt,
      })),
      select: { id: true },
    });

    return { userId, status: "issued", missionIds: created.map((m) => m.id) };
  } catch (err) {
    return {
      userId,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// UTC Date → 다음 KST 자정의 UTC Date
function kstNextMidnight(now: Date): Date {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const kstNextMidnightMs = Date.UTC(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth(),
    kstNow.getUTCDate() + 1,
    0,
    0,
    0,
  );
  return new Date(kstNextMidnightMs - KST_OFFSET_MS);
}
