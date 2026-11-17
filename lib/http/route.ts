// Route Handler 래퍼. 모든 app/api 라우트는 이것으로 감싼다.
//
//   export const POST = route(
//     { auth: "user", body: Schema },
//     async ({ user, body }) => Response.json(...),
//   );
//
// 인증·본문 검증·에러 응답 규칙은 create-route.ts 참조.
// 도메인 오류(예: 닉네임 중복)는 핸들러가 errorResponse로 직접 돌려준다.

import { isAdminUserId } from "@/lib/auth/admin";
import { getAuthUser } from "@/lib/auth/session.server";
import { createRoute } from "./create-route";

export const route = createRoute({
  getUser: getAuthUser,
  isAdmin: isAdminUserId,
});

export { errorResponse } from "./api-error";
