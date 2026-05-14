import { createServerSupabase } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/types/api";
import { NextRequest } from "next/server";
import { z } from "zod";

const SigninSchema = z.object({
  email: z.email("올바른 이메일 형식이 아닙니다."),
  password: z.string().min(1, "비밀번호를 입력하세요."),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "요청 본문이 올바르지 않습니다.", 400);
  }

  const parsed = SigninSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "입력값이 올바르지 않습니다.",
      400,
      parsed.error.flatten().fieldErrors,
    );
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
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
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  return Response.json({
    user: { id: userId, email: data.user.email },
    needsOnboarding: !profile,
  });
}
