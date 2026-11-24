// 더미 데이터용 결정적 해시. 같은 seed는 항상 같은 값을 낸다 (시드·활동 생성을 다시 돌려도 같은 결과).

import { createHash } from "node:crypto";

function sha256(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

/** seed → 0 이상 정수 (32비트) */
export function hashInt(seed: string): number {
  return parseInt(sha256(seed).slice(0, 8), 16);
}

/** seed → [min, max] 범위 정수 */
export function hashRangeOf(seed: string, min: number, max: number): number {
  return min + (hashInt(seed) % (max - min + 1));
}

/** seed → UUID v4 형식 문자열 */
export function hashToUuid(seed: string): string {
  const hash = sha256(seed);
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    "8" + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}
