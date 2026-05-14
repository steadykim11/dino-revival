// 비밀번호 재설정 메일 발송
// 시연 시나리오에는 포함되지 않았기 때문에 최소 구현(메일 발송만 트리거, 실제 리셋x)

import { createServerSupabase } from "@/lib/auth/supabase-server";
import { errorResponse } from "@/lib/types/api";
import { NextRequest } from "next/server";
import { z } from "zod";

const ResetSchema = z.object({
  email: z.email("올바른 이메일 형식이 아닙니다."),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "요청 본문이 올바르지 않습니다.", 400);
  }

  const parsed = ResetSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "입력값이 올바르지 않습니다.",
      400,
      parsed.error.flatten().fieldErrors,
    );
  }

  const supabase = await createServerSupabase();
  // 존재하지 않는 이메일에도 동일 응답 반환(이메일 enumeration 방지)
  await supabase.auth.resetPasswordForEmail(parsed.data.email);

  return Response.json({
    message: "재설정 메일을 발송했습니다. 메일함을 확인해주세요.",
  });
}
