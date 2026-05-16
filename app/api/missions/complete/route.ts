// 미션 완료 처리
// POST { missionId } → 보상 내역·진화 여부 반환.
//
// 응답 ok:
//   { reward, co2ReducedKg, evolved, dino }
// 응답 fail:
//   { error: { code, message } } — code: MISSION_NOT_FOUND | ALREADY_COMPLETED | EXPIRED | ...

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, UnauthorizedError } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/types/api";
import {
  completeMission,
  type CompleteFailReason,
} from "@/lib/missions/completer";

const PostSchema = z.object({
  missionId: z.string().uuid(),
});

const ERROR_HTTP_STATUS: Record<CompleteFailReason, number> = {
  MISSION_NOT_FOUND: 404,
  ALREADY_COMPLETED: 409,
  EXPIRED: 410,
  DINO_NOT_FOUND: 409,
  NO_WORLD_SNAPSHOT: 503,
};

const ERROR_MESSAGES: Record<CompleteFailReason, string> = {
  MISSION_NOT_FOUND: "미션을 찾을 수 없습니다.",
  ALREADY_COMPLETED: "이미 완료된 미션입니다.",
  EXPIRED: "만료된 미션입니다.",
  DINO_NOT_FOUND: "공룡이 없습니다. 먼저 알을 받아주세요.",
  NO_WORLD_SNAPSHOT:
    "월드 상태를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.",
};

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return errorResponse("UNAUTHORIZED", "로그인이 필요합니다.", 401);
    }
    throw err;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "요청 본문이 올바르지 않습니다.", 400);
  }

  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "입력값이 올바르지 않습니다.",
      400,
      parsed.error.flatten().fieldErrors,
    );
  }

  const result = await completeMission(
    prisma,
    ctx.user.id,
    parsed.data.missionId,
  );

  if (!result.ok) {
    return errorResponse(
      result.reason,
      ERROR_MESSAGES[result.reason],
      ERROR_HTTP_STATUS[result.reason],
    );
  }

  return Response.json({
    reward: result.reward,
    co2ReducedKg: result.co2ReducedKg,
    evolved: result.evolved,
    dino: result.dino,
  });
}
