// 비밀번호 재설정 메일 발송
// 시연 시나리오에는 포함되지 않았기 때문에 최소 구현(메일 발송만 트리거, 실제 리셋x)

import { z } from "zod";
import { createServerSupabase } from "@/lib/auth/supabase-server";
import { route } from "@/lib/http/route";

const ResetSchema = z.object({
  email: z.email("올바른 이메일 형식이 아닙니다."),
});

export const POST = route(
  { auth: "public", body: ResetSchema },
  async ({ body }) => {
    const supabase = await createServerSupabase();
    // 존재하지 않는 이메일에도 동일 응답 반환(이메일 enumeration 방지)
    await supabase.auth.resetPasswordForEmail(body.email);

    return Response.json({
      message: "재설정 메일을 발송했습니다. 메일함을 확인해주세요.",
    });
  },
);
