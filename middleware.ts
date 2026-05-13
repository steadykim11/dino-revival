// 모든 요청 직전에 실행돼서 Supabase 세션 토큰을 자동 갱신

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // request 쿠키 갱신 (이후 서버 코드가 새 쿠키 읽도록)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          // response 쿠키 갱신 (브라우저에 새 쿠키 보내도록)
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        }
      },
    },
  );

  // 토큰 갱신 트리거
  await supabase.auth.getUser();

  return response;
}


// 정적 자원/이미지는 미들웨어 통과x
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
}