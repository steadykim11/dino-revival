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

/**
 * 외부 API 호출에만 필요한 환경 변수
 * 어떤 환경(앱 런타임, ingest 스크립트)에서도 사용 가능
 */
export const externalEnv = ExternalEnvSchema.parse(process.env);

/**
 * 앱 런타임 전용 환경 변수
 * GitHub Actions 같은 외부 환경에선 import하면 깨짐
 */
export const env = AppEnvSchema.parse(process.env);