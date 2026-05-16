// 미션 완료 트랜잭션. /api/missions/complete가 호출
//
// 트랜잭션 내부 작동 단계:
// 1. Mission.completedAt 갱신 (이미 완료면 ALREADY_COMPLETED)
// 2. 최신 WorldSnapshot에서 carbonIntensity 캡처
// 3. 보상 계산 (reward-calculator)
// 4. Dino.totalCleanEnergy / intimacy / totalCo2Reduced 갱신
// 5. 진화 체크 (EGG→HATCHLING, HATCHLING→ADULT)
// 6. MissionLog 영구 기록
//
// 반환값:
// - 보상 내역 (모달·전투 결과 표시용)
// - 진화 여부 (D13 전투 컷씬 → D14 진화 연출로 연결)

import type { PrismaClient } from "@prisma/client";
import {
  calculateReward,
  applyIntimacy,
  calculateCo2Reduced,
  type RewardBreakdown,
} from "./reward-calculator";
import { shouldEvolve } from "@/lib/dino/evolution";

export type CompleteFailReason =
  | "MISSION_NOT_FOUND"
  | "ALREADY_COMPLETED"
  | "EXPIRED"
  | "DINO_NOT_FOUND"
  | "NO_WORLD_SNAPSHOT";

export type CompleteResult =
  | {
      ok: true;
      reward: RewardBreakdown;
      co2ReducedKg: number;
      /** 진화 발생 여부 — null이면 진화 안 함 */
      evolved: { from: string; to: string } | null;
      dino: { totalCleanEnergy: number; intimacy: number; stage: string };
    }
  | { ok: false; reason: CompleteFailReason };

export async function completeMission(
  prisma: PrismaClient,
  userId: string,
  missionId: string,
  now: Date = new Date(),
): Promise<CompleteResult> {
  // 1) 최신 WorldSnapshot 조회 (트랜잭션 밖에서 — read-only, 락 불필요)
  const snapshot = await prisma.worldSnapshot.findFirst({
    orderBy: { ts: "desc" },
    select: { carbonIntensity: true },
  });
  if (!snapshot) {
    return { ok: false, reason: "NO_WORLD_SNAPSHOT" };
  }
  const carbonIntensity = Number(snapshot.carbonIntensity);

  // 2) 트랜잭션
  return prisma.$transaction(async (tx) => {
    // Mission 조회 + 락 (Prisma는 SELECT FOR UPDATE 직접 지원 X → findUnique 후 즉시 update로 갈음)
    const mission = await tx.mission.findUnique({
      where: { id: missionId },
      include: {
        pool: {
          select: {
            title: true,
            category: true,
            baseReward: true,
            estimatedKwh: true,
          },
        },
      },
    });
    if (!mission || mission.userId !== userId) {
      return { ok: false, reason: "MISSION_NOT_FOUND" } as const;
    }
    if (mission.completedAt) {
      return { ok: false, reason: "ALREADY_COMPLETED" } as const;
    }
    if (mission.expiresAt <= now) {
      return { ok: false, reason: "EXPIRED" } as const;
    }

    // Dino 조회
    const dino = await tx.dino.findUnique({ where: { userId } });
    if (!dino) {
      return { ok: false, reason: "DINO_NOT_FOUND" } as const;
    }

    // 3) 보상 계산
    const reward = calculateReward({
      baseReward: mission.pool.baseReward,
      carbonIntensity,
      missionType: mission.type,
    });
    const estimatedKwh = Number(mission.pool.estimatedKwh);
    const co2ReducedKg = calculateCo2Reduced(estimatedKwh);

    // 4) Dino 갱신값 계산
    const nextCleanEnergy = dino.totalCleanEnergy + reward.finalReward;
    const nextIntimacy = applyIntimacy(dino.intimacy, reward.intimacyDelta);

    // 5) 진화 체크 (현재 stage 기준)
    const nextStage = shouldEvolve(dino.stage, nextCleanEnergy);
    const evolved = nextStage ? { from: dino.stage, to: nextStage } : null;

    // 6) Mission 완료 처리 (compoundWhere로 race 방지: completedAt이 여전히 null일 때만)
    const updatedMission = await tx.mission.updateMany({
      where: { id: missionId, completedAt: null },
      data: { completedAt: now },
    });
    if (updatedMission.count === 0) {
      // 다른 요청이 먼저 완료 처리. 멱등 보장.
      return { ok: false, reason: "ALREADY_COMPLETED" } as const;
    }

    // 7) Dino 갱신 (진화 시 stage·hatchedAt·evolvedAt도 업데이트)
    const dinoUpdate: {
      totalCleanEnergy: number;
      intimacy: number;
      totalCo2Reduced: { increment: number };
      stage?: typeof nextStage extends null
        ? never
        : NonNullable<typeof nextStage>;
      hatchedAt?: Date;
      evolvedAt?: Date;
    } = {
      totalCleanEnergy: nextCleanEnergy,
      intimacy: nextIntimacy,
      totalCo2Reduced: { increment: co2ReducedKg },
    };
    if (nextStage === "HATCHLING") {
      dinoUpdate.stage = "HATCHLING";
      dinoUpdate.hatchedAt = now;
    } else if (nextStage === "ADULT") {
      dinoUpdate.stage = "ADULT";
      dinoUpdate.evolvedAt = now;
    }

    const updatedDino = await tx.dino.update({
      where: { userId },
      data: dinoUpdate,
      select: { totalCleanEnergy: true, intimacy: true, stage: true },
    });

    // 8) MissionLog 영구 기록
    await tx.missionLog.create({
      data: {
        userId,
        missionId,
        missionTitle: mission.pool.title,
        missionType: mission.type,
        missionCategory: mission.pool.category,
        carbonIntensityAtCompletion: carbonIntensity,
        cleanEnergyEarned: reward.finalReward,
        co2ReducedKg,
        intimacyEarned: nextIntimacy - dino.intimacy, // 실제 증가량 (cap 반영)
        completedAt: now,
      },
    });

    return {
      ok: true,
      reward,
      co2ReducedKg,
      evolved,
      dino: {
        totalCleanEnergy: updatedDino.totalCleanEnergy,
        intimacy: updatedDino.intimacy,
        stage: updatedDino.stage,
      },
    };
  });
}
