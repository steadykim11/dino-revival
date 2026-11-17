import { z } from "zod";
import { createServerSupabase } from "@/lib/auth/supabase-server";
import { errorResponse, route } from "@/lib/http/route";
import { userExists } from "@/lib/users/users.server";

const SigninSchema = z.object({
  email: z.email("올바른 이메일 형식이 아닙니다."),
  password: z.string().min(1, "비밀번호를 입력하세요."),
});

export const POST = route(
  { auth: "public", body: SigninSchema },
  async ({ body }) => {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (error) {
      if (error.code === "invalid_credentials" || error.status === 400) {
        return errorResponse(
          "INVALID_CREDENTIALS",
          "이메일 또는 비밀번호가 올바르지 않습니다.",
          401,
        );
      }

      return errorResponse(
        "SIGNIN_FAILED",
        error.message ?? "로그인에 실패했습니다.",
        error.status ?? 500,
      );
    }

    // User 테이블에 row 있는지 확인 -> 클라이언트가 라우팅 분기
    const userId = data.user.id;
    const hasProfile = await userExists(userId);

    return Response.json({
      user: { id: userId, email: data.user.email },
      needsOnboarding: !hasProfile,
    });
  },
);
