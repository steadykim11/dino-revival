// GET /api/guilds/me — 내 길드 상세 + 길드원 리스트
//
// 응답:
// - guild: { id, regionCode, displayName, score, rank(전국 순위), memberCount }
// - members: [{ userId, nickname, cleanEnergy, isDummy }] (점수 desc)
// - me: { userId, nickname, cleanEnergy, rankInGuild } (UI 본인 강조용)

import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth/require-user";
import { getUserGuildInfo } from "@/lib/users/users.server";
import { errorResponse } from "@/lib/types/api";
import { getGuildDetail } from "@/lib/guilds/score.server";

export async function GET() {
  let ctx;
  try {
    ctx = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return errorResponse("UNAUTHORIZED", "로그인이 필요합니다.", 401);
    }
    throw err;
  }

  // 본인 User row 조회 (guildId 확인)
  const me = await getUserGuildInfo(ctx.user.id);

  if (!me) {
    return errorResponse("PROFILE_REQUIRED", "프로필 등록이 필요합니다.", 404);
  }
  if (!me.guildId) {
    // 이론상 발생 불가 (D9에서 길드 자동 합류) — 정합성 오류
    return errorResponse(
      "GUILD_NOT_ASSIGNED",
      "길드 정보를 찾을 수 없습니다.",
      500,
    );
  }

  const detail = await getGuildDetail(me.guildId);
  if (!detail) {
    return errorResponse("GUILD_NOT_FOUND", "길드를 찾을 수 없습니다.", 404);
  }

  // 본인의 길드 내 순위 계산 (UI 본인 강조용 부가 정보)
  const myRankInGuild = detail.members.findIndex((m) => m.userId === me.id) + 1;
  const myMember = detail.members.find((m) => m.userId === me.id);

  return NextResponse.json({
    guild: detail.guild,
    members: detail.members,
    me: myMember
      ? {
          userId: myMember.userId,
          nickname: myMember.nickname,
          cleanEnergy: myMember.cleanEnergy,
          rankInGuild: myRankInGuild,
        }
      : null,
  });
}
