import { describe, expect, it } from "vitest";
import {
  buildTodayForecast,
  classifyForecastLevel,
  dailyForecasts,
  forecastWindowStart,
} from "./peak-forecast";

// KST 2026-11-24 15:00
const NOW = new Date("2026-11-24T06:00:00.000Z");

/** KST 날짜 + 시각 → 예측 지점 */
const at = (kst: string, forecastLoad: number) => ({
  ts: new Date(`${kst}+09:00`),
  forecastLoad,
});

/** 11/17~11/23 일별 예측치 (MW) */
const PAST_WEEK = [70000, 72000, 74000, 76000, 78000, 80000, 82000].map(
  (load, i) => at(`2026-11-${17 + i}T12:00:00`, load),
);

describe("forecastWindowStart", () => {
  it("오늘 포함 8일 전 KST 자정을 돌려준다", () => {
    expect(forecastWindowStart(NOW).toISOString()).toBe(
      "2026-11-16T15:00:00.000Z", // KST 11/17 00:00
    );
  });
});

describe("dailyForecasts", () => {
  it("KST 날짜별로 그날 마지막 값을 쓴다", () => {
    const byDay = dailyForecasts([
      at("2026-11-24T10:00:00", 81000),
      at("2026-11-24T08:00:00", 80000),
      at("2026-11-23T23:55:00", 79000), // KST로는 11/23
    ]);
    expect([...byDay]).toEqual([
      ["2026-11-23", 79000],
      ["2026-11-24", 81000],
    ]);
  });
});

describe("classifyForecastLevel", () => {
  const past = [70, 72, 74, 76, 78, 80, 82];

  it("과거 7일 중 5일보다 높으면 HIGH", () => {
    expect(classifyForecastLevel(79, past)).toBe("HIGH");
    expect(classifyForecastLevel(90, past)).toBe("HIGH");
  });

  it("과거 7일 중 5일보다 낮으면 LOW", () => {
    expect(classifyForecastLevel(73, past)).toBe("LOW");
    expect(classifyForecastLevel(60, past)).toBe("LOW");
  });

  it("그 사이는 MEDIUM", () => {
    expect(classifyForecastLevel(76, past)).toBe("MEDIUM");
    expect(classifyForecastLevel(77, past)).toBe("MEDIUM");
  });

  it("과거 값이 7일치 안 되면 null", () => {
    expect(classifyForecastLevel(90, past.slice(1))).toBeNull();
    expect(classifyForecastLevel(90, [])).toBeNull();
  });
});

describe("buildTodayForecast", () => {
  it("오늘 마지막 예측치를 GW로 바꾸고 과거 7일과 비교한다", () => {
    const result = buildTodayForecast(
      [...PAST_WEEK, at("2026-11-24T09:00:00", 83456)],
      NOW,
    );
    expect(result).toEqual({ peakLoadGW: 83.5, level: "HIGH" });
  });

  it("오늘 수집된 예측치가 없으면 null", () => {
    expect(buildTodayForecast(PAST_WEEK, NOW)).toBeNull();
  });

  it("과거 기록이 모자라면 값만 내고 레벨은 null", () => {
    const result = buildTodayForecast(
      [...PAST_WEEK.slice(3), at("2026-11-24T09:00:00", 75000)],
      NOW,
    );
    expect(result).toEqual({ peakLoadGW: 75, level: null });
  });

  it("8일보다 오래된 값은 비교에서 뺀다", () => {
    const result = buildTodayForecast(
      [
        at("2026-11-10T12:00:00", 99000),
        ...PAST_WEEK,
        at("2026-11-24T09:00:00", 71000),
      ],
      NOW,
    );
    expect(result?.level).toBe("LOW");
  });
});
