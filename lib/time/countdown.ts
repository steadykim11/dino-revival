// 카운트다운 계산 (순수 함수).

/**
 * 서버가 "지금부터 N초 남았다"고 알려준 값을, 그 응답을 받은 뒤 흐른 시간만큼 줄인다.
 *
 * 만료 시각(expiresAt)과 기기 시계를 직접 비교하지 않는 이유: 사용자 기기의 시계가
 * 틀려 있어도 "받은 뒤 흐른 시간"은 정확하기 때문이다.
 *
 * @param remainingSecAtReceive 응답에 담긴 남은 초
 * @param receivedAtMs 그 응답을 받은 시각 (ms)
 * @param nowMs 현재 시각 (ms, receivedAtMs와 같은 시계)
 * @returns 남은 초 (0 미만으로 내려가지 않는 정수)
 */
export function remainingSecondsAt(
  remainingSecAtReceive: number,
  receivedAtMs: number,
  nowMs: number,
): number {
  const elapsedSec = Math.max(0, Math.floor((nowMs - receivedAtMs) / 1000));
  return Math.max(0, Math.floor(remainingSecAtReceive) - elapsedSec);
}

/** 초 → "MM:SS" (60분 이상이면 분이 세 자리 이상이 된다) */
export function formatCountdown(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const ss = (sec % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}
