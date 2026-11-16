// Dino 조회·생성·갱신.
//
// 진화 판정(순수 함수)은 lib/dino/evolution.ts.

import type { DinoSpecies, DinoStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getDino(userId: string) {
  return prisma.dino.findUnique({ where: { userId } });
}

/**
 * 알 받기 — EGG 상태로 생성. hatchedAt은 첫 진화 시점에 기록된다.
 * 한 사용자당 1마리. 이미 있으면 null.
 */
export async function createDino(
  userId: string,
  input: { species: DinoSpecies; name: string },
) {
  const existing = await prisma.dino.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (existing) return null;

  return prisma.dino.create({
    data: {
      userId,
      species: input.species,
      name: input.name,
      stage: "EGG",
      totalCleanEnergy: 0,
      intimacy: 0,
    },
  });
}

/**
 * Dino를 다음 단계로 진화시킴. 미션 완료 트랜잭션 안에서 호출되는 부수효과 함수.
 *
 * - EGG → HATCHLING: stage=HATCHLING, hatchedAt=now
 * - HATCHLING → ADULT: stage=ADULT, evolvedAt=now
 *
 * 호출 전 shouldEvolve로 nextStage를 결정한 뒤 이 함수를 호출하는 흐름.
 * 잘못된 전이(예: EGG → ADULT)는 호출자 책임으로 막아야 함.
 */
export async function applyEvolution(
  tx: Prisma.TransactionClient,
  dinoId: string,
  nextStage: DinoStage,
) {
  const now = new Date();

  const stageTimestamp =
    nextStage === "HATCHLING"
      ? { hatchedAt: now }
      : nextStage === "ADULT"
        ? { evolvedAt: now }
        : {};

  return tx.dino.update({
    where: { id: dinoId },
    data: {
      stage: nextStage,
      ...stageTimestamp,
    },
  });
}

/**
 * 관리자 시연용 강제 조정 (ADR 18 "관리자 공룡 강제 조정").
 *
 * applyEvolution을 의도적으로 우회한다 — 진화는 단방향(EGG→HATCHLING→ADULT) 전제인데
 * 시연 컨트롤은 역방향도 필요하다. timestamp 정책은 "기존값 유지, null이면 now":
 * ADULT→HATCHLING→ADULT 왕복 시에도 이력이 자연스럽게 보이도록.
 *
 * Dino가 없으면 null.
 */
export async function adminAdjustDino(
  userId: string,
  changes: { stage?: DinoStage; totalCleanEnergy?: number },
  now: Date = new Date(),
) {
  const dino = await prisma.dino.findUnique({ where: { userId } });
  if (!dino) return null;

  const data: {
    stage?: DinoStage;
    totalCleanEnergy?: number;
    hatchedAt?: Date | null;
    evolvedAt?: Date | null;
  } = {};

  if (changes.totalCleanEnergy !== undefined) {
    data.totalCleanEnergy = changes.totalCleanEnergy;
  }

  if (changes.stage !== undefined && changes.stage !== dino.stage) {
    data.stage = changes.stage;
    switch (changes.stage) {
      case "EGG":
        // 알로 되돌리기 — 두 timestamp 모두 클리어
        data.hatchedAt = null;
        data.evolvedAt = null;
        break;
      case "HATCHLING":
        // 부화 완료, 진화 전 — hatchedAt 있어야, evolvedAt 없어야
        data.hatchedAt = dino.hatchedAt ?? now;
        data.evolvedAt = null;
        break;
      case "ADULT":
        // 완전 진화 — 두 timestamp 모두 있어야
        data.hatchedAt = dino.hatchedAt ?? now;
        data.evolvedAt = dino.evolvedAt ?? now;
        break;
    }
  }

  return prisma.dino.update({ where: { userId }, data });
}
