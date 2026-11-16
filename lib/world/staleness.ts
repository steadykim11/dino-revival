// 스냅샷 지연 판정.
//
// KPX는 5분마다 갱신된다. 수집이 2회 연속 실패해도 정상 범위로 보고,
// 3회분(15분)을 넘기면 "지연"으로 표시한다.
// 수집기(홈서버)가 멈추면 마지막 값이 계속 남으므로, 저장 플래그가 아니라
// 읽는 시점에 ts와 현재 시각을 비교해 판정한다.

export const SNAPSHOT_STALE_AFTER_MS = 15 * 60 * 1000;

export function isSnapshotStale(ts: Date, now: Date = new Date()): boolean {
  return now.getTime() - ts.getTime() > SNAPSHOT_STALE_AFTER_MS;
}
