// Mission·MissionLog 조회와 일일 미션 재발급.
//
// 발급은 daily-issuer.server.ts, 완료 트랜잭션은 completer.server.ts.

import { prisma } from "@/lib/prisma";
import { kstDateAsUtcMidnight } from "@/lib/time/kst";
import { issueDailyMissions } from "./daily-issuer.server";
import type { MissionItem } from "./types";

/** 화면 표시에 필요한 미션 풀 필드 */
const POOL_SELECT = {
  title: true,
  description: true,
  category: true,
  timeSlot: true,
  baseReward: true,
  estimatedKwh: true,
} as const;

async function findTodayMissions(userId: string, now: Date) {
  return prisma.mission.findMany({
    where: {
      userId,
      OR: [
        { assignedDate: kstDateAsUtcMidnight(now), type: "DAILY" },
        { type: "DUNGEON", expiresAt: { gt: new Date() } },
      ],
    },
    include: { pool: { select: POOL_SELECT } },
    orderBy: [{ type: "desc" }, { createdAt: "asc" }],
  });
}

/**
 * 오늘의 미션 (DAILY + 유효한 DUNGEON).
 * 오늘자 DAILY가 3개 미만이면 여기서 발급한다 — 자정 cron이 없어 접속 시 발급이 유일한 경로.
 */
export async function getTodayMissions(userId: string, now: Date = new Date()) {
  let missions = await findTodayMissions(userId, now);

  const dailyCount = missions.filter((m) => m.type === "DAILY").length;
  if (dailyCount < 3) {
    const result = await issueDailyMissions(userId, now);
    if (result.status === "failed") {
      console.error("[missions/today] lazy issue failed:", result.error);
    } else {
      missions = await findTodayMissions(userId, now);
    }
  }

  return missions;
}

/** 특정 던전으로 발급된 본인 미션 */
export async function getDungeonMissions(userId: string, dungeonId: string) {
  return prisma.mission.findMany({
    where: { userId, dungeonId, type: "DUNGEON" },
    include: { pool: { select: POOL_SELECT } },
    orderBy: { createdAt: "asc" },
  });
}

/** 전투 결과 화면용 미션 완료 기록. 본인 것이 아니면 호출자가 걸러야 한다. */
export async function getMissionLog(missionLogId: string) {
  return prisma.missionLog.findUnique({
    where: { id: missionLogId },
    select: {
      userId: true,
      missionTitle: true,
      cleanEnergyEarned: true,
      co2ReducedKg: true,
      intimacyEarned: true,
      carbonIntensityAtCompletion: true,
      stageBefore: true,
      stageAfter: true,
    },
  });
}

/**
 * 관리자 시연용 — 오늘자 DAILY 미션을 지우고 다시 발급.
 *
 * - DUNGEON 미션은 건드리지 않는다 (던전 진행 중인 사용자 보호).
 * - 완료된 미션도 삭제하지만 MissionLog는 남는다 (영구 이력).
 * - issueDailyMissions는 오늘자 3개가 있으면 skip하므로 선삭제가 필수.
 */
export async function regenerateDailyMissions(
  userId: string,
  now: Date = new Date(),
) {
  const deleted = await prisma.mission.deleteMany({
    where: { userId, assignedDate: kstDateAsUtcMidnight(now), type: "DAILY" },
  });
  const result = await issueDailyMissions(userId, now);
  return { deletedCount: deleted.count, result };
}

type MissionWithPool = Awaited<ReturnType<typeof getTodayMissions>>[number];

/** Mission 행 → 화면 표시용 MissionItem (홈·던전 공용) */
export function toMissionItem(m: MissionWithPool): MissionItem {
  return {
    id: m.id,
    title: m.pool.title,
    description: m.pool.description,
    category: m.pool.category,
    timeSlot: m.pool.timeSlot,
    type: m.type,
    baseReward: m.pool.baseReward,
    estimatedKwh: m.pool.estimatedKwh.toString(),
    completedAt: m.completedAt?.toISOString() ?? null,
  };
}
