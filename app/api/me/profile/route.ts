// PUT /api/me/profile — 첫 생성 + 갱신 통합.
//
// 생성·갱신 규칙(길드 합류, 쿨다운)은 lib/profile/profile.server.ts의 saveProfile 참조.

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, UnauthorizedError } from "@/lib/auth/require-user";
import { saveProfile } from "@/lib/profile/profile.server";
import { errorResponse } from "@/lib/types/api";
import { isValidRegionCode } from "@/lib/static-data/regions";

const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]{2,12}$/;

const ProfileSchema = z.object({
  nickname: z
    .string()
    .regex(NICKNAME_REGEX, "닉네임은 2~12자 한글·영문·숫자만 가능합니다."),
  regionCode: z
    .string()
    .length(5, "올바른 동네 코드가 아닙니다.")
    .refine(isValidRegionCode, "지원하지 않는 동네입니다."),
});

export async function PUT(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return errorResponse("UNAUTHORIZED", "로그인이 필요합니다.", 401);
    }
    throw err;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "요청 본문이 올바르지 않습니다.", 400);
  }

  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "입력값이 올바르지 않습니다.",
      400,
      parsed.error.flatten().fieldErrors,
    );
  }

  const result = await saveProfile(ctx.user.id, parsed.data);

  switch (result.kind) {
    case "created":
      return Response.json(result.profile, { status: 201 });
    case "updated":
    case "unchanged":
      return Response.json(result.profile);
    case "GUILD_NOT_FOUND":
      return errorResponse(
        "GUILD_NOT_FOUND",
        "해당 동네의 길드를 찾을 수 없습니다.",
        500,
      );
    case "NICKNAME_TAKEN":
      return errorResponse(
        "NICKNAME_TAKEN",
        "이미 사용 중인 닉네임입니다.",
        409,
      );
    case "NICKNAME_COOLDOWN":
      return errorResponse(
        "NICKNAME_COOLDOWN",
        `닉네임 변경은 ${result.cooldownDays}일에 한 번 가능합니다. ${result.remainingDays}일 후 다시 시도해주세요.`,
        409,
      );
    case "REGION_COOLDOWN":
      return errorResponse(
        "REGION_COOLDOWN",
        `동네 변경은 ${result.cooldownDays}일에 한 번 가능합니다. ${result.remainingDays}일 후 다시 시도해주세요.`,
        409,
      );
  }
}
