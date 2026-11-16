// 공룡 정보 조회·생성.
//
// GET: 사용자의 Dino row 반환. 없으면 null.
// PUT: 첫 부화. 이미 있으면 409 (한 사용자당 1마리).
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

import { NextRequest } from "next/server";
import { z } from "zod";
import { DinoSpecies } from "@prisma/client";
import { requireUser, UnauthorizedError } from "@/lib/auth/require-user";
import { createDino, getDino } from "@/lib/dino/dino.server";
import { userExists } from "@/lib/users/users.server";
import { errorResponse } from "@/lib/types/api";
import { SPECIES_META } from "@/lib/dino/species";

// 이름 규칙: 닉네임과 동일 (2~12자, 한글·영문·숫자)
const DINO_NAME_REGEX = /^[가-힣a-zA-Z0-9]{2,12}$/;

const PutSchema = z.object({
  species: z.nativeEnum(DinoSpecies),
  name: z
    .string()
    .regex(DINO_NAME_REGEX, "이름은 2~12자 한글·영문·숫자만 가능합니다."),
});

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

  const dino = await getDino(ctx.user.id);

  return Response.json({ dino });
}

export async function PUT(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return errorResponse("UNAUTHORIZED", "로그인이 필요합니다.", 401);
    }
    throw err;
  }

  // User row가 있어야 Dino 생성 가능 (FK)
  if (!(await userExists(ctx.user.id))) {
    return errorResponse(
      "PROFILE_REQUIRED",
      "먼저 프로필 등록을 완료해주세요.",
      409,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "요청 본문이 올바르지 않습니다.", 400);
  }

  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "입력값이 올바르지 않습니다.",
      400,
      parsed.error.flatten().fieldErrors,
    );
  }

  // 잠금된 species 차단
  const meta = SPECIES_META[parsed.data.species];
  if (!meta.isAvailable) {
    return errorResponse(
      "SPECIES_LOCKED",
      `${meta.displayName}는 ${meta.lockedReason ?? "선택할 수 없습니다."}.`,
      400,
    );
  }

  // 알 받기 = EGG 상태로 생성. 한 사용자 1마리 — 이미 있으면 null.
  const created = await createDino(ctx.user.id, {
    species: parsed.data.species,
    name: parsed.data.name.trim(),
  });
  if (!created) {
    return errorResponse("DINO_ALREADY_EXISTS", "이미 공룡이 있습니다.", 409);
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
}
