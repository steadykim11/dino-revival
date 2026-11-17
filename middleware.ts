// 요청 직전에 실행돼 Supabase 세션 토큰을 갱신한다 (ADR 12).
//
// 서버 컴포넌트는 쿠키를 쓸 수 없어서, 만료된 토큰의 갱신은 여기서 해 줘야 한다.
// 미인증 시 redirect는 하지 않는다 — 각 레이아웃·페이지와 라우트 래퍼가 판단한다.

import { createServerClient } from "@supabase/ssr";
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
          );
          // response 쿠키 갱신 (브라우저에 새 쿠키 보내도록)
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 토큰 갱신 트리거
  await supabase.auth.getUser();

  return response;
}

// 미들웨어를 거치지 않는 경로:
//   - 정적 자원·이미지
//   - 세션과 무관한 공개 API: /api/world/state(화면이 주기적으로 폴링), /api/health
//     여기에 Supabase Auth 호출을 붙이면 폴링마다 불필요한 왕복이 생긴다.
// (Next가 이 값을 빌드 때 정적으로 읽으므로 상수로 빼거나 조립할 수 없다.)
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/world/state|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
