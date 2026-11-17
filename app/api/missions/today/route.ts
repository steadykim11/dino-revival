// 메인 화면이 호출하는 오늘 미션 조회
// - 오늘자 DAILY 미션이 3개 미만이면 조회 중에 발급된다 (getTodayMissions 참조)
// - DUNGEON 미션이 있으면 함께 반환 (D18에서 활용)

import { route } from "@/lib/http/route";
import { getTodayMissions } from "@/lib/missions/missions.server";

export const dynamic = "force-dynamic";

export const GET = route({ auth: "user" }, async ({ user }) => {
  const now = new Date();
  const missions = await getTodayMissions(user.id, now);

  return Response.json({
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
