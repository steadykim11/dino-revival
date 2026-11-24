// 길드 순위 계산 (순수 함수).
//
// 점수 = 기간(시즌 또는 역대) 동안 그 길드 소속으로 기록된 미션 완료의
// cleanEnergyEarned 합 (ADR 43). 길드를 옮겨도 이미 쌓은 점수는 원래 길드에 남는다.

export interface GuildRanking {
  guildId: string;
  regionCode: string;
  displayName: string;
  /** 기간 점수 */
  score: number;
  /** 현재 길드원 수 */
  memberCount: number;
  /** 1부터. 점수가 같으면 입력 순서를 유지한 채 연속 번호를 매긴다. */
  rank: number;
}

export type GuildScoreInput = Omit<GuildRanking, "rank">;

export function rankGuilds(guilds: GuildScoreInput[]): GuildRanking[] {
  return [...guilds]
    .sort((a, b) => b.score - a.score)
    .map((g, i) => ({ ...g, rank: i + 1 }));
}

export interface GuildMember {
  userId: string;
  nickname: string;
  /** 기간 동안 이 길드에서 얻은 클린에너지 */
  cleanEnergy: number;
  isDummy: boolean;
}

/**
 * 길드원 목록 (점수 내림차순, 같으면 닉네임순).
 * people에는 현재 길드원과, 기간 중 이 길드에서 점수를 얻었지만 지금은 떠난 사람이 함께 들어온다.
 * 점수가 없는 사람은 0점.
 */
export function rankMembers(
  people: Omit<GuildMember, "cleanEnergy">[],
  scores: Map<string, number>,
): GuildMember[] {
  return people
    .map((p) => ({ ...p, cleanEnergy: scores.get(p.userId) ?? 0 }))
    .sort(
      (a, b) =>
        b.cleanEnergy - a.cleanEnergy || a.nickname.localeCompare(b.nickname),
    );
}
