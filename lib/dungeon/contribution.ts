// 활성 던전에 대한 길드 기여도 계산
//
// - 같은 길드 MissionLog 합산. 캐시 없음 (던전 페이지 진입 1회 조회)
// - 더미는 hash로 가상 기여 카운트
//   본인은 실제 MissionLog 조회. 더미는 (dungeonId × userId) hash로 0~2 결정.
// - 더미 가상 기여를 두는 이유: 시연 시 던전 발령 직후라 더미 활동이 0이면
//   "동네 기여도" 위젯이 본인 혼자가 됨 -> 시연 임팩트 감소

import type { PrismaClient } from "@prisma/client";
import type { GuildContribution } from "@/lib/types/dungeon";

/**
 * 던전 기간 내 본인 + 같은 길드 더미의 기여도 집계.
 *
 * @param prisma   PrismaClient
 * @param userId   본인 User.id
 * @param dungeonId 활성 던전 ID (활성 여부는 호출자가 보장)
 * @returns GuildContribution | null (사용자가 길드에 속해있지 않으면 null)
 */
export async function getGuildContribution(
  prisma: PrismaClient,
  userId: string,
  dungeonId: string,
): Promise<GuildContribution | null> {
  // 1) 본인 user + 던전 조회 (병렬)
  const [me, dungeon] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        guildId: true,
        guild: { select: { id: true, displayName: true } },
      },
    }),
    prisma.dungeon.findUnique({
      where: { id: dungeonId },
      select: { id: true, activatedAt: true, expiresAt: true },
    }),
  ]);

  if (!me?.guildId || !me.guild || !dungeon) return null;

  // 2) 길드 멤버 조회 (본인 + 더미)
  const members = await prisma.user.findMany({
    where: { guildId: me.guildId },
    select: { id: true, isDummy: true },
  });
  const totalMembers = members.length;

  // 3) 본인 실제 던전 미션 로그 (이 던전 기간 내 던전 미션 완료분)
  // dungeonId가 MissionLog에 컬럼으로 없으므로 missionType + 시각으로 필터.
  // 던전 기간을 벗어나 완료된 던전 미션은 다른 던전의 잔여일 수 있음 — 정확도보다 단순함.
  const myLogs = await prisma.missionLog.findMany({
    where: {
      userId,
      missionType: "DUNGEON",
      completedAt: {
        gte: dungeon.activatedAt,
        lte: dungeon.expiresAt,
      },
    },
    select: { cleanEnergyEarned: true },
  });
  const myContributedMissions = myLogs.length;
  const myCleanEnergy = myLogs.reduce((s, l) => s + l.cleanEnergyEarned, 0);

  // 4) 더미 가상 기여 (결정 5-C)
  // - hash(dungeonId + dummyUserId) % 3 → 0~2 던전 미션 완료한 것으로 간주
  // - 평균 1개, 즉 절반 정도는 1개 이상 기여 → "함께" 카피가 살아남
  let dummyContributedCount = 0;
  let dummyVirtualEnergy = 0;
  const VIRTUAL_CLEAN_ENERGY_PER_MISSION = 90; // 평균 baseReward(45) × 2배 던전 배율

  for (const m of members) {
    if (!m.isDummy) continue;
    const virtualCount = hashCount(dungeon.id, m.id, 3); // 0~2
    if (virtualCount > 0) dummyContributedCount += 1;
    dummyVirtualEnergy += virtualCount * VIRTUAL_CLEAN_ENERGY_PER_MISSION;
  }

  const contributedMembers =
    (myContributedMissions > 0 ? 1 : 0) + dummyContributedCount;

  return {
    guildId: me.guild.id,
    guildDisplayName: me.guild.displayName,
    totalMembers,
    contributedMembers,
    myContributedMissions,
    totalCleanEnergy: myCleanEnergy + dummyVirtualEnergy,
  };
}

/**
 * (key1, key2) 쌍에 대한 결정론적 정수 0..max-1.
 * 던전 ID와 사용자 ID 조합으로 가상 카운트를 만들 때 사용.
 *
 * 단순 djb2 변형 — 암호 강도 불필요, 분포가 적당히 고르면 충분.
 */
function hashCount(key1: string, key2: string, max: number): number {
  const s = `${key1}:${key2}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0; // h * 33 + c (32-bit clamp)
  }
  return Math.abs(h) % max;
}
