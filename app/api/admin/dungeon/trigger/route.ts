// 관리자 수동 던전 발령
//
// - reason은 항상 "manual" 고정 (자동은 cron stub)
// - 메트릭(예비율·탄소강도)은 호출 시점의 최신 WorldSnapshot에서 자동 추출.
//   감사용 기록일 뿐, 발령 자체는 메트릭과 무관 (관리자가 의도적으로 누름).
// - lifecycle.activateDungeon이 idempotent 보장 — 이미 활성이면 그걸 반환.
// - 발령 성공 시 issueDungeonMissions 즉시 호출 (활성 사용자에게 일괄 발급).

import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import { activateDungeon } from "@/lib/dungeon/lifecycle";
import { issueDungeonMissions } from "@/lib/dungeon/missions";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async ({ user }, _req) => {
  // 1) 메트릭 추출 (최신 snapshot, 없으면 null로 발령 계속)
  const snapshot = await prisma.worldSnapshot.findFirst({
    orderBy: { ts: "desc" },
    select: { supplyReserveRate: true, carbonIntensity: true },
  });

  // 2) 발령
  const { dungeon, created } = await activateDungeon(prisma, {
    reason: "manual",
    triggerReserveRate: snapshot ? Number(snapshot.supplyReserveRate) : null,
    triggerCarbonIntensity: snapshot ? Number(snapshot.carbonIntensity) : null,
  });

  // 3) 미션 발급 — 새로 생성된 경우에만 (idempotent: 이미 활성이면 미션도 이미 발급됨)
  let issued = 0;
  if (created) {
    issued = await issueDungeonMissions(prisma, dungeon.id);
  }

  console.log("[admin/dungeon/trigger]", {
    dungeonId: dungeon.id,
    created,
    issued,
    by: user.id,
  });

  return NextResponse.json({
    dungeon: {
      id: dungeon.id,
      activatedAt: dungeon.activatedAt.toISOString(),
      expiresAt: dungeon.expiresAt.toISOString(),
    },
    created,
    issuedMissions: issued,
  });
});
