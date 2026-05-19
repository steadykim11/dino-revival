// 더미 사용자 75명 시드
//
// MissionLog는 (userId, completedAt) 조합으로 dedupe — 재실행 시 중복 방지

import { PrismaClient } from "@prisma/client";
import { generateDummyUsers } from "../../lib/users/dummy-generator";

export async function seedDummyUsers(prisma: PrismaClient) {
  console.log("⏳ dummy users 시드 시작...");
  const start = Date.now();

  // 길드 목록 조회 (Guild 시드가 먼저 실행되어 있어야 함)
  const guilds = await prisma.guild.findMany({
    select: { id: true, regionCode: true },
    orderBy: { regionCode: "asc" },
  });
  if (guilds.length === 0) {
    throw new Error("길드 시드가 먼저 실행되어야 합니다.");
  }

  // MissionPool 조회 (D15 추가)
  const pool = await prisma.missionPool.findMany({
    where: { isActive: true },
    select: {
      id: true,
      title: true,
      category: true,
      baseReward: true,
      estimatedKwh: true,
    },
    orderBy: { id: "asc" }, // 결정론적 순서
  });
  if (pool.length === 0) {
    throw new Error(
      "MissionPool이 비어 있습니다. seedMissionPool이 먼저 실행되어야 함",
    );
  }

  // estimatedKwh는 Decimal이므로 Number로 변환
  const poolEntries = pool.map((p) => ({
    ...p,
    estimatedKwh: Number(p.estimatedKwh),
  }));

  const specs = generateDummyUsers({ guilds, pool: poolEntries });
  console.log(
    `  → ${specs.length}명 spec 생성 (길드 ${guilds.length}개, 미션풀 ${pool.length}개)`,
  );

  // User + Dino 시드 (upsert)
  let userCount = 0;
  for (const spec of specs) {
    await prisma.user.upsert({
      where: { id: spec.id },
      create: {
        id: spec.id,
        nickname: spec.nickname,
        regionCode: spec.regionCode,
        guildId: spec.guildId,
        isDummy: true,
        createdAt: spec.createdAt,
        dino: {
          create: {
            name: spec.dino.name,
            species: spec.dino.species,
            stage: spec.dino.stage,
            totalCleanEnergy: spec.dino.totalCleanEnergy,
            intimacy: spec.dino.intimacy,
            hatchedAt: spec.dino.hatchedAt,
            evolvedAt: spec.dino.evolvedAt,
          },
        },
      },
      update: {
        // 재실행 시 닉네임·길드만 동기화. Dino는 건드리지 않음 (사용자 활동 보존)
        nickname: spec.nickname,
        regionCode: spec.regionCode,
        guildId: spec.guildId,
      },
    });
    userCount++;
  }
  console.log(`  ✓ ${userCount} users upserted`);

  // MissionLog 시드
  // 재실행 시 중복 방지: 더미의 기존 로그를 모두 지우고 다시 입력
  // (더미 로그는 시드 전용이라 사용자 활동 보존 불필요)
  const dummyIds = specs.map((s) => s.id);
  const deleted = await prisma.missionLog.deleteMany({
    where: { userId: { in: dummyIds } },
  });
  console.log(`  → 기존 더미 MissionLog ${deleted.count}개 삭제`);

  const allLogs = specs.flatMap((s) => s.missionLogs);
  await prisma.missionLog.createMany({
    data: allLogs.map((log) => ({
      userId: log.userId,
      missionId: log.missionId,
      missionTitle: log.missionTitle,
      missionType: log.missionType,
      missionCategory: log.missionCategory,
      carbonIntensityAtCompletion: log.carbonIntensityAtCompletion,
      cleanEnergyEarned: log.cleanEnergyEarned,
      co2ReducedKg: log.co2ReducedKg,
      intimacyEarned: log.intimacyEarned,
      stageBefore: log.stageBefore,
      stageAfter: log.stageAfter,
      completedAt: log.completedAt,
    })),
  });
  console.log(`  ✓ ${allLogs.length} mission logs created`);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`✅ dummy users 시드 완료 (${elapsed}s)`);
}
