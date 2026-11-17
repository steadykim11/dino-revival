// PUT /api/me/profile — 첫 생성 + 갱신 통합.
//
// 생성·갱신 규칙(길드 합류, 쿨다운)은 lib/profile/profile.server.ts의 saveProfile 참조.

import { z } from "zod";
import { errorResponse, route } from "@/lib/http/route";
import { saveProfile } from "@/lib/profile/profile.server";
import { isValidRegionCode } from "@/lib/static-data/regions";

const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]{2,12}$/;

const ProfileSchema = z.object({
  nickname: z
    .string()
    .regex(NICKNAME_REGEX, "닉네임은 2~12자 한글·영문·숫자만 가능합니다."),
  regionCode: z
    .string()
    .length(5, "올바른 동네 코드가 아닙니다.")
    .refine(isValidRegionCode, "지원하지 않는 동네입니다."),
});

export const PUT = route(
  { auth: "user", body: ProfileSchema },
  async ({ user, body }) => {
    const result = await saveProfile(user.id, body);

    switch (result.kind) {
      case "created":
        return Response.json(result.profile, { status: 201 });
      case "updated":
      case "unchanged":
        return Response.json(result.profile);
      case "GUILD_NOT_FOUND":
        return errorResponse(
          "GUILD_NOT_FOUND",
          "해당 동네의 길드를 찾을 수 없습니다.",
          500,
        );
      case "NICKNAME_TAKEN":
        return errorResponse(
          "NICKNAME_TAKEN",
          "이미 사용 중인 닉네임입니다.",
          409,
        );
      case "NICKNAME_COOLDOWN":
        return errorResponse(
          "NICKNAME_COOLDOWN",
          `닉네임 변경은 ${result.cooldownDays}일에 한 번 가능합니다. ${result.remainingDays}일 후 다시 시도해주세요.`,
          409,
        );
      case "REGION_COOLDOWN":
        return errorResponse(
          "REGION_COOLDOWN",
          `동네 변경은 ${result.cooldownDays}일에 한 번 가능합니다. ${result.remainingDays}일 후 다시 시도해주세요.`,
          409,
        );
    }
  },
);
