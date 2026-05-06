-- CreateEnum
CREATE TYPE "DinoSpecies" AS ENUM ('TYRANNO', 'BRACHIO', 'TRICERA');

-- CreateEnum
CREATE TYPE "DinoStage" AS ENUM ('EGG', 'HATCHLING', 'ADULT');

-- CreateEnum
CREATE TYPE "MissionType" AS ENUM ('DAILY', 'DUNGEON');

-- CreateEnum
CREATE TYPE "MissionTimeSlot" AS ENUM ('DAY', 'EVENING', 'ANYTIME');

-- CreateEnum
CREATE TYPE "MissionCategory" AS ENUM ('COOLING', 'HEATING', 'LIGHTING', 'STANDBY', 'LAUNDRY', 'KITCHEN', 'ETC');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "nickname" VARCHAR(12) NOT NULL,
    "regionCode" VARCHAR(5) NOT NULL,
    "isDummy" BOOLEAN NOT NULL DEFAULT false,
    "nicknameChangedAt" TIMESTAMP(3),
    "regionChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "guildId" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dinos" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "species" "DinoSpecies" NOT NULL DEFAULT 'TYRANNO',
    "stage" "DinoStage" NOT NULL DEFAULT 'EGG',
    "totalCleanEnergy" INTEGER NOT NULL DEFAULT 0,
    "intimacy" INTEGER NOT NULL DEFAULT 0,
    "totalCo2Reduced" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "hatchedAt" TIMESTAMP(3),
    "evolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dinos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guilds" (
    "id" UUID NOT NULL,
    "regionCode" VARCHAR(5) NOT NULL,
    "displayName" VARCHAR(50) NOT NULL,
    "seasonScore" INTEGER NOT NULL DEFAULT 0,
    "scoreUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_pool" (
    "id" UUID NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "MissionCategory" NOT NULL,
    "timeSlot" "MissionTimeSlot" NOT NULL,
    "baseReward" INTEGER NOT NULL,
    "estimatedKwh" DECIMAL(6,3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "poolId" UUID NOT NULL,
    "type" "MissionType" NOT NULL DEFAULT 'DAILY',
    "dungeonId" UUID,
    "assignedDate" DATE NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_logs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "missionId" UUID NOT NULL,
    "missionTitle" VARCHAR(100) NOT NULL,
    "missionType" "MissionType" NOT NULL,
    "missionCategory" "MissionCategory" NOT NULL,
    "carbonIntensityAtCompletion" DECIMAL(6,2),
    "cleanEnergyEarned" INTEGER NOT NULL,
    "co2ReducedKg" DECIMAL(10,3) NOT NULL,
    "intimacyEarned" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dungeons" (
    "id" UUID NOT NULL,
    "triggerReason" VARCHAR(20) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "triggerReserveRate" DECIMAL(5,2),
    "triggerCarbonIntensity" DECIMAL(6,2),

    CONSTRAINT "dungeons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_snapshots" (
    "ts" TIMESTAMPTZ NOT NULL,
    "carbonIntensity" DECIMAL(6,2) NOT NULL,
    "supplyReserveRate" DECIMAL(5,2) NOT NULL,
    "supplyCapacity" INTEGER NOT NULL,
    "currentLoad" INTEGER NOT NULL,
    "temperature" DECIMAL(4,1),
    "fuelMix" JSONB NOT NULL,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "world_snapshots_pkey" PRIMARY KEY ("ts")
);

-- CreateTable
CREATE TABLE "leaderboard_cache" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "topGuilds" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaderboard_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_nickname_key" ON "users"("nickname");

-- CreateIndex
CREATE INDEX "users_regionCode_idx" ON "users"("regionCode");

-- CreateIndex
CREATE INDEX "users_guildId_idx" ON "users"("guildId");

-- CreateIndex
CREATE INDEX "users_isDummy_idx" ON "users"("isDummy");

-- CreateIndex
CREATE UNIQUE INDEX "dinos_userId_key" ON "dinos"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "guilds_regionCode_key" ON "guilds"("regionCode");

-- CreateIndex
CREATE INDEX "guilds_seasonScore_idx" ON "guilds"("seasonScore" DESC);

-- CreateIndex
CREATE INDEX "mission_pool_category_idx" ON "mission_pool"("category");

-- CreateIndex
CREATE INDEX "mission_pool_timeSlot_idx" ON "mission_pool"("timeSlot");

-- CreateIndex
CREATE INDEX "mission_pool_isActive_idx" ON "mission_pool"("isActive");

-- CreateIndex
CREATE INDEX "missions_userId_assignedDate_idx" ON "missions"("userId", "assignedDate");

-- CreateIndex
CREATE INDEX "missions_userId_completedAt_idx" ON "missions"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "missions_dungeonId_idx" ON "missions"("dungeonId");

-- CreateIndex
CREATE INDEX "missions_expiresAt_idx" ON "missions"("expiresAt");

-- CreateIndex
CREATE INDEX "mission_logs_userId_completedAt_idx" ON "mission_logs"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "dungeons_isActive_idx" ON "dungeons"("isActive");

-- CreateIndex
CREATE INDEX "dungeons_expiresAt_idx" ON "dungeons"("expiresAt");

-- CreateIndex
CREATE INDEX "world_snapshots_ts_idx" ON "world_snapshots"("ts" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dinos" ADD CONSTRAINT "dinos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "mission_pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_dungeonId_fkey" FOREIGN KEY ("dungeonId") REFERENCES "dungeons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_logs" ADD CONSTRAINT "mission_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
