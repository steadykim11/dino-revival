// 길드 점수 계산 + LeaderboardCache 5분 캐시
//
// 정책 (ADR 16):
// - seasonScore = guild 멤버 Dino.totalCleanEnergy 합계
// - 리더보드 조회 시 즉시 계산 + 5분 캐시 (옵션 C, 요약본)
// - 캐시는 LeaderboardCache 단일 행 (id='global'). Phase 2에 Redis로 이전.

import { prisma } from "@/lib/prisma";

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_KEY = "global";

export interface GuildRanking {
  guildId: string;
  regionCode: string;
  displayName: string;
  seasonScore: number;
  memberCount: number;
  rank: number;
}

/**
 * 전국 길드 순위 (캐시 우선).
 * 5분 이내 캐시가 있으면 그대로, 없거나 stale이면 재계산 후 저장.
 */
export async function getLeaderboard(
  now: Date = new Date(),
): Promise<GuildRanking[]> {
  // 1) 캐시 확인
  const cache = await prisma.leaderboardCache.findUnique({
    where: { id: CACHE_KEY },
  });

  if (cache && now.getTime() - cache.updatedAt.getTime() < CACHE_TTL_MS) {
    // JSON 컬럼이라 타입 단언 — write 시점에 GuildRanking[]만 박음
    return cache.topGuilds as unknown as GuildRanking[];
  }

  // 2) 재계산
  const rankings = await computeLeaderboard();

  // 3) 캐시 저장 (upsert — 첫 호출 시 row 없을 수 있음)
  await prisma.leaderboardCache.upsert({
    where: { id: CACHE_KEY },
    create: {
      id: CACHE_KEY,
      topGuilds: rankings as unknown as object,
    },
    update: {
      topGuilds: rankings as unknown as object,
    },
  });

  // 4) Guild.seasonScore 컬럼도 동기화 (스키마 정합성)
  // 길드 15개라 일괄 업데이트 부담 없음. 트랜잭션 없이 병렬.
  await Promise.all(
    rankings.map((r) =>
      prisma.guild.update({
        where: { id: r.guildId },
        data: { seasonScore: r.seasonScore, scoreUpdatedAt: now },
      }),
    ),
  );

  return rankings;
}

/**
 * Guild × User × Dino 집계. 캐시 무시하고 항상 DB 직접 조회.
 * 내부용 — getLeaderboard에서만 호출.
 */
async function computeLeaderboard(
): Promise<GuildRanking[]> {
  // 모든 길드 조회 + 길드별 멤버의 Dino.totalCleanEnergy 합산
  // 길드 15개라 단순 loop가 충분. Raw SQL 사용 안 함 (Prisma 일관성).
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

  const rankings: Omit<GuildRanking, "rank">[] = guilds.map((g) => {
    const seasonScore = g.members.reduce(
      (sum, m) => sum + (m.dino?.totalCleanEnergy ?? 0),
      0,
    );
    return {
      guildId: g.id,
      regionCode: g.regionCode,
      displayName: g.displayName,
      seasonScore,
      memberCount: g.members.length,
    };
  });

  // 점수 desc 정렬 + rank 부여
  rankings.sort((a, b) => b.seasonScore - a.seasonScore);
  return rankings.map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * 단일 길드 + 길드원 리스트.
 * /api/guilds/me에서 사용. 본인 강조는 UI 책임.
 */
export interface GuildDetail {
  guild: {
    id: string;
    regionCode: string;
    displayName: string;
    seasonScore: number;
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
  now: Date = new Date(),
): Promise<GuildDetail | null> {
  // 전국 순위에서 이 길드 찾기 (rank·seasonScore 같이 가져옴)
  const leaderboard = await getLeaderboard(now);
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
      seasonScore: ranked.seasonScore,
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
