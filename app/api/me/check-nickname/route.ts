// 닉네임 중복 검사 — GET /api/me/check-nickname?nickname=...
// 인증 필요
// SAME_AS_CURRENT는 이미 자신이 사용 중인 닉네임을 다시 입력한 경우 (변경 폼에서 의미 있음, 신규 등록에선 발생 안 함)

import { route } from "@/lib/http/route";
import { checkNicknameConflict } from "@/lib/users/users.server";

// 닉네임 규칙: 2~12자, 한글·영문·숫자
const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]{2,12}$/;

export const GET = route({ auth: "user" }, async ({ req, user }) => {
  const nickname = (req.nextUrl.searchParams.get("nickname") ?? "").trim();

  if (!NICKNAME_REGEX.test(nickname)) {
    return Response.json({
      available: false,
      reason: "INVALID_FORMAT",
    });
  }

  const conflict = await checkNicknameConflict(user.id, nickname);
  if (conflict) {
    return Response.json({ available: false, reason: conflict });
  }

  return Response.json({ available: true });
});
