// 가입. auth.users에만 row를 만든다 — User 테이블 row는 SC-03 프로필 등록에서 생성.

import { z } from "zod";
import { createServerSupabase } from "@/lib/auth/supabase-server";
import { errorResponse, route } from "@/lib/http/route";

const SignupSchema = z.object({
  email: z.email("올바른 이메일 형식이 아닙니다."),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다.")
    .regex(/[a-zA-Z]/, "비밀번호는 영문을 포함해야 합니다.")
    .regex(/[0-9]/, "비밀번호는 숫자를 포함해야 합니다."),
});

export const POST = route(
  { auth: "public", body: SignupSchema },
  async ({ body }) => {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
    });

    if (error) {
      // supabase 에러 코드 매핑
      if (error.code === "user_already_exists" || error.status === 422) {
        return errorResponse(
          "EMAIL_ALREADY_EXISTS",
          "이미 사용중인 이메일입니다.",
          409,
        );
      }
      return errorResponse(
        "SIGNUP_FAILED",
        error.message ?? "가입에 실패했습니다.",
        error.status ?? 500,
      );
    }

    // supabase 설정에서 Confirm email을 off로 뒀으므로 session 즉시 반환
    // 쿠키는 supabase-server의 setAll에서 자동으로 set
    return Response.json(
      {
        user: { id: data.user?.id, email: data.user?.email },
        needsOnboarding: true,
      },
      { status: 201 },
    );
  },
);
