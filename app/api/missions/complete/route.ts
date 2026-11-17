// 미션 완료 처리
// POST { missionId } → 보상 내역·진화 여부 반환.
//
// 응답 ok:
//   { missionLogId, reward, co2ReducedKg, evolved, dino }
// 응답 fail:
//   { error: { code, message } } — code: MISSION_NOT_FOUND | ALREADY_COMPLETED | EXPIRED | ...

import { z } from "zod";
import { errorResponse, route } from "@/lib/http/route";
import {
  completeMission,
  type CompleteFailReason,
} from "@/lib/missions/completer.server";

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

export const POST = route(
  { auth: "user", body: PostSchema },
  async ({ user, body }) => {
    const result = await completeMission(user.id, body.missionId);

    if (!result.ok) {
      return errorResponse(
        result.reason,
        ERROR_MESSAGES[result.reason],
        ERROR_HTTP_STATUS[result.reason],
      );
    }

    return Response.json({
      missionLogId: result.missionLogId,
      reward: result.reward,
      co2ReducedKg: result.co2ReducedKg,
      evolved: result.evolved,
      dino: result.dino,
    });
  },
);
