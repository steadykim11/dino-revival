// 닉네임 중복 검사
// 인증 필요
// SAME_AS_CURRENT는 이미 자신이 사용 중인 닉네임을 다시 입력한 경우 (변경 폼에서 의미 있음, 신규 등록에선 발생 안 함)

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, UnauthorizedError } from "@/lib/auth/require-user";
import { checkNicknameConflict } from "@/lib/users/users.server";
import { errorResponse } from "@/lib/types/api";

// 닉네임 규칙: 2~12자, 한글·영문·숫자
const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]{2,12}$/;

const QuerySchema = z.object({
  nickname: z.string(),
});

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return errorResponse("UNAUTHORIZED", "로그인이 필요합니다.", 401);
    }
    throw err;
  }

  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    nickname: searchParams.get("nickname") ?? "",
  });

  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "nickname 쿼리가 필요합니다.",
      400,
    );
  }

  const nickname = parsed.data.nickname.trim();

  if (!NICKNAME_REGEX.test(nickname)) {
    return Response.json({
      available: false,
      reason: "INVALID_FORMAT",
    });
  }

  const conflict = await checkNicknameConflict(ctx.user.id, nickname);
  if (conflict) {
    return Response.json({ available: false, reason: conflict });
  }

  return Response.json({ available: true });
}
