// GET /api/me — 현재 사용자의 통합 정보 조회.
// 라우팅 분기에 활용:
//   - profile === null → /onboarding (SC-03 미완)
//   - dino === null → /onboarding/egg (SC-04 미완, D10)
//   - 둘 다 있음 → / (메인)

import { requireUser, UnauthorizedError } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/types/api";

export async function GET() {
  let ctx;
  try {
    ctx = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return errorResponse("UNAUTHORIZED", "로그인이 필요합니다.", 401);
    }
    throw err;
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.user.id },
    include: {
      dino: true,
      guild: {
        select: {
          id: true,
          regionCode: true,
          displayName: true,
        },
      },
    },
  });

  return Response.json({
    auth: {
      id: ctx.user.id,
      email: ctx.user.email,
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
}
