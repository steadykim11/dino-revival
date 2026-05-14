// 가입 직후 프로필, 알 선택을 거치는 페이지 공통 레이아웃
//
// 가드:
// - 미인증 시 /signin으로 redirect
// - 이미 User row 있으면 / (메인) SC-03 재진입 방지

import { createServerSupabase } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true },
  });

  if (profile) {
    redirect("/");
  }

  return (
    <div className="min-h-dvh bg-stone-100">
      <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-6 py-12">
        {children}
      </div>
    </div>
  );
}
