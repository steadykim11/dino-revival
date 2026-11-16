// 프로필 생성·갱신 (PUT /api/me/profile).
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
//   - 동네를 바꿔도 클린에너지 누적값은 유지 (요약본 운영 정책)

import { prisma } from "@/lib/prisma";
import { NICKNAME_COOLDOWN_DAYS, REGION_COOLDOWN_DAYS } from "./cooldown";

export interface ProfileView {
  id: string;
  nickname: string;
  regionCode: string;
  guildId: string | null;
}

export type SaveProfileResult =
  | { kind: "created" | "updated" | "unchanged"; profile: ProfileView }
  | { kind: "GUILD_NOT_FOUND" }
  | { kind: "NICKNAME_TAKEN" }
  | { kind: "NICKNAME_COOLDOWN"; cooldownDays: number; remainingDays: number }
  | { kind: "REGION_COOLDOWN"; cooldownDays: number; remainingDays: number };

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
}

/** Prisma unique 제약 위반 (닉네임 중복) */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "P2002"
  );
}

function toView(u: ProfileView): ProfileView {
  return {
    id: u.id,
    nickname: u.nickname,
    regionCode: u.regionCode,
    guildId: u.guildId,
  };
}

export async function saveProfile(
  userId: string,
  input: { nickname: string; regionCode: string },
  now: Date = new Date(),
): Promise<SaveProfileResult> {
  const { nickname, regionCode } = input;

  const existing = await prisma.user.findUnique({ where: { id: userId } });

  // 길드 조회 (regionCode → guildId)
  const guild = await prisma.guild.findUnique({
    where: { regionCode },
    select: { id: true },
  });
  if (!guild) {
    // SoT가 일치하지 않는 경우 — 길드 시드가 빠진 정합성 오류
    return { kind: "GUILD_NOT_FOUND" };
  }

  if (!existing) {
    // 첫 생성. 닉네임 중복은 unique 제약에 위임 (race 방지).
    // changedAt은 NULL 유지 — 아직 변경한 적 없다는 의미.
    try {
      const created = await prisma.user.create({
        data: { id: userId, nickname, regionCode, guildId: guild.id },
      });
      return { kind: "created", profile: toView(created) };
    } catch (err) {
      if (isUniqueViolation(err)) return { kind: "NICKNAME_TAKEN" };
      throw err;
    }
  }

  const updates: {
    nickname?: string;
    nicknameChangedAt?: Date;
    regionCode?: string;
    guildId?: string;
    regionChangedAt?: Date;
  } = {};

  if (existing.nickname !== nickname) {
    if (existing.nicknameChangedAt) {
      const elapsed = daysBetween(existing.nicknameChangedAt, now);
      if (elapsed < NICKNAME_COOLDOWN_DAYS) {
        return {
          kind: "NICKNAME_COOLDOWN",
          cooldownDays: NICKNAME_COOLDOWN_DAYS,
          remainingDays: Math.ceil(NICKNAME_COOLDOWN_DAYS - elapsed),
        };
      }
    }
    updates.nickname = nickname;
    updates.nicknameChangedAt = now;
  }

  if (existing.regionCode !== regionCode) {
    if (existing.regionChangedAt) {
      const elapsed = daysBetween(existing.regionChangedAt, now);
      if (elapsed < REGION_COOLDOWN_DAYS) {
        return {
          kind: "REGION_COOLDOWN",
          cooldownDays: REGION_COOLDOWN_DAYS,
          remainingDays: Math.ceil(REGION_COOLDOWN_DAYS - elapsed),
        };
      }
    }
    updates.regionCode = regionCode;
    updates.guildId = guild.id;
    updates.regionChangedAt = now;
  }

  if (Object.keys(updates).length === 0) {
    return { kind: "unchanged", profile: toView(existing) };
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: updates,
    });
    return { kind: "updated", profile: toView(updated) };
  } catch (err) {
    if (isUniqueViolation(err)) return { kind: "NICKNAME_TAKEN" };
    throw err;
  }
}
