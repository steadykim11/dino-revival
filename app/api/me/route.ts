// GET /api/me — 현재 사용자의 통합 정보 조회.
// 라우팅 분기에 활용:
//   - profile === null → /onboarding (SC-03 미완)
//   - dino === null → /onboarding/egg (SC-04 미완, D10)
//   - 둘 다 있음 → / (메인)

import { route } from "@/lib/http/route";
import { getUserWithDinoAndGuild } from "@/lib/users/users.server";

export const GET = route({ auth: "user" }, async ({ user: authUser }) => {
  const user = await getUserWithDinoAndGuild(authUser.id);

  return Response.json({
    auth: {
      id: authUser.id,
      email: authUser.email,
    },
    profile: user
      ? {
          id: user.id,
          nickname: user.nickname,
          regionCode: user.regionCode,
          createdAt: user.createdAt,
          nicknameChangedAt: user.nicknameChangedAt,
          regionChangedAt: user.regionChangedAt,
        }
      : null,
    guild: user?.guild ?? null,
    dino: user?.dino
      ? {
          id: user.dino.id,
          species: user.dino.species,
          stage: user.dino.stage,
          totalCleanEnergy: user.dino.totalCleanEnergy,
          intimacy: user.dino.intimacy,
        }
      : null,
  });
});
