-- Phase 3-A: 정합성을 앱 코드가 아니라 DB 제약으로 보장한다.
-- 데이터를 지우지 않는다. (mission_logs.missionId의 잘못된 참조만 NULL로 바꾼다.)
--
-- 적용 전 확인한 실제 데이터 (2026-11-17):
--   - 일일 미션: 사용자·날짜별로 모두 정확히 3개 (중복 없음)
--   - 던전 미션: (userId, dungeonId, poolId) 중복 없음
--   - 활성 던전: 0개, triggerReason 값은 'manual'뿐
--   - mission_logs.missionId: 시드 더미 로그 676건이 Mission이 아닌 MissionPool의 id를 담고 있음

-- ---------------------------------------------------------------------------
-- 1. dungeons.triggerReason: VARCHAR → enum (값 보존)
-- ---------------------------------------------------------------------------
CREATE TYPE "DungeonTriggerReason" AS ENUM ('auto', 'manual');

ALTER TABLE "dungeons"
  ALTER COLUMN "triggerReason" TYPE "DungeonTriggerReason"
  USING "triggerReason"::"DungeonTriggerReason";

-- ---------------------------------------------------------------------------
-- 2. dungeons: 활성 던전은 동시에 하나만
-- ---------------------------------------------------------------------------
-- 만료됐는데 아직 활성으로 남은 행을 먼저 마감한다.
UPDATE "dungeons"
SET "isActive" = false, "endedAt" = COALESCE("endedAt", "expiresAt")
WHERE "isActive" AND "expiresAt" <= now();

-- 그래도 활성이 둘 이상이면 가장 최근 것만 남긴다.
UPDATE "dungeons" d
SET "isActive" = false, "endedAt" = COALESCE(d."endedAt", now())
WHERE d."isActive"
  AND d."id" <> (
    SELECT "id" FROM "dungeons"
    WHERE "isActive"
    ORDER BY "activatedAt" DESC
    LIMIT 1
  );

-- 부분 유니크 인덱스: isActive = true인 행은 최대 1개.
-- (Prisma 스키마로는 표현할 수 없어 SQL에만 있다.)
CREATE UNIQUE INDEX "dungeons_single_active" ON "dungeons" ("isActive") WHERE "isActive";

-- ---------------------------------------------------------------------------
-- 3. missions: 일일 미션 슬롯 + 중복 발급 방지
-- ---------------------------------------------------------------------------
ALTER TABLE "missions" ADD COLUMN "slot" SMALLINT;

-- 기존 일일 미션에 슬롯 부여 (발급 순서대로 0, 1, 2 = DAY, EVENING, ANYTIME).
-- 던전 미션은 NULL로 둔다.
UPDATE "missions" m
SET "slot" = t.rn
FROM (
  SELECT "id",
         row_number() OVER (
           PARTITION BY "userId", "assignedDate"
           ORDER BY "createdAt", "id"
         ) - 1 AS rn
  FROM "missions"
  WHERE "type" = 'DAILY'
) t
WHERE m."id" = t."id";

CREATE UNIQUE INDEX "missions_userId_assignedDate_type_slot_key"
  ON "missions"("userId", "assignedDate", "type", "slot");

CREATE UNIQUE INDEX "missions_userId_dungeonId_poolId_key"
  ON "missions"("userId", "dungeonId", "poolId");

-- ---------------------------------------------------------------------------
-- 4. mission_logs: missionId를 실제 참조로, dungeonId 추가
-- ---------------------------------------------------------------------------
ALTER TABLE "mission_logs"
  ADD COLUMN "dungeonId" UUID,
  ALTER COLUMN "missionId" DROP NOT NULL;

-- 던전 미션의 완료 기록에 던전을 채운다 (미션 행이 남아 있는 것만 가능).
UPDATE "mission_logs" l
SET "dungeonId" = m."dungeonId"
FROM "missions" m
WHERE m."id" = l."missionId" AND m."dungeonId" IS NOT NULL;

-- 존재하는 Mission을 가리키지 않는 missionId는 NULL로 바꾼다.
--   - 시드 더미 로그: MissionPool의 id가 들어 있었음
--   - 미션 행이 이미 삭제된 로그 (관리자 "미션 재생성")
-- 완료 기록 자체(제목·보상·시각)는 그대로 남는다.
UPDATE "mission_logs" l
SET "missionId" = NULL
WHERE l."missionId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "missions" m WHERE m."id" = l."missionId");

-- 한 미션은 한 번만 완료 기록된다. (NULL은 유니크 대상이 아니다.)
CREATE UNIQUE INDEX "mission_logs_missionId_key" ON "mission_logs"("missionId");

CREATE INDEX "mission_logs_dungeonId_idx" ON "mission_logs"("dungeonId");

ALTER TABLE "mission_logs"
  ADD CONSTRAINT "mission_logs_missionId_fkey"
  FOREIGN KEY ("missionId") REFERENCES "missions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mission_logs"
  ADD CONSTRAINT "mission_logs_dungeonId_fkey"
  FOREIGN KEY ("dungeonId") REFERENCES "dungeons"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
