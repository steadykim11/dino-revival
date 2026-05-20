// 관리자 본인 공룡 강제 조정 (시연 컨트롤 — SC-13)
//
// - 본인(ctx.user.id)의 Dino만 수정
// - stage·totalCleanEnergy 각각 독립적으로 조작 가능 (둘 다 optional, 최소 하나는 필요)
// - applyEvolution을 의도적으로 우회 — evolution.ts는 단방향 전제(EGG→HATCHLING→ADULT).
//   역방향(ADULT→EGG 등)은 stage별 timestamp 분기를 인라인으로 처리.
//   timestamp 정책: "기존값 유지, null이면 now" — ADULT→HATCHLING→ADULT 왕복 시
//   evolvedAt이 첫 시점으로 고정되어 게임 이력처럼 보임 (시연 일관성).
// - Dino가 없는 사용자 (온보딩 미완료) → 404. 시연 컨트롤은 dino 있는 경우만 의미.

import { NextResponse } from "next/server";
import { z } from "zod";
import { DinoStage } from "@prisma/client";
import { withAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";

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

  const dino = await prisma.dino.findUnique({ where: { userId: user.id } });
  if (!dino) {
    return NextResponse.json(
      { error: { code: "DINO_NOT_FOUND", message: "공룡이 없습니다." } },
      { status: 404 },
    );
  }

  // stage별 timestamp 정책 — "기존값 유지, null이면 now"
  const now = new Date();
  const data: {
    stage?: DinoStage;
    totalCleanEnergy?: number;
    hatchedAt?: Date | null;
    evolvedAt?: Date | null;
  } = {};

  if (body.totalCleanEnergy !== undefined) {
    data.totalCleanEnergy = body.totalCleanEnergy;
  }

  if (body.stage !== undefined && body.stage !== dino.stage) {
    data.stage = body.stage;
    switch (body.stage) {
      case DinoStage.EGG:
        // 알로 되돌리기 — 두 timestamp 모두 클리어
        data.hatchedAt = null;
        data.evolvedAt = null;
        break;
      case DinoStage.HATCHLING:
        // 부화 완료, 진화 전 — hatchedAt 있어야, evolvedAt 없어야
        data.hatchedAt = dino.hatchedAt ?? now;
        data.evolvedAt = null;
        break;
      case DinoStage.ADULT:
        // 완전 진화 — 두 timestamp 모두 있어야
        data.hatchedAt = dino.hatchedAt ?? now;
        data.evolvedAt = dino.evolvedAt ?? now;
        break;
    }
  }

  const updated = await prisma.dino.update({
    where: { userId: user.id },
    data,
  });

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
