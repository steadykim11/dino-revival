-- Phase 3-B: 다른 데이터에서 다시 계산할 수 있는 사본과 쓰지 않는 컬럼을 지운다.
--
-- 이 마이그레이션은 되돌릴 수 없다. 적용 전 운영 DB에서 확인한 내용 (2026-11-17):
--   - guilds.seasonScore: 15개 길드 모두 길드원 Dino.totalCleanEnergy 합과 일치 (사본)
--   - leaderboard_cache: 같은 집계를 JSON으로 저장한 캐시 1행
--   - world_snapshots.isFallback: 전 행 false (한 번도 true로 기록된 적 없음)
--   - world_snapshots.temperature: 전 행 NULL (수집한 적 없음)
--
-- 배포 순서: 이 컬럼들을 쓰지 않는 코드(Prisma 스키마에서 필드 제거)가 먼저 배포된 뒤에
-- 적용해야 한다. 이전 코드의 Prisma 클라이언트는 모든 컬럼을 SELECT하므로,
-- 순서가 바뀌면 배포가 끝날 때까지 조회가 실패한다.

-- ---------------------------------------------------------------------------
-- 1. 길드 점수 사본 — 조회 시 계산으로 대체 (lib/guilds/ranking.ts)
-- ---------------------------------------------------------------------------
DROP TABLE "leaderboard_cache";

DROP INDEX "guilds_seasonScore_idx";

ALTER TABLE "guilds"
  DROP COLUMN "seasonScore",
  DROP COLUMN "scoreUpdatedAt";

-- ---------------------------------------------------------------------------
-- 2. world_snapshots — 쓰지 않는 컬럼과 PK와 중복인 인덱스
-- ---------------------------------------------------------------------------
-- ts는 PK라 이미 인덱스가 있다. B-tree는 양방향으로 읽으므로 DESC 인덱스가 따로 필요 없다.
DROP INDEX "world_snapshots_ts_idx";

-- 지연 여부는 저장하지 않고 읽는 시점에 ts로 판정한다 (lib/world/staleness.ts).
ALTER TABLE "world_snapshots"
  DROP COLUMN "isFallback",
  DROP COLUMN "temperature";
