// 오늘의 예상 최대부하 (ADR 42).
//
// 값은 수집 작업이 스냅샷마다 저장한 KPX D1의 forecastLoad(당일 최대 예측 수요)다.
// 레벨은 절대값이 아니라 최근 7일의 일별 예측치와 비교해 정한다 — 계절에 따라
// 피크 수준이 크게 달라서 고정 임계값으로는 한 계절 내내 같은 색이 나온다.

import { kstNextMidnight, toKstDateString } from "../time/kst";
import type { ForecastLevel, TodayForecastResponse } from "./types";

/** 비교에 쓰는 과거 일수 */
export const FORECAST_HISTORY_DAYS = 7;

/** 과거 7일 중 이 수 이상보다 높으면 HIGH, 낮으면 LOW (8일 중 상위·하위 3일) */
const RANK_MARGIN = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ForecastPoint {
  ts: Date;
  forecastLoad: number; // MW
}

/** 조회 시작 시각: 오늘 포함 8일 전 KST 자정 (오늘 + 과거 7일) */
export function forecastWindowStart(now: Date): Date {
  return new Date(
    kstNextMidnight(now).getTime() - (FORECAST_HISTORY_DAYS + 1) * DAY_MS,
  );
}

/**
 * KST 날짜별 예측치. 예측은 하루 중에 갱신될 수 있으므로 그날 마지막 값을 쓴다.
 * 반환 Map은 날짜 오름차순.
 */
export function dailyForecasts(points: ForecastPoint[]): Map<string, number> {
  const sorted = [...points].sort((a, b) => a.ts.getTime() - b.ts.getTime());
  const byDay = new Map<string, number>();
  for (const p of sorted) {
    byDay.set(toKstDateString(p.ts), p.forecastLoad);
  }
  return new Map([...byDay].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * 오늘 예측치를 과거 일별 예측치와 비교한 레벨.
 * 과거 값이 7일치 모이지 않았으면 null (색 없이 값만 표시).
 */
export function classifyForecastLevel(
  todayLoad: number,
  pastLoads: number[],
): ForecastLevel | null {
  if (pastLoads.length < FORECAST_HISTORY_DAYS) return null;
  const higherThan = pastLoads.filter((v) => todayLoad > v).length;
  const lowerThan = pastLoads.filter((v) => todayLoad < v).length;
  if (higherThan >= RANK_MARGIN) return "HIGH";
  if (lowerThan >= RANK_MARGIN) return "LOW";
  return "MEDIUM";
}

/**
 * 스냅샷의 예측치들로 오늘의 예상 최대부하를 만든다.
 * 오늘(KST) 수집된 예측치가 없으면 null.
 */
export function buildTodayForecast(
  points: ForecastPoint[],
  now: Date,
): TodayForecastResponse | null {
  const byDay = dailyForecasts(points);
  const today = toKstDateString(now);
  const todayLoad = byDay.get(today);
  if (todayLoad === undefined) return null;

  const pastLoads = [...byDay]
    .filter(([day]) => day < today)
    .slice(-FORECAST_HISTORY_DAYS)
    .map(([, load]) => load);

  return {
    peakLoadGW: Math.round(todayLoad / 100) / 10,
    level: classifyForecastLevel(todayLoad, pastLoads),
  };
}
