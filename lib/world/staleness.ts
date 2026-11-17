// 수집 주기와 스냅샷 지연 판정.
//
// 공공데이터포털의 일일 호출 한도가 API당 100회라 20분마다 수집한다
// (하루 72회 — 재시도와 수동 실행 여유 28회). .github/workflows/collect.yml의 cron과 맞출 것.
//
// 수집이 2회 연속 빠져도 정상 범위로 보고, 3회분(60분)을 넘기면 "지연"으로 표시한다.
// 수집기가 멈추면 마지막 값이 계속 남으므로, 저장 플래그가 아니라
// 읽는 시점에 ts와 현재 시각을 비교해 판정한다.

export const COLLECT_INTERVAL_MIN = 20;

export const SNAPSHOT_STALE_AFTER_MS = 3 * COLLECT_INTERVAL_MIN * 60 * 1000;

/** 화면 문구용 — 지연 기준(분) */
export const SNAPSHOT_STALE_AFTER_MIN = SNAPSHOT_STALE_AFTER_MS / 60_000;

export function isSnapshotStale(ts: Date, now: Date = new Date()): boolean {
  return now.getTime() - ts.getTime() > SNAPSHOT_STALE_AFTER_MS;
}
