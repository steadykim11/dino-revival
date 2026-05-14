// 서버(Route Handler, Server Component)에서 사용하는 Supabase 클라이언트
// next/headers의 cookies()로 요청 쿠키를 읽어와 supabase에 주입
// Next.js 15부터 cookies()가 Promise가 됐기 때문에 await 필요

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component에서 호출되면 set이 실패(읽기 전용)
            // 같은 함수가 둘 다 지원해야 해서 try/catch 처리
            // middleware에서 토큰 갱신을 처리하므로 무시해도 됨
          }
        },
      },
    },
  );
}
