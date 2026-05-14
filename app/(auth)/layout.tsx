// 비로그인 접근 페이지(가입, 로그인, 비밀번호 재설정) 공통 레이아웃
// 이미 로그인된 사용자는 메인으로 redirect (가입, 로그인 페이지 재진입 방지)

import { createServerSupabase } from "@/lib/auth/supabase-server";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
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
