// 세션 무효화 + 쿠키 제거(setAll이 처리)

import { createServerSupabase } from "@/lib/auth/supabase-server";
import { errorResponse } from "@/lib/types/api";

export async function POST() {
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return errorResponse(
      "SIGNOUT_FAILED",
      error.message ?? "로그아웃에 실패했습니다.",
      500,
    );
  }

  return Response.json({ ok: true });
}
