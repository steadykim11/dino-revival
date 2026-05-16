// 메인 화면이 호출하는 오늘 미션 조회
// - 오늘자 DAILY 미션이 3개 미만이면 자동 발급 (Cron 누락 보호)
// - DUNGEON 미션이 있으면 함께 반환 (D18에서 활용)

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { issueDailyMissions } from "@/lib/missions/daily-issuer";
import { toKstDateString } from "@/lib/time/kst";

export const dynamic = "force-dynamic";

export const GET = withAuth(async ({ user }) => {
  const now = new Date();
  const todayKst = toKstDateString(now);
  const assignedDate = new Date(`${todayKst}T00:00:00.000Z`);

  // 1) 오늘자 미션 조회
  let missions = await fetchMissions(user.id, assignedDate);

  // 2) DAILY가 3개 미만이면 lazy 발급
  const dailyCount = missions.filter((m) => m.type === "DAILY").length;
  if (dailyCount < 3) {
    const result = await issueDailyMissions(prisma, user.id, now);
    if (result.status === "failed") {
      console.error("[missions/today] lazy issue failed:", result.error);
    } else {
      missions = await fetchMissions(user.id, assignedDate);
    }
  }

  return NextResponse.json({
    missions: missions.map((m) => ({
      id: m.id,
      poolId: m.poolId,
      type: m.type,
      dungeonId: m.dungeonId,
      title: m.pool.title,
      description: m.pool.description,
      category: m.pool.category,
      timeSlot: m.pool.timeSlot,
      baseReward: m.pool.baseReward,
      estimatedKwh: m.pool.estimatedKwh.toString(),
      completedAt: m.completedAt?.toISOString() ?? null,
      expiresAt: m.expiresAt.toISOString(),
    })),
    generatedAt: now.toISOString(),
  });
});

async function fetchMissions(userId: string, assignedDate: Date) {
  return prisma.mission.findMany({
    where: {
      userId,
      OR: [
        { assignedDate, type: "DAILY" },
        { type: "DUNGEON", expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      pool: {
        select: {
          title: true,
          description: true,
          category: true,
          timeSlot: true,
          baseReward: true,
          estimatedKwh: true,
        },
      },
    },
    orderBy: [{ type: "desc" }, { createdAt: "asc" }],
  });
}
