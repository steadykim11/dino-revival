// 관리자 일일 미션 재발급 (시연 컨트롤 — SC-13)
//
// - "오늘 발급된 DAILY 미션을 모두 삭제하고 다시 발급" — 시연 시점에 미션 풀이
//   상황에 안 맞을 때(예: 던전 미발령 상태에서 던전 미션 잔존, 카테고리 다양성
//   부족 등) 빠르게 갱신하기 위한 컨트롤.
// - 본인(ctx.user.id) 대상으로만. 와이어프레임 "오늘 미션 재생성" 그대로.
// - 던전 미션(type=DUNGEON)은 명시적 제외 — 던전 진행 중인 사용자 보호.
//   던전 재발급이 필요하면 trigger/end 버튼을 별도로 사용.
// - 완료된 미션은 미션 자체만 삭제, MissionLog는 보존 (영구 이력 정책).
//   스키마상 MissionLog.missionId는 FK가 아닌 단순 컬럼이라 안전.
// - issueDailyMissions는 idempotent (오늘자 3개 있으면 skip) → 선삭제가 필수.

import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import { issueDailyMissions } from "@/lib/missions/daily-issuer";
import { toKstDateString } from "@/lib/time/kst";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async ({ user }, _req) => {
  const now = new Date();
  const todayKst = toKstDateString(now);
  const assignedDate = new Date(`${todayKst}T00:00:00.000Z`);

  // 1) 오늘자 DAILY 미션 삭제 (DUNGEON 제외)
  const deleted = await prisma.mission.deleteMany({
    where: {
      userId: user.id,
      assignedDate,
      type: "DAILY",
    },
  });

  // 2) 재발급
  const result = await issueDailyMissions(prisma, user.id, now);

  console.log("[admin/missions/regenerate]", {
    by: user.id,
    deleted: deleted.count,
    issueStatus: result.status,
    issued: result.missionIds?.length ?? 0,
  });

  if (result.status === "failed") {
    return NextResponse.json(
      {
        deleted: deleted.count,
        regenerated: false,
        error: result.error,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    deleted: deleted.count,
    regenerated: true,
    issueStatus: result.status,
    missionIds: result.missionIds ?? [],
  });
});
