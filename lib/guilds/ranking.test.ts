import { describe, expect, it } from "vitest";
import { rankGuilds, type GuildScoreInput } from "./ranking";

const guild = (
  id: string,
  memberCleanEnergy: number[],
): GuildScoreInput => ({
  id,
  regionCode: `r-${id}`,
  displayName: `길드 ${id}`,
  memberCleanEnergy,
});

describe("rankGuilds", () => {
  it("길드원 누적 클린에너지의 합이 점수", () => {
    const [g] = rankGuilds([guild("a", [100, 250, 0])]);
    expect(g.score).toBe(350);
    expect(g.memberCount).toBe(3);
  });

  it("점수 내림차순으로 1부터 순위를 매긴다", () => {
    const result = rankGuilds([
      guild("low", [10]),
      guild("high", [500, 500]),
      guild("mid", [300]),
    ]);
    expect(result.map((g) => [g.guildId, g.rank, g.score])).toEqual([
      ["high", 1, 1000],
      ["mid", 2, 300],
      ["low", 3, 10],
    ]);
  });

  it("길드원이 없는 길드는 0점으로 포함된다", () => {
    const result = rankGuilds([guild("empty", []), guild("a", [1])]);
    expect(result.map((g) => [g.guildId, g.score, g.memberCount])).toEqual([
      ["a", 1, 1],
      ["empty", 0, 0],
    ]);
  });

  it("동점이면 입력 순서를 유지하고 순위는 연속 번호", () => {
    const result = rankGuilds([
      guild("first", [100]),
      guild("second", [100]),
      guild("top", [200]),
    ]);
    expect(result.map((g) => [g.guildId, g.rank])).toEqual([
      ["top", 1],
      ["first", 2],
      ["second", 3],
    ]);
  });

  it("표시 정보를 그대로 전달한다", () => {
    const [g] = rankGuilds([guild("a", [1])]);
    expect(g).toMatchObject({
      guildId: "a",
      regionCode: "r-a",
      displayName: "길드 a",
    });
  });

  it("빈 입력이면 빈 결과", () => {
    expect(rankGuilds([])).toEqual([]);
  });
});
