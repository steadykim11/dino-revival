import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron, unauthorizedResponse } from "@/lib/auth/cron";
import { captureWorldSnapshot } from "@/lib/world/snapshot-writer";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // Pro 한도 60s 내. KPX 호출 + UPSERT는 보통 5초 미만.

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return unauthorizedResponse();

  const startedAt = Date.now();
  const result = await captureWorldSnapshot();
  const elapsedMs = Date.now() - startedAt;

  // TODO D6: forecast-update (매시 정각에만)
  // TODO D18: dungeon-monitor (예비율 < 10% 자동 트리거 + 60분 만료 체크)

  console.log("[cron/realtime]", {
    result: result.kind,
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
