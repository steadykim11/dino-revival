// 관리자 수동 던전 종료
//
// - body 불필요 — "현재 활성 던전을 종료"가 의미
// - 활성 던전이 없으면 200 + no-op (idempotent — 더블 클릭 안전).
// - 진행 중이던 던전 미션은 종료 후에도 당일 자정까지 완료 가능 (lifecycle의 endDungeon 주석 참조).

import { endActiveDungeon } from "@/lib/dungeon/lifecycle.server";
import { route } from "@/lib/http/route";

export const dynamic = "force-dynamic";

export const POST = route({ auth: "admin" }, async ({ user }) => {
  const ended = await endActiveDungeon();
  if (!ended) {
    return Response.json({ ended: false, reason: "NO_ACTIVE_DUNGEON" });
  }

  console.log("[admin/dungeon/end]", {
    dungeonId: ended.id,
    by: user.id,
  });

  return Response.json({
    ended: true,
    dungeon: {
      id: ended.id,
      endedAt: ended.endedAt?.toISOString() ?? null,
    },
  });
});
