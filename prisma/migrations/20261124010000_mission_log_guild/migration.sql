-- 길드 시즌 점수 (ADR 43).
-- 미션 완료 기록에 완료 당시 소속 길드를 남긴다. 시즌 점수는 이 값으로 집계한다.
-- 컬럼 추가만 하므로 이전 코드도 그대로 동작한다 (이전 코드가 쓴 기록은 guildId가 NULL).

-- AlterTable
ALTER TABLE "mission_logs" ADD COLUMN "guildId" UUID;

-- 기존 기록: 사용자의 현재 길드로 채운다. 지금까지 동네 변경이 드물어 가장 가까운 근사다.
UPDATE "mission_logs" AS ml
SET "guildId" = u."guildId"
FROM "users" AS u
WHERE u."id" = ml."userId" AND u."guildId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "mission_logs_guildId_completedAt_idx" ON "mission_logs"("guildId", "completedAt");

-- AddForeignKey
ALTER TABLE "mission_logs" ADD CONSTRAINT "mission_logs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
