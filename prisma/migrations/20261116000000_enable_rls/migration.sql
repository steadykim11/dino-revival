-- Supabase는 public 스키마 테이블을 anon key로 REST(PostgREST) 노출한다.
-- RLS를 켜고 정책을 두지 않으면 anon/authenticated 역할은 어떤 행도 읽거나 쓸 수 없다.
-- 앱은 Prisma(테이블 소유자 역할)로만 접근하므로 RLS의 영향을 받지 않는다.
--
-- 이미 켜져 있는 테이블에 다시 실행해도 안전하다 (no-op).
-- 새 테이블을 추가하는 마이그레이션에는 반드시 같은 구문을 함께 넣을 것.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dinos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guilds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mission_pool" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "missions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mission_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dungeons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "world_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leaderboard_cache" ENABLE ROW LEVEL SECURITY;

-- Prisma 자체 관리 테이블. shadow DB에는 없을 수 있어 IF EXISTS.
ALTER TABLE IF EXISTS "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
