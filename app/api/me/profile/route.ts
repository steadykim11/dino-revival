// PUT /api/me/profile — 첫 생성 + 갱신 통합.
//
// 첫 호출 (SC-03 온보딩):
//   - User row가 없으면 nickname·regionCode로 새로 생성
//   - 동네 길드 자동 합류 (guildId)
//
// 이후 호출 (SC-12 프로필 수정):
//   - 닉네임 변경 시 30일 쿨다운
//   - 동네 변경 시 90일 쿨다운
//   - 동네 변경 시 길드 재배치
//   - 변경된 필드만 시각(nicknameChangedAt, regionChangedAt) 갱신

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, UnauthorizedError } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/types/api";
import { isValidRegionCode } from "@/lib/static-data/regions";

const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]{2,12}$/;
const NICKNAME_COOLDOWN_DAYS = 30;
const REGION_COOLDOWN_DAYS = 90;

const ProfileSchema = z.object({
  nickname: z
    .string()
    .regex(NICKNAME_REGEX, "닉네임은 2~12자 한글·영문·숫자만 가능합니다."),
  regionCode: z
    .string()
    .length(5, "올바른 동네 코드가 아닙니다.")
    .refine(isValidRegionCode, "지원하지 않는 동네입니다."),
});

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return ms / (1000 * 60 * 60 * 24);
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "요청 본문이 올바르지 않습니다.", 400);
  }

  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "입력값이 올바르지 않습니다.",
      400,
      parsed.error.flatten().fieldErrors,
    );
  }

  const { nickname, regionCode } = parsed.data;
  const now = new Date();

  // 기존 User row가 있는지 확인
  const existing = await prisma.user.findUnique({
    where: { id: ctx.user.id },
  });

  // 길드 조회 (regionCode → guildId)
  const guild = await prisma.guild.findUnique({
    where: { regionCode },
    select: { id: true },
  });
  if (!guild) {
    // SoT가 일치하지 않는 경우 — 길드 시드가 빠진 정합성 오류
    return errorResponse(
      "GUILD_NOT_FOUND",
      "해당 동네의 길드를 찾을 수 없습니다.",
      500,
    );
  }

  if (!existing) {
    // 첫 생성
    // 닉네임 중복 검사 (race condition 방지를 위해 트랜잭션은 unique 제약에 위임)
    try {
      const created = await prisma.user.create({
        data: {
          id: ctx.user.id,
          nickname,
          regionCode,
          guildId: guild.id,
          // 첫 생성이므로 changedAt은 NULL 유지 (즉시 변경 안 됐다는 의미)
        },
      });
      return Response.json(
        {
          id: created.id,
          nickname: created.nickname,
          regionCode: created.regionCode,
          guildId: created.guildId,
        },
        { status: 201 },
      );
    } catch (err) {
      // Prisma unique 제약 조건
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        err.code === "P2002"
      ) {
        return errorResponse(
          "NICKNAME_TAKEN",
          "이미 사용 중인 닉네임입니다.",
          409,
        );
      }
      throw err;
    }
  }

  // 갱신
  const updates: {
    nickname?: string;
    nicknameChangedAt?: Date;
    regionCode?: string;
    guildId?: string;
    regionChangedAt?: Date;
  } = {};

  // 닉네임 변경 처리
  if (existing.nickname !== nickname) {
    if (
      existing.nicknameChangedAt &&
      daysBetween(existing.nicknameChangedAt, now) < NICKNAME_COOLDOWN_DAYS
    ) {
      const remainingDays = Math.ceil(
        NICKNAME_COOLDOWN_DAYS - daysBetween(existing.nicknameChangedAt, now),
      );
      return errorResponse(
        "NICKNAME_COOLDOWN",
        `닉네임 변경은 ${NICKNAME_COOLDOWN_DAYS}일에 한 번 가능합니다. ${remainingDays}일 후 다시 시도해주세요.`,
        409,
      );
    }
    updates.nickname = nickname;
    updates.nicknameChangedAt = now;
  }

  // 동네 변경 처리
  if (existing.regionCode !== regionCode) {
    if (
      existing.regionChangedAt &&
      daysBetween(existing.regionChangedAt, now) < REGION_COOLDOWN_DAYS
    ) {
      const remainingDays = Math.ceil(
        REGION_COOLDOWN_DAYS - daysBetween(existing.regionChangedAt, now),
      );
      return errorResponse(
        "REGION_COOLDOWN",
        `동네 변경은 ${REGION_COOLDOWN_DAYS}일에 한 번 가능합니다. ${remainingDays}일 후 다시 시도해주세요.`,
        409,
      );
    }
    updates.regionCode = regionCode;
    updates.guildId = guild.id;
    updates.regionChangedAt = now;
    // 정책: 동네 변경 시 클린에너지 누적값은 그대로 유지 (요약본 운영 정책)
  }

  if (Object.keys(updates).length === 0) {
    // 변경 사항 없음 — 200으로 현재 상태 반환
    return Response.json({
      id: existing.id,
      nickname: existing.nickname,
      regionCode: existing.regionCode,
      guildId: existing.guildId,
    });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: ctx.user.id },
      data: updates,
    });
    return Response.json({
      id: updated.id,
      nickname: updated.nickname,
      regionCode: updated.regionCode,
      guildId: updated.guildId,
    });
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      err.code === "P2002"
    ) {
      return errorResponse(
        "NICKNAME_TAKEN",
        "이미 사용 중인 닉네임입니다.",
        409,
      );
    }
    throw err;
  }
}
