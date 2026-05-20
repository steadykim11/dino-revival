// 던전 발령 시 활성 사용자에게 던전 미션을 일괄 발급.
//
// - MissionPool 재사용. 별도 던전 풀 시드 없음.
//   카피는 일반 미션과 동일하나 UI에서 "긴급" 라벨 + 보상 2배 표기로 임팩트.
// - 모든 실유저(isDummy=false)에게 일괄 발급. 더미 제외.
// - 던전 미션 2개. 같은 던전에서 모든 사용자가 같은 2개 — "전국 비상" 컨셉.
// - 사용자별 idempotent: 이미 이 dungeonId로 발급된 미션이 있으면 skip.
// - expiresAt: 당일 KST 자정 (일반 미션과 동일). 던전 종료 후에도 완료 가능.
//
// daily-issuer.ts와 assignedDate / expiresAt 계산 방식을 통일.

import { Prisma, type PrismaClient } from "@prisma/client";
import { toKstDateString, kstNextMidnight } from "@/lib/time/kst";

/** SC-09 와이어프레임의 "던전 미션 2개" */
export const DUNGEON_MISSION_COUNT = 2;

/**
 * 던전 미션으로 사용할 풀 ID 2개를 결정론적으로 선택.
 * dungeonId의 UUID 첫 8자리를 정수로 변환해 정렬된 풀에서 modulo 선택.
 * - 같은 던전 = 같은 미션 (재실행 안전, 모든 사용자가 동일 미션 받음)
 * - 다른 던전 = 다른 미션 셋업 가능성 높음
 */
function pickDungeonPoolIds(
  dungeonId: string,
  activePoolIds: readonly string[],
): string[] {
  if (activePoolIds.length < DUNGEON_MISSION_COUNT) {
    throw new Error(
      `MissionPool에 활성 미션이 ${DUNGEON_MISSION_COUNT}개 미만입니다.`,
    );
  }

  // 정렬해서 안정성 확보 (DB 순서가 바뀌어도 결정론적)
  const sorted = [...activePoolIds].sort();

  // UUID 첫 8자(16진수)를 시드로
  const seed = parseInt(dungeonId.replace(/-/g, "").slice(0, 8), 16);
  const len = sorted.length;

  // 두 개 다른 인덱스 선택 (seed, seed + offset)
  const idx1 = seed % len;
  const idx2 = (seed + Math.max(1, Math.floor(len / 2))) % len;
  const finalIdx2 = idx2 === idx1 ? (idx1 + 1) % len : idx2;

  return [sorted[idx1], sorted[finalIdx2]];
}

/**
 * 던전 미션을 활성 사용자(실유저)에게 일괄 발급.
 * - dungeonId 기준 idempotent: 이미 그 던전 미션을 받은 유저는 skip.
 * - 사용자별로 commit 분리하지 않음 — 던전 활성 사용자 수가 작음(본인 + 시연 시 소수).
 *   75명 더미 제외하면 보통 1명. createMany 1회로 처리.
 *
 * @returns 발급된 미션 row 수
 */
export async function issueDungeonMissions(
  prisma: PrismaClient,
  dungeonId: string,
  now: Date = new Date(),
): Promise<number> {
  // 1) 활성 미션 풀 ID 수집
  const activePools = await prisma.missionPool.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  const poolIds = pickDungeonPoolIds(
    dungeonId,
    activePools.map((p) => p.id),
  );

  // 2) 발급 대상 = 실유저 전체 (Dino가 있어야 게임 진행 중이라 봄)
  const targetUsers = await prisma.user.findMany({
    where: {
      isDummy: false,
      dino: { isNot: null },
    },
    select: { id: true },
  });

  if (targetUsers.length === 0) return 0;

  // 3) 이미 이 dungeon으로 받은 사용자 제외 (idempotent)
  const alreadyIssued = await prisma.mission.findMany({
    where: { dungeonId },
    select: { userId: true },
    distinct: ["userId"],
  });
  const alreadySet = new Set(alreadyIssued.map((m) => m.userId));
  const pendingUsers = targetUsers.filter((u) => !alreadySet.has(u.id));

  if (pendingUsers.length === 0) return 0;

  // 4) 일괄 발급
  // daily-issuer와 동일한 방식: assignedDate는 KST 날짜의 UTC 자정.
  const todayKst = toKstDateString(now);
  const assignedDate = new Date(`${todayKst}T00:00:00.000Z`);
  const expiresAt = kstNextMidnight(now);

  const rows: Prisma.MissionCreateManyInput[] = [];
  for (const user of pendingUsers) {
    for (const poolId of poolIds) {
      rows.push({
        userId: user.id,
        poolId,
        type: "DUNGEON",
        dungeonId,
        assignedDate,
        expiresAt,
      });
    }
  }

  const result = await prisma.mission.createMany({ data: rows });
  return result.count;
}
