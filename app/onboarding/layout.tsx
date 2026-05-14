// 가입 직후 프로필, 알 선택을 거치는 페이지 공통 레이아웃
// 인증 필수, 미인증 시 /signin으로 redirect

import { createServerSupabase } from "@/lib/auth/supabase-server";
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

  return (
    <div className="min-h-dvh bg-stone-100">
      <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-6 py-12">
        {children}
      </div>
    </div>
  );
}
