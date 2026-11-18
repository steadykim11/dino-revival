// 닉네임 중복 검사 — GET /api/me/check-nickname?nickname=...
// 인증 필요
// SAME_AS_CURRENT는 이미 자신이 사용 중인 닉네임을 다시 입력한 경우 (변경 폼에서 의미 있음, 신규 등록에선 발생 안 함)

import { route } from "@/lib/http/route";
import { isValidName } from "@/lib/profile/name-rule";
import { checkNicknameConflict } from "@/lib/users/users.server";

export const GET = route({ auth: "user" }, async ({ req, user }) => {
  const nickname = (req.nextUrl.searchParams.get("nickname") ?? "").trim();

  if (!isValidName(nickname)) {
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
