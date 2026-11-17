// GET /api/guilds/leaderboard — 전국 길드 순위
//
// 조회할 때마다 계산한다 (캐시 없음)
// 응답: 길드 전체 (현재 15개) 순위 desc

import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth/require-user";
import { errorResponse } from "@/lib/types/api";
import { getLeaderboard } from "@/lib/guilds/score.server";

export async function GET() {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return errorResponse("UNAUTHORIZED", "로그인이 필요합니다.", 401);
    }
    throw err;
  }

  const rankings = await getLeaderboard();

  return NextResponse.json({
    guilds: rankings,
    total: rankings.length,
  });
}
