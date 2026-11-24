// 더미 사용자 활동 기록 (ADR 44). 수집 작업(jobs/collect.ts)이 매 실행 호출한다.

import { prisma } from "@/lib/prisma";
import { planDummyActivity } from "./dummy-activity";

export interface DummyActivityResult {
  planned: number;
  inserted: number;
}

/**
 * 오늘·어제(KST) 몫의 더미 완료 기록 중 아직 없는 것을 넣는다.
 * 기록 ID가 정해져 있어 이미 있는 기록은 건너뛴다 (skipDuplicates).
 * 더미의 Dino 누적값은 바꾸지 않는다 — 길드 점수는 기록으로만 센다.
 */
export async function recordDummyActivity(now: Date = new Date()): Promise<DummyActivityResult> {
  const [dummies, pool] = await Promise.all([
    prisma.user.findMany({
      where: { isDummy: true, guildId: { not: null }, dino: { isNot: null } },
      select: { id: true, guildId: true, dino: { select: { stage: true } } },
    }),
    prisma.missionPool.findMany({
      where: { isActive: true },
      select: { id: true, title: true, category: true, baseReward: true, estimatedKwh: true },
    }),
  ]);

  const logs = planDummyActivity(
    dummies.flatMap((u) =>
      u.guildId && u.dino ? [{ userId: u.id, guildId: u.guildId, stage: u.dino.stage }] : [],
    ),
    pool.map((p) => ({ ...p, estimatedKwh: Number(p.estimatedKwh) })),
    now,
  );
  if (logs.length === 0) return { planned: 0, inserted: 0 };

  const { count } = await prisma.missionLog.createMany({ data: logs, skipDuplicates: true });
  return { planned: logs.length, inserted: count };
}
