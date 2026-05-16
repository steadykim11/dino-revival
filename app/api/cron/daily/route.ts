// 매일 KST 자정(UTC 15:00) Vercel Cron 트리거
//
// 알을 받은 모든 사용자에게 오늘자 미션 3개 발급 (사용자별 commit)
// TODO D15: dummy-activity (자정+5분 더미 활동 시뮬레이션)
// TODO D24: cleanup-snapshots (주간, 7일 이상 된 데이터 정리)

import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron, unauthorizedResponse } from "@/lib/auth/cron";
import { prisma } from "@/lib/prisma";
import { issueDailyMissions } from "@/lib/missions/daily-issuer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return unauthorizedResponse();

  const startedAt = Date.now();
  const now = new Date();

  // 미션 발급 대상: 알을 받은 사용자 (Dino 존재). 더미 포함.
  const users = await prisma.user.findMany({
    where: { dino: { isNot: null } },
    select: { id: true },
  });

  const results = { issued: 0, skipped: 0, failed: 0 };
  const failures: { userId: string; error?: string }[] = [];

  for (const u of users) {
    const r = await issueDailyMissions(prisma, u.id, now);
    results[r.status]++;
    if (r.status === "failed") failures.push({ userId: u.id, error: r.error });
  }

  const elapsedMs = Date.now() - startedAt;
  console.log("[cron/daily]", {
    totalUsers: users.length,
    ...results,
    elapsedMs,
  });
  if (failures.length > 0) {
    console.warn("[cron/daily] failures (first 10):", failures.slice(0, 10));
  }

  return NextResponse.json({
    ok: true,
    totalUsers: users.length,
    ...results,
    elapsedMs,
  });
}
