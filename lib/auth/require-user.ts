// API Route Handler에서 사용
// 미인증 시 401 error throw

import { NextResponse } from "next/server";
import { createClient } from "./supabase-server";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthorizedError();
  }

  return { user, supabase };
}

// Route Handler를 감싸 UnauthorizedError를 자동으로 401 응답으로 변환
export function withAuth<T>(
  handler: (ctx: Awaited<ReturnType<typeof requireUser>>) => Promise<T>,
) {
  return async () => {
    try {
      const ctx = await requireUser();
      return await handler(ctx);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json(
          {
            error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
          },
          { status: 401 },
        );
      }
      throw err;
    }
  };
}
