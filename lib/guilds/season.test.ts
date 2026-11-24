import { describe, expect, it } from "vitest";
import {
  currentSeason,
  listSeasons,
  MAX_PAST_SEASONS,
  parsePeriodParam,
  periodParam,
  seasonDaysLeft,
  seasonLabel,
  seasonRange,
  seasonShortLabel,
} from "./season";

// KST 2026-11-24 15:00
const NOW = new Date("2026-11-24T06:00:00.000Z");

describe("currentSeason / seasonRange", () => {
  it("시즌은 KST 달력 월", () => {
    expect(currentSeason(NOW)).toBe("2026-11");
    expect(currentSeason(new Date("2026-11-30T15:00:00.000Z"))).toBe("2026-12");
  });

  it("범위는 KST 1일 00:00부터 다음 달 1일 00:00 전까지", () => {
    const { start, end } = seasonRange("2026-11");
    expect(start.toISOString()).toBe("2026-10-31T15:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-30T15:00:00.000Z");
  });
});

describe("parsePeriodParam / periodParam", () => {
  it("값이 없거나 잘못되면 이번 시즌", () => {
    for (const p of [undefined, "", "2026-13", "abc", "2026-1"]) {
      expect(parsePeriodParam(p, NOW)).toEqual({ kind: "season", season: "2026-11" });
    }
  });

  it("미래 시즌은 이번 시즌으로", () => {
    expect(parsePeriodParam("2026-12", NOW)).toEqual({ kind: "season", season: "2026-11" });
  });

  it("지난 시즌과 역대 누적", () => {
    expect(parsePeriodParam("2026-10", NOW)).toEqual({ kind: "season", season: "2026-10" });
    expect(parsePeriodParam("all", NOW)).toEqual({ kind: "all" });
  });

  it("이번 시즌은 URL에서 생략한다", () => {
    expect(periodParam({ kind: "season", season: "2026-11" }, NOW)).toBeNull();
    expect(periodParam({ kind: "season", season: "2026-10" }, NOW)).toBe("2026-10");
    expect(periodParam({ kind: "all" }, NOW)).toBe("all");
  });
});

describe("listSeasons", () => {
  it("이번 시즌부터 가장 오래된 기록의 달까지 최신순", () => {
    expect(listSeasons(new Date("2026-09-10T00:00:00.000Z"), NOW)).toEqual([
      "2026-11",
      "2026-10",
      "2026-09",
    ]);
  });

  it("기록이 없으면 이번 시즌만", () => {
    expect(listSeasons(null, NOW)).toEqual(["2026-11"]);
  });

  it("연도를 넘어가고, 지난 시즌은 최대 개수까지만", () => {
    const seasons = listSeasons(new Date("2020-01-01T00:00:00.000Z"), NOW);
    expect(seasons).toHaveLength(MAX_PAST_SEASONS + 1);
    expect(seasons.at(-1)).toBe("2025-11");
  });
});

describe("라벨·남은 날짜", () => {
  it("라벨", () => {
    expect(seasonLabel("2026-01")).toBe("2026년 1월");
    expect(seasonShortLabel("2026-01")).toBe("1월");
  });

  it("남은 날짜는 오늘 포함 올림, 끝난 시즌은 0", () => {
    expect(seasonDaysLeft("2026-11", NOW)).toBe(7); // 11/24 15시 → 12/1 0시
    expect(seasonDaysLeft("2026-10", NOW)).toBe(0);
  });
});
