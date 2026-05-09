import { z } from 'zod';

/**
 * KPX API 호출에만 필요한 변수
 * GitHub Actions의 ingest 스크립트도 이 그룹만 사용
 */
const ExternalEnvSchema = z.object({
  KPX_API_KEY: z.string().min(1),
});

/**
 * 앱 런타임 (Vercel 함수, 로컬 dev 서버) 전용
 * DB·Supabase·인증 관련 변수
 */
const AppEnvSchema = ExternalEnvSchema.extend({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(16),
  ADMIN_USER_IDS: z.string().optional(),
});

// External: KPX 호출에만 필요. 모듈 로드 시 즉시 평가 OK
// (KPX_API_KEY 하나뿐이고 어떤 환경에서도 거의 항상 있음).
export const externalEnv = ExternalEnvSchema.parse(process.env);

// App: DB·Supabase 등 런타임 변수들. lazy 평가 — 실제로 호출되는 시점에만 검증.
// import만 해도 깨지는 일이 없어짐.
let _appEnv: z.infer<typeof AppEnvSchema> | null = null;

export function getEnv(): z.infer<typeof AppEnvSchema> {
  if (!_appEnv) {
    _appEnv = AppEnvSchema.parse(process.env);
  }
  return _appEnv;
}

// 기존 코드 호환 — getter로 동작
// 사용처에서 env.X로 호출되면 그때 검증
export const env = new Proxy({} as z.infer<typeof AppEnvSchema>, {
  get(_, key: string) {
    return getEnv()[key as keyof z.infer<typeof AppEnvSchema>];
  },
});