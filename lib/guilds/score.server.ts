// 길드 점수·순위 조회.
//
// 길드 점수는 저장하지 않고 조회할 때마다 계산한다 (길드 15개·사용자 수십 명 규모).
// 점수 = 기간 동안 그 길드 소속으로 기록된 MissionLog.cleanEnergyEarned 합 (ADR 43).
// 계산 규칙은 lib/guilds/ranking.ts, 시즌 기간은 lib/guilds/season.ts.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  rankGuilds,
  rankMembers,
  type GuildMember,
  type GuildRanking,
} from "./ranking";
import { seasonRange, type ScorePeriod } from "./season";

export type { GuildMember } from "./ranking";

function periodWhere(period: ScorePeriod): Prisma.MissionLogWhereInput {
  if (period.kind === "all") return {};
  const { start, end } = seasonRange(period.season);
  return { completedAt: { gte: start, lt: end } };
}

/** 기간의 전국 길드 순위 (점수 내림차순). 기록이 없는 길드는 0점. */
export async function getLeaderboard(period: ScorePeriod): Promise<GuildRanking[]> {
  const [guilds, sums] = await Promise.all([
    prisma.guild.findMany({
      select: {
        id: true,
        regionCode: true,
        displayName: true,
        _count: { select: { members: true } },
      },
      orderBy: { regionCode: "asc" },
    }),
    prisma.missionLog.groupBy({
      by: ["guildId"],
      where: { guildId: { not: null }, ...periodWhere(period) },
      _sum: { cleanEnergyEarned: true },
    }),
  ]);

  const scoreByGuild = new Map(
    sums.map((s) => [s.guildId, s._sum.cleanEnergyEarned ?? 0]),
  );

  return rankGuilds(
    guilds.map((g) => ({
      guildId: g.id,
      regionCode: g.regionCode,
      displayName: g.displayName,
      score: scoreByGuild.get(g.id) ?? 0,
      memberCount: g._count.members,
    })),
  );
}

/**
 * 단일 길드 + 길드원 리스트. 본인 강조는 UI 책임.
 */
export interface GuildDetail {
  guild: GuildRanking; // rank는 전국 순위
  members: GuildMember[];
}

export async function getGuildDetail(
  guildId: string,
  period: ScorePeriod,
): Promise<GuildDetail | null> {
  // 전국 순위에서 이 길드 찾기 (rank·score 같이 가져옴)
  const leaderboard = await getLeaderboard(period);
  const ranked = leaderboard.find((r) => r.guildId === guildId);
  if (!ranked) return null;

  const [currentMembers, sums] = await Promise.all([
    prisma.user.findMany({
      where: { guildId },
      select: { id: true, nickname: true, isDummy: true },
    }),
    prisma.missionLog.groupBy({
      by: ["userId"],
      where: { guildId, ...periodWhere(period) },
      _sum: { cleanEnergyEarned: true },
    }),
  ]);

  // 기간 중 이 길드에서 점수를 얻었지만 지금은 다른 길드인 사람
  const memberIds = new Set(currentMembers.map((m) => m.id));
  const formerIds = sums.map((s) => s.userId).filter((id) => !memberIds.has(id));
  const formerMembers =
    formerIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: formerIds } },
          select: { id: true, nickname: true, isDummy: true },
        });

  const members = rankMembers(
    [...currentMembers, ...formerMembers].map((u) => ({
      userId: u.id,
      nickname: u.nickname,
      isDummy: u.isDummy,
    })),
    new Map(sums.map((s) => [s.userId, s._sum.cleanEnergyEarned ?? 0])),
  );

  return { guild: ranked, members };
}

/** 길드 소속으로 기록된 가장 오래된 미션 완료 시각 (시즌 목록의 시작). 없으면 null. */
export async function getEarliestGuildLogAt(): Promise<Date | null> {
  const agg = await prisma.missionLog.aggregate({
    where: { guildId: { not: null } },
    _min: { completedAt: true },
  });
  return agg._min.completedAt;
}

/** 길드원 Dino.totalCleanEnergy 평균 (통계 화면의 동네 비교용) */
export async function getGuildAverageCleanEnergy(
  guildId: string,
): Promise<number> {
  const agg = await prisma.dino.aggregate({
    where: { user: { guildId } },
    _avg: { totalCleanEnergy: true },
  });
  return agg._avg.totalCleanEnergy ?? 0;
}
