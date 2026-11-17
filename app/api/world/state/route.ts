// GET /api/world/state — 월드 상태 (Public, 짧은 HTTP 캐시 — ADR 5)

import { errorResponse, route } from "@/lib/http/route";
import { readWorldState } from "@/lib/world/snapshot-reader.server";

export const dynamic = "force-dynamic";

const CACHE_HEADER = "public, max-age=5, s-maxage=5, stale-while-revalidate=10";

export const GET = route({ auth: "public" }, async () => {
  const state = await readWorldState();

  if (!state) {
    return errorResponse(
      "EXTERNAL_API_DOWN",
      "전력 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.",
      503,
    );
  }

  return Response.json(state, {
    headers: { "Cache-Control": CACHE_HEADER },
  });
});
