import {
  DailyPeakForecast,
  LATEST_WEEKLY_FORECAST,
} from "../static-data/weekly-peak-forecast";
import { toKstDateString } from "../time/kst";

export type ForecastLevel = "LOW" | "MEDIUM" | "HIGH";

export interface TodayForecast {
  peakLoadGW: number;
  level: ForecastLevel;
  // 발표된 날짜 중 부하 순위 (1=가장 높음)
  weeklyRank: number;
}

// 절대값 임계 (GW) - 한국 연간 부하 곡선 기준
const ABS_LOW_MAX = 65;
const ABS_HIGH_MIN = 75;

/**
 * 절대값 + 주간 상대적 기준 레벨
 *
 * 규칙:
 * - peakLoadGW >= 75   --> HIGH
 * - peakLoadGW < 65   --> LOW
 * - 그 외(65~75 사이)   --> MEDIUM
 * ※ 단, 주간 최고치는 항상 HIGH(시연 시 필요), 주간 최저치는 항상 LOW
 */
export function classifyForecastLevel(
  peakLoadGW: number,
  weekDays: DailyPeakForecast[],
): ForecastLevel {
  const loads = weekDays.map((d) => d.peakLoadGW);
  const weekMax = Math.max(...loads);
  const weekMin = Math.min(...loads);

  if (peakLoadGW === weekMax) return "HIGH";
  if (peakLoadGW === weekMin) return "LOW";

  if (peakLoadGW >= ABS_HIGH_MIN) return "HIGH";
  if (peakLoadGW < ABS_LOW_MAX) return "LOW";
  return "MEDIUM";
}

// KST 기준 오늘 날짜에 해당하는 forecast 조회
// 자료에 오늘 날짜가 없을 시 null (자료 갱신이 안 됐거나 시연 시점이 자료 밖일 때)
export function getTodayForecast(now: Date = new Date()): TodayForecast | null {
  const today = toKstDateString(now);
  const { days } = LATEST_WEEKLY_FORECAST;
  const todayEntry = days.find((d) => d.date === today);
  if (!todayEntry) return null;

  const level = classifyForecastLevel(todayEntry.peakLoadGW, days);

  // 부하 내림순 정렬 -> 오늘 몇 번째인지
  const sorted = [...days].sort((a, b) => b.peakLoadGW - a.peakLoadGW);
  const weeklyRank = sorted.findIndex((d) => d.date === today) + 1;

  return {
    peakLoadGW: todayEntry.peakLoadGW,
    level,
    weeklyRank,
  };
}
