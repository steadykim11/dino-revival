// 관리자 본인 공룡 강제 조정 (시연 컨트롤 — SC-13)
//
// - 본인(ctx.user.id)의 Dino만 수정
// - stage·totalCleanEnergy 각각 독립적으로 조작 가능 (둘 다 optional, 최소 하나는 필요)
// - 조정 규칙(역방향 전환, timestamp 정책)은 lib/dino/dino.server.ts의 adminAdjustDino 참조
// - Dino가 없는 사용자 (온보딩 미완료) → 404. 시연 컨트롤은 dino 있는 경우만 의미.

import { NextResponse } from "next/server";
import { z } from "zod";
import { DinoStage } from "@prisma/client";
import { withAdmin } from "@/lib/auth/admin";
import { adminAdjustDino } from "@/lib/dino/dino.server";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    stage: z.nativeEnum(DinoStage).optional(),
    totalCleanEnergy: z.number().int().min(0).max(100_000).optional(),
  })
  .refine((b) => b.stage !== undefined || b.totalCleanEnergy !== undefined, {
    message: "stage 또는 totalCleanEnergy 중 하나는 필요합니다.",
  });

export const PATCH = withAdmin(async ({ user }, req) => {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: "요청 본문이 올바르지 않습니다.",
          details: err instanceof z.ZodError ? err.flatten() : undefined,
        },
      },
      { status: 400 },
    );
  }

  const updated = await adminAdjustDino(user.id, {
    stage: body.stage,
    totalCleanEnergy: body.totalCleanEnergy,
  });
  if (!updated) {
    return NextResponse.json(
      { error: { code: "DINO_NOT_FOUND", message: "공룡이 없습니다." } },
      { status: 404 },
    );
  }

  console.log("[admin/dino]", {
    by: user.id,
    changes: {
      stage: body.stage,
      totalCleanEnergy: body.totalCleanEnergy,
    },
  });

  return NextResponse.json({
    dino: {
      id: updated.id,
      stage: updated.stage,
      totalCleanEnergy: updated.totalCleanEnergy,
      hatchedAt: updated.hatchedAt?.toISOString() ?? null,
      evolvedAt: updated.evolvedAt?.toISOString() ?? null,
    },
  });
});
