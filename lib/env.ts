import { z } from "zod";

// 두 그룹 모두 lazy 평가 — import만으로는 검증하지 않고, 실제로 값을 읽는 시점에 검증한다.
// 실행 환경마다 필요한 변수가 다르기 때문:
//   - 웹 앱(Vercel): AppEnv만 필요. KPX를 호출하지 않는다.
//   - 수집 작업(jobs/): ExternalEnv + DATABASE_URL.

/**
 * 웹 앱 런타임 (Vercel 함수, 로컬 dev 서버)
 */
const AppEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  ADMIN_USER_IDS: z.string().optional(),
});

/**
 * KPX API 호출 (수집 작업 전용)
 */
const ExternalEnvSchema = z.object({
  KPX_API_KEY: z.string().min(1),
});

type AppEnv = z.infer<typeof AppEnvSchema>;
type ExternalEnv = z.infer<typeof ExternalEnvSchema>;

let _appEnv: AppEnv | null = null;
let _externalEnv: ExternalEnv | null = null;

/** 검증 실패 시 어떤 변수가 문제인지 한 줄로 알려준다 (값은 출력하지 않음) */
function parseEnv<T>(schema: z.ZodType<T>): T {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const names = [
      ...new Set(result.error.issues.map((i) => i.path.join("."))),
    ];
    throw new Error(`환경변수가 없거나 올바르지 않습니다: ${names.join(", ")}`);
  }
  return result.data;
}

export function getEnv(): AppEnv {
  if (!_appEnv) {
    _appEnv = parseEnv(AppEnvSchema);
  }
  return _appEnv;
}

export function getExternalEnv(): ExternalEnv {
  if (!_externalEnv) {
    _externalEnv = parseEnv(ExternalEnvSchema);
  }
  return _externalEnv;
}

// env.X로 읽는 시점에 검증
export const env = new Proxy({} as AppEnv, {
  get(_, key: string) {
    return getEnv()[key as keyof AppEnv];
  },
});
