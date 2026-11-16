import { describe, expect, it } from "vitest";
import { LATEST_WEEKLY_FORECAST } from "@/lib/static-data/weekly-peak-forecast";
import { classifyForecastLevel, getTodayForecast } from "./peak-forecast";

const week = [
  { date: "2026-01-01", peakLoadGW: 60 },
  { date: "2026-01-02", peakLoadGW: 64 },
  { date: "2026-01-03", peakLoadGW: 70 },
  { date: "2026-01-04", peakLoadGW: 76 },
  { date: "2026-01-05", peakLoadGW: 80 },
];

describe("classifyForecastLevel", () => {
  it("주간 최고치는 항상 HIGH, 최저치는 항상 LOW", () => {
    expect(classifyForecastLevel(80, week)).toBe("HIGH");
    expect(classifyForecastLevel(60, week)).toBe("LOW");
  });

  it("그 외는 절대값 기준: <65 LOW, 65~75 MEDIUM, ≥75 HIGH", () => {
    expect(classifyForecastLevel(64, week)).toBe("LOW");
    expect(classifyForecastLevel(70, week)).toBe("MEDIUM");
    expect(classifyForecastLevel(76, week)).toBe("HIGH");
  });

  it("절대값이 낮아도 주간 최고치면 HIGH", () => {
    const lowWeek = [
      { date: "2026-04-01", peakLoadGW: 55 },
      { date: "2026-04-02", peakLoadGW: 58 },
      { date: "2026-04-03", peakLoadGW: 61 },
    ];
    expect(classifyForecastLevel(61, lowWeek)).toBe("HIGH");
    expect(classifyForecastLevel(58, lowWeek)).toBe("LOW");
  });
});

describe("getTodayForecast", () => {
  const { days } = LATEST_WEEKLY_FORECAST;

  it("자료에 있는 날짜면 부하·레벨·주간 순위를 돌려준다", () => {
    const top = [...days].sort((a, b) => b.peakLoadGW - a.peakLoadGW)[0];
    // KST 정오
    const result = getTodayForecast(new Date(`${top.date}T03:00:00.000Z`));
    expect(result).toEqual({
      peakLoadGW: top.peakLoadGW,
      level: "HIGH",
      weeklyRank: 1,
    });
  });

  it("날짜 판정은 KST 기준", () => {
    const first = days[0];
    // 첫 날짜의 KST 00:30 = UTC 전날 15:30
    const kstEarly = new Date(`${first.date}T00:30:00+09:00`);
    expect(getTodayForecast(kstEarly)?.peakLoadGW).toBe(first.peakLoadGW);
  });

  it("자료 범위 밖 날짜면 null", () => {
    expect(getTodayForecast(new Date("2000-01-01T03:00:00.000Z"))).toBeNull();
  });
});
