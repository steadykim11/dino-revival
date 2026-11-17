// 한 사용자에게 오늘자 Mission 3개를 DB에 발급
// - 이미 오늘자 미션이 있으면 skip (idempotent). 동시 요청의 중복 발급은 DB 유니크 제약이 막는다
// - 직전일(어제) Mission을 조회해 풀 회피 기준으로 사용
// - selectDailyMissions로 풀 선정 후 Mission 레코드 3개 createMany

import { prisma } from "@/lib/prisma";
import { selectDailyMissions } from "./daily-selector";
import { toKstDateString, kstNextMidnight } from "@/lib/time/kst";

export interface IssueResult {
  userId: string;
  /** 'issued' (새로 발급) | 'skipped' (이미 있음) | 'failed' */
  status: "issued" | "skipped" | "failed";
  missionIds?: string[];
  error?: string;
}

export async function issueDailyMissions(
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

    // 4) 슬롯 0·1·2(DAY·EVENING·ANYTIME)로 발급.
    // (userId, assignedDate, type, slot) 유니크 제약이 중복을 막는다. 동시에 들어온
    // 다른 요청이 먼저 발급했으면 해당 슬롯은 건너뛴다 (skipDuplicates).
    const created = await prisma.mission.createManyAndReturn({
      data: selectedPoolIds.map((poolId, slot) => ({
        userId,
        poolId,
        type: "DAILY" as const,
        assignedDate,
        expiresAt,
        slot,
      })),
      skipDuplicates: true,
      select: { id: true },
    });

    if (created.length === 0) {
      // 다른 요청이 세 슬롯을 모두 먼저 채웠다
      const now3 = await prisma.mission.findMany({
        where: { userId, assignedDate, type: "DAILY" },
        select: { id: true },
      });
      return { userId, status: "skipped", missionIds: now3.map((m) => m.id) };
    }

    return { userId, status: "issued", missionIds: created.map((m) => m.id) };
  } catch (err) {
    return {
      userId,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
