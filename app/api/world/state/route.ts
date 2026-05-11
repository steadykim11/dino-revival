// app/api/world/state/route.ts
import { NextResponse } from "next/server";
import { readWorldState } from "@/lib/world/snapshot-reader";

export const dynamic = "force-dynamic";

const CACHE_HEADER = "public, max-age=5, s-maxage=5, stale-while-revalidate=10";

export async function GET() {
  const state = await readWorldState();

  if (!state) {
    return NextResponse.json(
      {
        error: {
          code: "EXTERNAL_API_DOWN",
          message:
            "전력 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.",
        },
      },
      { status: 503 },
    );
  }

  return NextResponse.json(state, {
    headers: { "Cache-Control": CACHE_HEADER },
  });
}
