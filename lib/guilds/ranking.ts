// 길드 순위 계산 (순수 함수).
//
// 길드 점수 = 길드원 Dino.totalCleanEnergy의 합 (누적 점수, 시즌 초기화 없음).
// 동네를 옮기면 누적값을 그대로 가져가므로 "현재 소속 길드원" 기준으로 합산한다.

export interface GuildRanking {
  guildId: string;
  regionCode: string;
  displayName: string;
  /** 길드원 누적 클린에너지 합 */
  score: number;
  memberCount: number;
  /** 1부터. 점수가 같으면 입력 순서를 유지한 채 연속 번호를 매긴다. */
  rank: number;
}

export interface GuildScoreInput {
  id: string;
  regionCode: string;
  displayName: string;
  /** 길드원별 누적 클린에너지. 공룡이 없는 길드원은 0. */
  memberCleanEnergy: number[];
}

export function rankGuilds(guilds: GuildScoreInput[]): GuildRanking[] {
  return guilds
    .map((g) => ({
      guildId: g.id,
      regionCode: g.regionCode,
      displayName: g.displayName,
      score: g.memberCleanEnergy.reduce((sum, e) => sum + e, 0),
      memberCount: g.memberCleanEnergy.length,
    }))
    .sort((a, b) => b.score - a.score)
    .map((g, i) => ({ ...g, rank: i + 1 }));
}
