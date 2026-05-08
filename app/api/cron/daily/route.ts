import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron, unauthorizedResponse } from "@/lib/auth/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return unauthorizedResponse();

  console.log("[cron/daily] tick", new Date().toISOString());

  // TODO D11: daily-missions (사용자별 미션 3개 자동 선정)
  // TODO D15: dummy-activity (자정+5분 더미 활동 시뮬레이션)
  // TODO D24: cleanup-snapshots (주간, 7일 이상 된 데이터 정리)

  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
