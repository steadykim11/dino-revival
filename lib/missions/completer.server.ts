// 미션 완료 트랜잭션. /api/missions/complete가 호출
//
// 트랜잭션 내부 작동 단계:
// 1. Mission.completedAt 갱신 (이미 완료면 ALREADY_COMPLETED)
// 2. 최신 WorldSnapshot에서 carbonIntensity 캡처
// 3. 보상 계산 (reward-calculator)
// 4. Dino 행 잠금 후 totalCleanEnergy / intimacy / totalCo2Reduced 갱신
// 5. 진화 체크 (EGG→HATCHLING, HATCHLING→ADULT) — D14 추가
// 6. MissionLog 영구 기록 (stageBefore/stageAfter 포함 — D14 추가)
//
// 반환값:
// - 보상 내역 (모달·전투 결과 표시용)
// - 진화 여부 (D13 전투 컷씬 → D14 진화 연출로 연결)

import type { DinoStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateReward,
  applyIntimacy,
  calculateCo2Reduced,
  type RewardBreakdown,
} from "./reward-calculator";
import { applyEvolution } from "@/lib/dino/dino.server";
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
      missionLogId: string;
      reward: RewardBreakdown;
      co2ReducedKg: number;
      /** 진화 발생 여부 — null이면 진화 안 함 */
      evolved: { from: DinoStage; to: DinoStage } | null;
      dino: {
        totalCleanEnergy: number;
        intimacy: number;
        stage: DinoStage;
      };
    }
  | { ok: false; reason: CompleteFailReason };

export async function completeMission(
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

    // Dino 행을 잠근 뒤 조회한다.
    // 누적값(클린에너지·친밀도)을 읽고 계산해서 다시 쓰므로, 같은 사용자의 미션 두 개가
    // 동시에 완료되면 잠금 없이는 한쪽 보상이 덮어써져 사라진다.
    await tx.$queryRaw`SELECT 1 FROM "dinos" WHERE "userId" = ${userId}::uuid FOR UPDATE`;
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
    // stageBefore는 항상 dino.stage (트랜잭션 진입 시점의 현재 단계).
    // stageAfter는 진화하면 nextStage, 아니면 stageBefore와 동일.
    // MissionLog에 두 값이 다르면 진화 발생 — battle 페이지가 evolution phase 트리거.
    const stageBefore = dino.stage;
    const nextStage = shouldEvolve(dino.stage, nextCleanEnergy);
    const stageAfter = nextStage ?? stageBefore;
    const evolved = nextStage ? { from: stageBefore, to: nextStage } : null;

    // 6) Mission 완료 처리 (compoundWhere로 race 방지: completedAt이 여전히 null일 때만)
    const updatedMission = await tx.mission.updateMany({
      where: { id: missionId, completedAt: null },
      data: { completedAt: now },
    });
    if (updatedMission.count === 0) {
      // 다른 요청이 먼저 완료 처리. 멱등 보장.
      return { ok: false, reason: "ALREADY_COMPLETED" } as const;
    }

    // 7) Dino 보상 갱신 (stage는 아직 그대로 — 진화는 별도 step에서)
    await tx.dino.update({
      where: { userId },
      data: {
        totalCleanEnergy: nextCleanEnergy,
        intimacy: nextIntimacy,
        totalCo2Reduced: { increment: co2ReducedKg },
      },
    });

    // 8) 진화 적용 (stage/hatchedAt/evolvedAt) — nextStage가 있을 때만
    // applyEvolution이 SSoT. completer는 호출만.
    let finalStage: DinoStage = stageBefore;
    if (nextStage) {
      const evolvedDino = await applyEvolution(tx, dino.id, nextStage);
      finalStage = evolvedDino.stage;
    }

    // 9) MissionLog 영구 기록 (D14: stageBefore/stageAfter 포함)
    const log = await tx.missionLog.create({
      data: {
        userId,
        missionId,
        dungeonId: mission.dungeonId,
        missionTitle: mission.pool.title,
        missionType: mission.type,
        missionCategory: mission.pool.category,
        carbonIntensityAtCompletion: carbonIntensity,
        cleanEnergyEarned: reward.finalReward,
        co2ReducedKg,
        intimacyEarned: nextIntimacy - dino.intimacy, // 실제 증가량 (cap 반영)
        stageBefore,
        stageAfter,
        completedAt: now,
      },
      select: { id: true },
    });

    return {
      ok: true,
      missionLogId: log.id,
      reward,
      co2ReducedKg,
      evolved,
      dino: {
        totalCleanEnergy: nextCleanEnergy,
        intimacy: nextIntimacy,
        stage: finalStage,
      },
    };
  });
}
