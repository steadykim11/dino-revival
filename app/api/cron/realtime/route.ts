import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron, unauthorizedResponse } from "@/lib/auth/cron";
import { captureWorldSnapshot } from "@/lib/world/snapshot-writer";
import { monitorDungeon } from "@/lib/dungeon/monitor";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Pro 한도 60s 내. KPX 호출 + UPSERT는 보통 5초 미만.

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return unauthorizedResponse();

  const startedAt = Date.now();
  const result = await captureWorldSnapshot();
  const elapsedMs = Date.now() - startedAt;

  // 던전 모니터링 (D18)
  // - 만료된 활성 던전 청소 (sweep)
  // - 예비율 < 10%면 자동 발령 + 미션 발급
  // - 정책: ADR 19, 결정 3-B에 따라 vercel.json schedule 활성화는 보류.
  //   다만 기존 realtime cron이 5분마다 도는 흐름에 얹는 거라 비용은 0.
  //   실제 자동 트리거 발생 확률은 시연 토이 범위에서 거의 0이지만 만료 sweep은 가치 있음.
  const dungeonResult = await monitorDungeon().catch((err) => {
    console.error("[cron/realtime] dungeon monitor failed:", err);
    return { swept: 0, triggered: false, reason: "ERROR" as const };
  });

  console.log("[cron/realtime]", {
    result: result.kind,
    dungeon: dungeonResult,
    elapsedMs,
    ...(result.kind === "success" && {
      ts: result.ts.toISOString(),
      carbonIntensity: result.carbonIntensity,
    }),
    ...(result.kind === "fallback" && {
      reason: result.reason,
      lastTs: result.lastTs?.toISOString() ?? null,
    }),
  });

  return NextResponse.json({
    ok: result.kind !== "failed",
    result,
    elapsedMs,
  });
}
