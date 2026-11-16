// User(프로필) 조회.

import { prisma } from "@/lib/prisma";

/** 프로필(User row) 등록 여부 */
export async function userExists(userId: string): Promise<boolean> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  return row !== null;
}

/** /api/me 응답용 — 프로필 + 길드 + 공룡 */
export async function getUserWithDinoAndGuild(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
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
}

/** 본인 식별 정보 + 소속 길드 표시명 */
export async function getUserGuildInfo(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nickname: true,
      guildId: true,
      guild: { select: { displayName: true } },
    },
  });
}

export type NicknameConflict = "SAME_AS_CURRENT" | "TAKEN";

/**
 * 닉네임 사용 가능 여부.
 * 본인의 현재 닉네임이면 SAME_AS_CURRENT, 다른 사용자가 쓰고 있으면 TAKEN, 가능하면 null.
 */
export async function checkNicknameConflict(
  userId: string,
  nickname: string,
): Promise<NicknameConflict | null> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { nickname: true },
  });
  if (me?.nickname === nickname) return "SAME_AS_CURRENT";

  const existing = await prisma.user.findUnique({
    where: { nickname },
    select: { id: true },
  });
  return existing ? "TAKEN" : null;
}
