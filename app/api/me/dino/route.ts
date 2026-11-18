// PUT /api/me/dino — 알 받기 (첫 생성). 이미 있으면 409 (한 사용자당 1마리).
//
// stage 정책:
//   - PUT 시 EGG로 생성. 사용자는 "알"을 받음.
//   - EGG → HATCHLING 진화는 클린에너지 100 도달 시 (D14 진화 시스템).
//     이 시점에 hatchedAt 기록.
//   - HATCHLING → ADULT 진화는 500 도달 시. evolvedAt 기록.
//
// 게임 진행에 따른 갱신(친밀도·클린에너지·진화)은 미션 완료 트랜잭션(lib/missions)이
// 처리한다. 이 엔드포인트를 통하지 않음.
// 관리자 패널의 강제 조정은 별도 /api/admin/dino (D19).

import { z } from "zod";
import { DinoSpecies } from "@prisma/client";
import { createDino } from "@/lib/dino/dino.server";
import { SPECIES_META } from "@/lib/dino/species";
import { errorResponse, route } from "@/lib/http/route";
import { NAME_PATTERN } from "@/lib/profile/name-rule";
import { userExists } from "@/lib/users/users.server";

const PutSchema = z.object({
  species: z.nativeEnum(DinoSpecies),
  name: z
    .string()
    .regex(NAME_PATTERN, "이름은 2~12자 한글·영문·숫자만 가능합니다."),
});

export const PUT = route(
  { auth: "user", body: PutSchema },
  async ({ user, body }) => {
    // User row가 있어야 Dino 생성 가능 (FK)
    if (!(await userExists(user.id))) {
      return errorResponse(
        "PROFILE_REQUIRED",
        "먼저 프로필 등록을 완료해주세요.",
        409,
      );
    }

    // 잠금된 species 차단
    const meta = SPECIES_META[body.species];
    if (!meta.isAvailable) {
      return errorResponse(
        "SPECIES_LOCKED",
        `${meta.displayName}는 ${meta.lockedReason ?? "선택할 수 없습니다."}.`,
        400,
      );
    }

    // 알 받기 = EGG 상태로 생성. 한 사용자 1마리 — 이미 있으면 null.
    const created = await createDino(user.id, {
      species: body.species,
      name: body.name.trim(),
    });
    if (!created) {
      return errorResponse(
        "DINO_ALREADY_EXISTS",
        "이미 공룡이 있습니다.",
        409,
      );
    }

    return Response.json(
      {
        id: created.id,
        name: created.name,
        species: created.species,
        stage: created.stage,
      },
      { status: 201 },
    );
  },
);
