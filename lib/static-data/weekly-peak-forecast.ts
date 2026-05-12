/**
 * 한국전력거래소에서 매주 금요일 발표하는 '주간 전력수요 실적 및 전망' 자료의 일별 최대부하 전망값
 * 갱신 절차는 docs/sources/weekly-peak-forecast.md 참조
 * 마지막 갱신: 2026-05-08 발표분
 */

// 단일 일별 예측 부하
// date는 KST 기준 'yyyy-MM-dd'
export interface DailyPeakForecast {
  date: string;
  peakLoadGW: number;
}

export interface WeeklyPeakForecast {
  // 자료 발표 날짜
  publishedAt: string;
  // 일별 최대부하 전망
  days: DailyPeakForecast[];
}

// 가장 최근 발표 자료, 시연 일정에 맞춰 추가 갱신 예정
export const LATEST_WEEKLY_FORECAST: WeeklyPeakForecast = {
  publishedAt: "2026-05-08",
  days: [
    { date: "2026-05-09", peakLoadGW: 58.7 },
    { date: "2026-05-10", peakLoadGW: 58.5 },
    { date: "2026-05-11", peakLoadGW: 67.5 },
    { date: "2026-05-12", peakLoadGW: 69.2 },
    { date: "2026-05-13", peakLoadGW: 68.5 },
    { date: "2026-05-14", peakLoadGW: 69.3 },
    { date: "2026-05-15", peakLoadGW: 68.3 },
    { date: "2026-05-16", peakLoadGW: 60.0 },
    { date: "2026-05-17", peakLoadGW: 58.9 },
  ],
};
