// 길드 점수·순위 조회.
//
// 길드 점수는 저장하지 않고 조회할 때마다 계산한다 (길드 15개·사용자 수십 명 규모).
// 계산 규칙은 lib/guilds/ranking.ts.

import { prisma } from "@/lib/prisma";
import { rankGuilds, type GuildRanking } from "./ranking";

/** 전국 길드 순위 (점수 내림차순) */
export async function getLeaderboard(): Promise<GuildRanking[]> {
  const guilds = await prisma.guild.findMany({
    select: {
      id: true,
      regionCode: true,
      displayName: true,
      members: {
        select: {
          dino: {
            select: { totalCleanEnergy: true },
          },
        },
      },
    },
  });

  return rankGuilds(
    guilds.map((g) => ({
      id: g.id,
      regionCode: g.regionCode,
      displayName: g.displayName,
      memberCleanEnergy: g.members.map((m) => m.dino?.totalCleanEnergy ?? 0),
    })),
  );
}

/**
 * 단일 길드 + 길드원 리스트. 본인 강조는 UI 책임.
 */
export interface GuildDetail {
  guild: {
    id: string;
    regionCode: string;
    displayName: string;
    score: number;
    rank: number; // 전국 순위
    memberCount: number;
  };
  members: GuildMember[];
}

export interface GuildMember {
  userId: string;
  nickname: string;
  cleanEnergy: number;
  isDummy: boolean;
}

export async function getGuildDetail(
  guildId: string,
): Promise<GuildDetail | null> {
  // 전국 순위에서 이 길드 찾기 (rank·score 같이 가져옴)
  const leaderboard = await getLeaderboard();
  const ranked = leaderboard.find((r) => r.guildId === guildId);
  if (!ranked) return null;

  // 길드원 리스트 (Dino join, 점수 desc)
  const members = await prisma.user.findMany({
    where: { guildId },
    select: {
      id: true,
      nickname: true,
      isDummy: true,
      dino: {
        select: { totalCleanEnergy: true },
      },
    },
  });

  const memberList: GuildMember[] = members
    .map((m) => ({
      userId: m.id,
      nickname: m.nickname,
      cleanEnergy: m.dino?.totalCleanEnergy ?? 0,
      isDummy: m.isDummy,
    }))
    .sort((a, b) => b.cleanEnergy - a.cleanEnergy);

  return {
    guild: {
      id: ranked.guildId,
      regionCode: ranked.regionCode,
      displayName: ranked.displayName,
      score: ranked.score,
      rank: ranked.rank,
      memberCount: ranked.memberCount,
    },
    members: memberList,
  };
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
