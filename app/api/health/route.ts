// GET /api/health — DB 연결 확인

import { pingDb } from "@/lib/health.server";
import { route } from "@/lib/http/route";

export const dynamic = "force-dynamic";

export const GET = route({ auth: "public" }, async () => {
  try {
    await pingDb();
  } catch (error) {
    // 접속 정보가 섞일 수 있어 오류 내용은 응답에 넣지 않고 로그에만 남긴다
    console.error("[health] db check failed:", error);
    return Response.json(
      { status: "error", message: "database unreachable" },
      { status: 500 },
    );
  }

  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: process.env.VERCEL_ENV ?? "local",
  });
});
