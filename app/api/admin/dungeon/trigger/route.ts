// 관리자 수동 던전 발령
//
// - reason은 항상 "manual". 자동 발령은 수집 작업의 던전 모니터가 담당.
// - 발령 규칙(메트릭 기록, idempotent, 미션 발급)은
//   lib/dungeon/monitor.server.ts의 triggerDungeonManually 참조.

import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/admin";
import { triggerDungeonManually } from "@/lib/dungeon/monitor.server";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async ({ user }, _req) => {
  const { dungeon, created, issuedMissions } = await triggerDungeonManually();

  console.log("[admin/dungeon/trigger]", {
    dungeonId: dungeon.id,
    created,
    issued: issuedMissions,
    by: user.id,
  });

  return NextResponse.json({
    dungeon: {
      id: dungeon.id,
      activatedAt: dungeon.activatedAt.toISOString(),
      expiresAt: dungeon.expiresAt.toISOString(),
    },
    created,
    issuedMissions,
  });
});
