// 페이지·레이아웃용 세션 헬퍼.
//
// React cache()로 감싸 한 요청 안에서는 Supabase Auth 호출과 프로필 조회가
// 한 번만 일어난다 (레이아웃과 페이지가 각각 불러도 중복되지 않음).
//
// Route Handler는 lib/auth/require-user.ts의 requireUser를 쓴다.

import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createServerSupabase } from "./supabase-server";

/** 인증된 Supabase 사용자. 미인증이면 null. */
export const getAuthUser = cache(async () => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export interface SessionProfile {
  id: string;
  nickname: string;
  guildId: string | null;
  hasDino: boolean;
}

export interface Session {
  userId: string;
  /** 프로필(User row) 등록 전이면 null */
  profile: SessionProfile | null;
}

/** 현재 요청의 세션. 미인증이면 null. */
export const getSession = cache(async (): Promise<Session | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      nickname: true,
      guildId: true,
      dino: { select: { id: true } },
    },
  });

  return {
    userId: user.id,
    profile: row
      ? {
          id: row.id,
          nickname: row.nickname,
          guildId: row.guildId,
          hasDino: row.dino !== null,
        }
      : null,
  };
});

/**
 * 온보딩까지 마친 사용자만 통과시킨다. (main) 영역의 레이아웃·페이지용.
 *
 * - 미인증 → /landing
 * - 프로필 없음 → /onboarding
 * - 공룡 없음 → /onboarding/egg
 */
export async function requireSession(): Promise<SessionProfile> {
  const session = await getSession();
  if (!session) redirect("/landing");
  if (!session.profile) redirect("/onboarding");
  if (!session.profile.hasDino) redirect("/onboarding/egg");
  return session.profile;
}
