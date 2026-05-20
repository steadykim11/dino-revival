// 관리자 인증 헬퍼.
//
// - ADMIN_USER_IDS 환경변수 (쉼표 구분 UUID 목록)
// - Supabase Auth로 로그인된 사용자 중 화이트리스트에 있는 user.id만 통과
// - cron.ts와 메커니즘 다름 (헤더 토큰 X, 세션 + UID 화이트리스트)
// - withAuth와 같은 HOF 패턴 + 인라인 호출용 가드 함수 둘 다 제공
//
// D19: handler 시그니처에 NextRequest 추가 — body 파싱이 필요한 PATCH/POST 지원.
//      D18 GET·body-less POST는 두 번째 인자를 무시하면 됨.

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { requireUser, UnauthorizedError } from "./require-user";

/**
 * user.id가 ADMIN_USER_IDS에 포함되는지 검사.
 * ADMIN_USER_IDS 미설정 또는 빈 문자열이면 항상 false (안전 기본값).
 */
export function isAdminUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return getAdminIds().has(userId);
}

/**
 * 관리자 권한 부족 시 발생.
 * withAdmin이 자동 잡아 403 응답으로 변환.
 */
export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

/**
 * 관리자 전용 Route Handler 래퍼.
 * withAuth와 동일 시그니처 + 권한 체크 추가.
 *
 * - UnauthorizedError → 401 (require-user 패턴 일치)
 * - ForbiddenError    → 403
 */
export function withAdmin<T>(
  handler: (
    ctx: Awaited<ReturnType<typeof requireUser>>,
    req: NextRequest,
  ) => Promise<T>,
) {
  return async (req: NextRequest) => {
    try {
      const ctx = await requireUser();
      if (!isAdminUserId(ctx.user.id)) {
        throw new ForbiddenError();
      }
      return await handler(ctx, req);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } },
          { status: 401 },
        );
      }
      if (err instanceof ForbiddenError) {
        return NextResponse.json(
          {
            error: { code: "FORBIDDEN", message: "관리자 권한이 필요합니다." },
          },
          { status: 403 },
        );
      }
      throw err;
    }
  };
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
