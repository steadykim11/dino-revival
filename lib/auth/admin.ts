// 관리자 판정.
//
// - ADMIN_USER_IDS 환경변수 (쉼표 구분 UUID 목록)
// - 로그인된 사용자 중 이 목록에 있는 user.id만 관리자
// - 라우트는 route({ auth: "admin" }), 페이지는 getAuthUser + isAdminUserId로 확인한다

import { env } from "@/lib/env";

/**
 * user.id가 ADMIN_USER_IDS에 포함되는지 검사.
 * ADMIN_USER_IDS 미설정 또는 빈 문자열이면 항상 false (안전 기본값).
 */
export function isAdminUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return getAdminIds().has(userId);
}

// ADMIN_USER_IDS는 환경변수 1회 파싱 + 캐시.
// 런타임에 변경되지 않으므로 process 수명 동안 재계산 불필요.
let cachedIds: Set<string> | null = null;
function getAdminIds(): Set<string> {
  if (cachedIds) return cachedIds;
  const raw = env.ADMIN_USER_IDS ?? "";
  cachedIds = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
  return cachedIds;
}
