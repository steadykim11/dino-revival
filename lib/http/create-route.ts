// Route Handler 래퍼의 본체. 인증·본문 파싱·검증·에러 응답을 한 곳에서 처리한다.
//
// 인증 수단은 주입받는다 — 이 파일은 Supabase·DB에 의존하지 않아 그대로 테스트할 수 있다.
// 실제 라우트는 lib/http/route.ts의 `route`를 쓴다.
//
// 처리 순서와 응답:
//   1. 인증    — 미인증 401 UNAUTHORIZED, 관리자 아님 403 FORBIDDEN
//   2. 본문    — JSON 아님 400 INVALID_JSON, 스키마 불일치 400 VALIDATION_ERROR
//   3. 핸들러  — 예상하지 못한 예외는 500 INTERNAL_ERROR (내용은 로그에만 남긴다)

import type { NextRequest } from "next/server";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { errorResponse } from "./api-error";

export type RouteAuth = "public" | "user" | "admin";

export interface RouteDeps<TUser extends { id: string }> {
  /** 현재 요청의 인증된 사용자. 미인증이면 null. */
  getUser: () => Promise<TUser | null>;
  isAdmin: (userId: string) => boolean;
}

export interface RouteOptions<
  TAuth extends RouteAuth,
  TSchema extends z.ZodType | undefined,
> {
  /** public: 누구나 / user: 로그인 필요 / admin: 관리자만 */
  auth: TAuth;
  /** 요청 본문(JSON)의 zod 스키마. 주면 검증을 통과한 값이 ctx.body로 들어온다. */
  body?: TSchema;
}

export interface RouteContext<
  TUser,
  TAuth extends RouteAuth,
  TSchema extends z.ZodType | undefined,
> {
  req: NextRequest;
  /** auth가 public이면 null */
  user: TAuth extends "public" ? null : TUser;
  /** body 스키마를 주지 않았으면 undefined */
  body: TSchema extends z.ZodType ? z.infer<TSchema> : undefined;
}

export function createRoute<TUser extends { id: string }>(
  deps: RouteDeps<TUser>,
) {
  return function route<
    TAuth extends RouteAuth,
    TSchema extends z.ZodType | undefined = undefined,
  >(
    options: RouteOptions<TAuth, TSchema>,
    handler: (ctx: RouteContext<TUser, TAuth, TSchema>) => Promise<Response>,
  ): (req: NextRequest) => Promise<Response> {
    return async (req) => {
      try {
        // 1) 인증
        let user: TUser | null = null;
        if (options.auth !== "public") {
          user = await deps.getUser();
          if (!user) {
            return errorResponse("UNAUTHORIZED", "로그인이 필요합니다.", 401);
          }
          if (options.auth === "admin" && !deps.isAdmin(user.id)) {
            return errorResponse(
              "FORBIDDEN",
              "관리자 권한이 필요합니다.",
              403,
            );
          }
        }

        // 2) 본문 파싱·검증
        let body: unknown = undefined;
        if (options.body) {
          let raw: unknown;
          try {
            raw = await req.json();
          } catch {
            return errorResponse(
              "INVALID_JSON",
              "요청 본문이 올바르지 않습니다.",
              400,
            );
          }

          const parsed = options.body.safeParse(raw);
          if (!parsed.success) {
            const { formErrors, fieldErrors } = parsed.error.flatten();
            return errorResponse(
              "VALIDATION_ERROR",
              // 필드에 속하지 않는 오류(refine 등)가 있으면 그 문장을 보여준다
              formErrors[0] ?? "입력값이 올바르지 않습니다.",
              400,
              fieldErrors,
            );
          }
          body = parsed.data;
        }

        // 3) 핸들러
        return await handler({ req, user, body } as RouteContext<
          TUser,
          TAuth,
          TSchema
        >);
      } catch (err) {
        // redirect()·notFound() 등 Next 내부 신호는 그대로 통과시킨다
        unstable_rethrow(err);

        console.error(
          `[api] ${req.method} ${req.nextUrl.pathname} failed:`,
          err,
        );
        return errorResponse(
          "INTERNAL_ERROR",
          "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
          500,
        );
      }
    };
  };
}
