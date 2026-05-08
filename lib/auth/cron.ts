import { NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Vercel Cron 호출 인증
 * Vercel은 자동으로 Authorization: Bearer ${CRON_SECRET} 헤더를 붙여줌
 * 로컬 테스트 시엔 직접 헤더 설정 필요
 */
export function isAuthorizedCron(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${env.CRON_SECRET}`;
}

export function unauthorizedResponse() {
  return new Response("Unauthorized", { status: 401 });
}
