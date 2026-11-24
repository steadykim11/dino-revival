import { describe, expect, it } from "vitest";
import { rankGuilds, rankMembers, type GuildScoreInput } from "./ranking";

const guild = (guildId: string, score: number, memberCount = 1): GuildScoreInput => ({
  guildId,
  regionCode: `r-${guildId}`,
  displayName: `길드 ${guildId}`,
  score,
  memberCount,
});

describe("rankGuilds", () => {
  it("점수 내림차순으로 1부터 순위를 매긴다", () => {
    const result = rankGuilds([guild("low", 10), guild("high", 1000), guild("mid", 300)]);
    expect(result.map((g) => [g.guildId, g.rank, g.score])).toEqual([
      ["high", 1, 1000],
      ["mid", 2, 300],
      ["low", 3, 10],
    ]);
  });

  it("동점이면 입력 순서를 유지하고 순위는 연속 번호", () => {
    const result = rankGuilds([guild("first", 100), guild("second", 100), guild("top", 200)]);
    expect(result.map((g) => [g.guildId, g.rank])).toEqual([
      ["top", 1],
      ["first", 2],
      ["second", 3],
    ]);
  });

  it("표시 정보를 그대로 전달하고 입력 배열은 바꾸지 않는다", () => {
    const input = [guild("b", 1, 0), guild("a", 2, 3)];
    const [g] = rankGuilds(input);
    expect(g).toEqual({
      guildId: "a",
      regionCode: "r-a",
      displayName: "길드 a",
      score: 2,
      memberCount: 3,
      rank: 1,
    });
    expect(input.map((x) => x.guildId)).toEqual(["b", "a"]);
  });

  it("빈 입력이면 빈 결과", () => {
    expect(rankGuilds([])).toEqual([]);
  });
});

describe("rankMembers", () => {
  const person = (userId: string, nickname: string) => ({ userId, nickname, isDummy: false });

  it("점수 내림차순, 같으면 닉네임순. 점수 없는 사람은 0점", () => {
    const result = rankMembers(
      [person("u1", "다람쥐"), person("u2", "가람"), person("u3", "나무")],
      new Map([
        ["u1", 50],
        ["u3", 50],
      ]),
    );
    expect(result.map((m) => [m.nickname, m.cleanEnergy])).toEqual([
      ["나무", 50],
      ["다람쥐", 50],
      ["가람", 0],
    ]);
  });
});
