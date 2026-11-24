// 길드 시즌 (ADR 43). 순수 함수.
//
// 시즌은 KST 달력 월이다. 시즌 테이블이나 자정 작업 없이 날짜로 계산한다.
// 시즌 키는 "yyyy-MM" (예: "2026-11").

import { kstMonthStart, toKstMonthString } from "@/lib/time/kst";

/** 점수를 셀 기간: 한 시즌 또는 역대 누적 */
export type ScorePeriod = { kind: "season"; season: string } | { kind: "all" };

/** URL ?season= 값에서 역대 누적을 뜻하는 값 */
export const ALL_TIME_PARAM = "all";

/** 리더보드에서 고를 수 있는 지난 시즌 수 (이번 시즌 제외) */
export const MAX_PAST_SEASONS = 12;

const SEASON_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function currentSeason(now: Date): string {
  return toKstMonthString(now);
}

/** 시즌의 [start, end) — UTC Date */
export function seasonRange(season: string): { start: Date; end: Date } {
  return { start: kstMonthStart(season), end: kstMonthStart(season, 1) };
}

/**
 * ?season= 값 → 기간. 없거나 잘못됐거나 미래 시즌이면 이번 시즌.
 */
export function parsePeriodParam(param: string | undefined, now: Date): ScorePeriod {
  if (param === ALL_TIME_PARAM) return { kind: "all" };
  const current = currentSeason(now);
  if (param && SEASON_PATTERN.test(param) && param <= current) {
    return { kind: "season", season: param };
  }
  return { kind: "season", season: current };
}

/** 기간 → ?season= 값. 이번 시즌은 생략(null)한다. */
export function periodParam(period: ScorePeriod, now: Date): string | null {
  if (period.kind === "all") return ALL_TIME_PARAM;
  return period.season === currentSeason(now) ? null : period.season;
}

/**
 * 고를 수 있는 시즌 목록 (최신순). 이번 시즌부터 가장 오래된 기록이 있는 달까지,
 * 지난 시즌은 최대 MAX_PAST_SEASONS개.
 */
export function listSeasons(earliest: Date | null, now: Date): string[] {
  const current = currentSeason(now);
  const oldest = earliest ? toKstMonthString(earliest) : current;
  const seasons = [current];
  for (let i = 1; i <= MAX_PAST_SEASONS; i++) {
    const season = toKstMonthString(kstMonthStart(current, -i));
    if (season < oldest) break;
    seasons.push(season);
  }
  return seasons;
}

/** "2026-11" → "2026년 11월" */
export function seasonLabel(season: string): string {
  const [y, m] = season.split("-").map(Number);
  return `${y}년 ${m}월`;
}

/** "2026-11" → "11월" */
export function seasonShortLabel(season: string): string {
  return `${Number(season.slice(5, 7))}월`;
}

/** 시즌 종료까지 남은 날짜 수 (오늘 포함, 올림). 끝난 시즌은 0. */
export function seasonDaysLeft(season: string, now: Date): number {
  const { end } = seasonRange(season);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
}
