// 본인 통계 집계 — SC-10 상단 카드 3개용
// - 완료 미션 수는 MissionLog 카운트 (영구 이력)
// - 페이지가 Server Component에서 직접 호출 (D17 패턴)

import { prisma } from "@/lib/prisma";

export interface MeStats {
  totalCleanEnergy: number;
  totalCo2ReducedKg: number;
  completedMissionsCount: number;
}

export async function getMeStats(
  userId: string,
): Promise<MeStats> {
  const [dino, completedCount] = await Promise.all([
    prisma.dino.findUnique({
      where: { userId },
      select: { totalCleanEnergy: true, totalCo2Reduced: true },
    }),
    prisma.missionLog.count({ where: { userId } }),
  ]);

  return {
    totalCleanEnergy: dino?.totalCleanEnergy ?? 0,
    totalCo2ReducedKg: Number(dino?.totalCo2Reduced ?? 0),
    completedMissionsCount: completedCount,
  };
}
