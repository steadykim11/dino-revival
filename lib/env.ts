import { z } from "zod";

// 서버 전용
const EnvSchema = z.object({
  // DB
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // External APIs
  KPX_API_KEY: z.string().min(1),

  // Cron / Admin (D4 이후 사용)
  CRON_SECRET: z.string().min(16),
  ADMIN_USER_IDS: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
