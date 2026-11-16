// 관리자 일일 미션 재발급 (시연 컨트롤 — SC-13)
//
// - "오늘 발급된 DAILY 미션을 모두 삭제하고 다시 발급" — 시연 시점에 미션 구성이
//   상황에 안 맞을 때 빠르게 갱신하기 위한 컨트롤.
// - 본인(ctx.user.id) 대상으로만. 와이어프레임 "오늘 미션 재생성" 그대로.
// - 삭제·재발급 규칙은 lib/missions/missions.server.ts의 regenerateDailyMissions 참조.

import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/admin";
import { regenerateDailyMissions } from "@/lib/missions/missions.server";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async ({ user }, _req) => {
  const { deletedCount, result } = await regenerateDailyMissions(user.id);

  console.log("[admin/missions/regenerate]", {
    by: user.id,
    deleted: deletedCount,
    issueStatus: result.status,
    issued: result.missionIds?.length ?? 0,
  });

  if (result.status === "failed") {
    return NextResponse.json(
      {
        deleted: deletedCount,
        regenerated: false,
        error: result.error,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    deleted: deletedCount,
    regenerated: true,
    issueStatus: result.status,
    missionIds: result.missionIds ?? [],
  });
});
