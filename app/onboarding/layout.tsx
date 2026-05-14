// 가입 직후 프로필, 알 선택을 거치는 페이지 공통 레이아웃
//
// 가드:
// - 미인증 시 /signin으로 redirect
// - User row + Dino row 둘 다 있으면 / (메인) - 온보딩 완료자 재진입 차단
// - 그 외 (User 없음 / User만 있고 Dino 없음) -> 온보딩 영역 유지
// onboarding 내부 페이지 간 이동은 페이지 자체에서 결정:
// - /onboarding (SC-03) : User row 없으면 폼 표시, 있으면 /onboarding/egg로 이동
// - /onboarding/egg (SC-04, D10) : Dino row 없으면 폼 표시

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
    select: { id: true, dino: { select: { id: true } }, },
  });

  // 온보딩 완료자(User + Dino 모두 있음)는 메인으로
  if (profile && profile.dino) {
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
