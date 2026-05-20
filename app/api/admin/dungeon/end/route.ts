// 관리자 수동 던전 종료
//
// - body 불필요 — "현재 활성 던전을 종료"가 의미
// - 활성 던전은 단일 보장(lifecycle), getCurrentActiveDungeon으로 찾아 endDungeon 호출.
// - 활성 던전이 없으면 200 + no-op (idempotent — 더블 클릭 안전).
// - 진행 중이던 던전 미션은 종료 후에도 당일 자정까지 완료 가능 (lifecycle.endDungeon 주석 참조).

import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import { endDungeon, getCurrentActiveDungeon } from "@/lib/dungeon/lifecycle";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async ({ user }) => {
  const active = await getCurrentActiveDungeon(prisma);
  if (!active) {
    return NextResponse.json({ ended: false, reason: "NO_ACTIVE_DUNGEON" });
  }

  const ended = await endDungeon(prisma, active.id);

  console.log("[admin/dungeon/end]", {
    dungeonId: active.id,
    by: user.id,
  });

  return NextResponse.json({
    ended: true,
    dungeon: ended
      ? {
          id: ended.id,
          endedAt: ended.endedAt?.toISOString() ?? null,
        }
      : null,
  });
});
