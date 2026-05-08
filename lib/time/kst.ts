/**
 * KST(+09:00) 기준 시간 처리 유틸
 *
 * 원칙:
 *   - DB에는 항상 UTC 저장 (Postgres timestamptz)
 *   - KPX는 KST로 응답 → 파싱 시 UTC로 변환
 *   - 사용자 표시는 클라이언트 측 toLocaleString으로 변환
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * "20260507150500" (KST) → Date (UTC)
 * KPX 응답의 baseDatetime / baseDateTime 필드 파싱
 */
export function parseKpxDateTime(s: string): Date {
  if (!/^\d{14}$/.test(s)) {
    throw new Error(`Invalid KPX datetime format: ${s}`);
  }
  const utcMs =
    Date.UTC(
      +s.slice(0, 4),
      +s.slice(4, 6) - 1,
      +s.slice(6, 8),
      +s.slice(8, 10),
      +s.slice(10, 12),
      +s.slice(12, 14),
    ) - KST_OFFSET_MS;
  return new Date(utcMs);
}

// UTC Date → 5분 단위 내림 정규화
export function normalizeTo5Min(d: Date): Date {
  const ms = d.getTime();
  const fiveMin = 5 * 60 * 1000;
  return new Date(Math.floor(ms / fiveMin) * fiveMin);
}

// UTC Date → KST의 "yyyy-MM-dd" 문자열 (assignedDate 등에 사용)
export function toKstDateString(d: Date): string {
  const kst = new Date(d.getTime() + KST_OFFSET_MS);
  return kst.toISOString().slice(0, 10);
}

// UTC Date → KST의 시(0~23) 추출
export function getKstHour(d: Date): number {
  const kst = new Date(d.getTime() + KST_OFFSET_MS);
  return kst.getUTCHours();
}

// UTC Date → KST의 분(0~59) 추출
export function getKstMinute(d: Date): number {
  const kst = new Date(d.getTime() + KST_OFFSET_MS);
  return kst.getUTCMinutes();
}
