// 브라우저(클라이언트 컴포넌트)에서 사용하는 Supabase 클라이언트
// 쿠키는 브라우저가 자동 관리하므로 별도 설정 불필요

import { createBrowserClient } from "@supabase/ssr";

export function creatClient(){
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}    