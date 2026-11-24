// 마이그레이션 SQL을 메모리 Postgres(PGlite)에서 실제로 실행해 검증한다.
// 운영 DB에 닿지 않는다.
//
// - 모든 마이그레이션이 빈 DB에 순서대로 적용되는지
// - 데이터를 고치는 마이그레이션이 기존 데이터를 의도대로 정리하는지
// - 추가한 제약이 실제로 잘못된 데이터를 거부하는지
//
// 새 마이그레이션이 기존 데이터를 바꾸거나 제약을 추가한다면 여기에 검증을 덧붙일 것.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(__dirname, "migrations");

/** 적용 순서(폴더명 = 타임스탬프 순)대로 정렬된 마이그레이션 이름 */
const MIGRATIONS = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

async function apply(db: PGlite, name: string) {
  const sql = readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8");
  await db.exec(sql);
}

/** `until` 직전까지 적용 (until을 생략하면 전부) */
async function applyUntil(db: PGlite, until?: string) {
  for (const name of MIGRATIONS) {
    if (name === until) return;
    await apply(db, name);
  }
}

async function rows<T>(db: PGlite, sql: string): Promise<T[]> {
  return (await db.query<T>(sql)).rows;
}

// 고정 UUID — 읽기 쉽게 끝자리만 다르게
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const GUILD = id(1);
const USER = id(10);
const [POOL_1, POOL_2, POOL_3] = [id(21), id(22), id(23)];
const [DUNGEON_EXPIRED, DUNGEON_OLDER, DUNGEON_LATEST] = [id(31), id(32), id(33)];
const [DAILY_1, DAILY_2, DAILY_3, DUNGEON_MISSION] = [id(41), id(42), id(43), id(44)];
const [LOG_DAILY, LOG_DUNGEON, LOG_DUMMY_A, LOG_DUMMY_B, LOG_ORPHAN] = [
  id(51),
  id(52),
  id(53),
  id(54),
  id(55),
];
const DELETED_MISSION = id(99);

const missionLog = (logId: string, missionId: string, type: "DAILY" | "DUNGEON") =>
  `('${logId}', '${USER}', '${missionId}', '미션', '${type}', 'ETC', 10, 0.1, 5, 'EGG', 'EGG')`;

describe("전체 마이그레이션", () => {
  it("빈 DB에 순서대로 적용된다", async () => {
    const db = new PGlite();
    await applyUntil(db);

    const tables = await rows<{ tablename: string }>(
      db,
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`,
    );
    expect(tables.map((t) => t.tablename)).toEqual([
      "dinos",
      "dungeons",
      "guilds",
      "mission_logs",
      "mission_pool",
      "missions",
      "users",
      "world_snapshots",
    ]);
  }, 60_000);

  it("모든 테이블에 RLS가 켜져 있다", async () => {
    const db = new PGlite();
    await applyUntil(db);

    const withoutRls = await rows<{ relname: string }>(
      db,
      `SELECT c.relname FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`,
    );
    expect(withoutRls).toEqual([]);
  }, 60_000);
});

describe("20261117000000_integrity_constraints", () => {
  const TARGET = "20261117000000_integrity_constraints";
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await applyUntil(db, TARGET);

    // 마이그레이션 이전 형태의 데이터 — 실제 운영 DB에서 확인한 상황을 재현
    await db.exec(`
      INSERT INTO "guilds" ("id", "regionCode", "displayName")
        VALUES ('${GUILD}', '11680', '강남구');
      INSERT INTO "users" ("id", "nickname", "regionCode", "guildId", "updatedAt")
        VALUES ('${USER}', '테스터', '11680', '${GUILD}', now());
      INSERT INTO "mission_pool" ("id", "title", "description", "category", "timeSlot", "baseReward", "estimatedKwh")
        VALUES ('${POOL_1}', 'a', 'a', 'COOLING', 'DAY', 50, 0.5),
               ('${POOL_2}', 'b', 'b', 'LIGHTING', 'EVENING', 40, 0.4),
               ('${POOL_3}', 'c', 'c', 'ETC', 'ANYTIME', 30, 0.3);

      -- 던전: 만료됐는데 활성으로 남은 것 1개 + 유효한 활성 2개 (단일 활성 위반 상태)
      INSERT INTO "dungeons" ("id", "triggerReason", "isActive", "activatedAt", "expiresAt")
        VALUES ('${DUNGEON_EXPIRED}', 'manual', true, now() - interval '2 days', now() - interval '1 day'),
               ('${DUNGEON_OLDER}',   'manual', true, now() - interval '20 minutes', now() + interval '40 minutes'),
               ('${DUNGEON_LATEST}',  'auto',   true, now() - interval '5 minutes',  now() + interval '55 minutes');

      -- 일일 미션 3개 (발급 순서 = createdAt 순) + 던전 미션 1개
      INSERT INTO "missions" ("id", "userId", "poolId", "type", "dungeonId", "assignedDate", "expiresAt", "createdAt")
        VALUES ('${DAILY_3}', '${USER}', '${POOL_3}', 'DAILY', NULL, '2026-11-17', now() + interval '1 day', '2026-11-17 00:00:03'),
               ('${DAILY_1}', '${USER}', '${POOL_1}', 'DAILY', NULL, '2026-11-17', now() + interval '1 day', '2026-11-17 00:00:01'),
               ('${DAILY_2}', '${USER}', '${POOL_2}', 'DAILY', NULL, '2026-11-17', now() + interval '1 day', '2026-11-17 00:00:02'),
               ('${DUNGEON_MISSION}', '${USER}', '${POOL_1}', 'DUNGEON', '${DUNGEON_LATEST}', '2026-11-17', now() + interval '1 day', '2026-11-17 01:00:00');

      -- 완료 기록:
      --   정상 일일 / 정상 던전 / 시드 더미 2건(missionId에 풀 id, 서로 중복) / 미션이 이미 삭제된 것
      INSERT INTO "mission_logs" ("id", "userId", "missionId", "missionTitle", "missionType", "missionCategory", "cleanEnergyEarned", "co2ReducedKg", "intimacyEarned", "stageBefore", "stageAfter")
        VALUES ${missionLog(LOG_DAILY, DAILY_1, "DAILY")},
               ${missionLog(LOG_DUNGEON, DUNGEON_MISSION, "DUNGEON")},
               ${missionLog(LOG_DUMMY_A, POOL_1, "DAILY")},
               ${missionLog(LOG_DUMMY_B, POOL_1, "DAILY")},
               ${missionLog(LOG_ORPHAN, DELETED_MISSION, "DAILY")};
    `);

    await apply(db, TARGET);
  }, 60_000);

  describe("기존 데이터 정리", () => {
    it("일일 미션에 발급 순서대로 슬롯 0·1·2를 부여하고 던전 미션은 NULL로 둔다", async () => {
      const result = await rows<{ id: string; slot: number | null }>(
        db,
        `SELECT "id", "slot" FROM "missions" ORDER BY "createdAt"`,
      );
      expect(result).toEqual([
        { id: DAILY_1, slot: 0 },
        { id: DAILY_2, slot: 1 },
        { id: DAILY_3, slot: 2 },
        { id: DUNGEON_MISSION, slot: null },
      ]);
    });

    it("완료 기록은 한 건도 지우지 않는다", async () => {
      const [{ n }] = await rows<{ n: number }>(
        db,
        `SELECT count(*)::int AS n FROM "mission_logs"`,
      );
      expect(n).toBe(5);
    });

    it("실제 미션을 가리키는 missionId는 유지하고, 던전 미션 기록에는 dungeonId를 채운다", async () => {
      const result = await rows<{ id: string; missionId: string | null; dungeonId: string | null }>(
        db,
        `SELECT "id", "missionId", "dungeonId" FROM "mission_logs" WHERE "id" IN ('${LOG_DAILY}', '${LOG_DUNGEON}') ORDER BY "id"`,
      );
      expect(result).toEqual([
        { id: LOG_DAILY, missionId: DAILY_1, dungeonId: null },
        { id: LOG_DUNGEON, missionId: DUNGEON_MISSION, dungeonId: DUNGEON_LATEST },
      ]);
    });

    it("미션을 가리키지 않는 missionId(더미의 풀 id, 삭제된 미션)는 NULL로 바꾼다", async () => {
      const result = await rows<{ missionId: string | null }>(
        db,
        `SELECT "missionId" FROM "mission_logs" WHERE "id" IN ('${LOG_DUMMY_A}', '${LOG_DUMMY_B}', '${LOG_ORPHAN}')`,
      );
      expect(result).toEqual([
        { missionId: null },
        { missionId: null },
        { missionId: null },
      ]);
    });

    it("활성 던전은 가장 최근 것 하나만 남기고, 만료된 것은 만료 시각으로 마감한다", async () => {
      const result = await rows<{ id: string; isActive: boolean; ended_at_expiry: boolean | null }>(
        db,
        `SELECT "id", "isActive", "endedAt" = "expiresAt" AS ended_at_expiry FROM "dungeons" ORDER BY "id"`,
      );
      expect(result).toEqual([
        { id: DUNGEON_EXPIRED, isActive: false, ended_at_expiry: true },
        { id: DUNGEON_OLDER, isActive: false, ended_at_expiry: false },
        { id: DUNGEON_LATEST, isActive: true, ended_at_expiry: null },
      ]);
    });

    it("triggerReason 값을 보존한 채 enum으로 바꾼다", async () => {
      const result = await rows<{ id: string; triggerReason: string }>(
        db,
        `SELECT "id", "triggerReason"::text AS "triggerReason" FROM "dungeons" ORDER BY "id"`,
      );
      expect(result.map((r) => r.triggerReason)).toEqual(["manual", "manual", "auto"]);
    });
  });

  describe("제약", () => {
    const insertMission = (
      missionId: string,
      opts: { type: "DAILY" | "DUNGEON"; slot: number | null; pool: string; dungeon?: string },
    ) =>
      db.exec(`
        INSERT INTO "missions" ("id", "userId", "poolId", "type", "dungeonId", "assignedDate", "expiresAt", "slot")
        VALUES ('${missionId}', '${USER}', '${opts.pool}', '${opts.type}', ${opts.dungeon ? `'${opts.dungeon}'` : "NULL"}, '2026-11-17', now() + interval '1 day', ${opts.slot ?? "NULL"})
      `);

    it("같은 날 같은 슬롯의 일일 미션을 다시 발급할 수 없다", async () => {
      await expect(
        insertMission(id(101), { type: "DAILY", slot: 0, pool: POOL_2 }),
      ).rejects.toThrow(/missions_userId_assignedDate_type_slot_key/);
    });

    it("다른 날짜에는 같은 슬롯을 발급할 수 있다", async () => {
      await db.exec(`
        INSERT INTO "missions" ("id", "userId", "poolId", "type", "assignedDate", "expiresAt", "slot")
        VALUES ('${id(102)}', '${USER}', '${POOL_1}', 'DAILY', '2026-11-18', now() + interval '2 days', 0)
      `);
    });

    it("같은 던전의 같은 미션을 한 사용자에게 두 번 발급할 수 없다", async () => {
      await expect(
        insertMission(id(103), {
          type: "DUNGEON",
          slot: null,
          pool: POOL_1,
          dungeon: DUNGEON_LATEST,
        }),
      ).rejects.toThrow(/missions_userId_dungeonId_poolId_key/);
    });

    it("같은 던전의 다른 미션, 다른 던전의 같은 미션은 발급할 수 있다", async () => {
      await insertMission(id(104), {
        type: "DUNGEON",
        slot: null,
        pool: POOL_2,
        dungeon: DUNGEON_LATEST,
      });
      await insertMission(id(105), {
        type: "DUNGEON",
        slot: null,
        pool: POOL_1,
        dungeon: DUNGEON_OLDER,
      });
    });

    it("활성 던전이 있으면 또 하나를 활성으로 만들 수 없다", async () => {
      await expect(
        db.exec(`
          INSERT INTO "dungeons" ("id", "triggerReason", "isActive", "expiresAt")
          VALUES ('${id(111)}', 'manual', true, now() + interval '1 hour')
        `),
      ).rejects.toThrow(/dungeons_single_active/);
    });

    it("종료된 던전은 몇 개든 둘 수 있고, 활성 던전을 끝내면 새로 발령할 수 있다", async () => {
      await db.exec(`
        INSERT INTO "dungeons" ("id", "triggerReason", "isActive", "expiresAt")
        VALUES ('${id(112)}', 'manual', false, now() + interval '1 hour');
        UPDATE "dungeons" SET "isActive" = false, "endedAt" = now() WHERE "id" = '${DUNGEON_LATEST}';
        INSERT INTO "dungeons" ("id", "triggerReason", "isActive", "expiresAt")
        VALUES ('${id(113)}', 'auto', true, now() + interval '1 hour');
      `);
    });

    it("정의되지 않은 triggerReason은 거부한다", async () => {
      await expect(
        db.exec(`
          INSERT INTO "dungeons" ("id", "triggerReason", "isActive", "expiresAt")
          VALUES ('${id(114)}', 'whatever', false, now() + interval '1 hour')
        `),
      ).rejects.toThrow(/DungeonTriggerReason/);
    });

    it("한 미션에 완료 기록을 두 번 남길 수 없다", async () => {
      await expect(
        db.exec(`
          INSERT INTO "mission_logs" ("id", "userId", "missionId", "missionTitle", "missionType", "missionCategory", "cleanEnergyEarned", "co2ReducedKg", "intimacyEarned", "stageBefore", "stageAfter")
          VALUES ${missionLog(id(121), DAILY_1, "DAILY")}
        `),
      ).rejects.toThrow(/mission_logs_missionId_key/);
    });

    it("존재하지 않는 미션을 가리키는 완료 기록은 남길 수 없다", async () => {
      await expect(
        db.exec(`
          INSERT INTO "mission_logs" ("id", "userId", "missionId", "missionTitle", "missionType", "missionCategory", "cleanEnergyEarned", "co2ReducedKg", "intimacyEarned", "stageBefore", "stageAfter")
          VALUES ${missionLog(id(122), DELETED_MISSION, "DAILY")}
        `),
      ).rejects.toThrow(/mission_logs_missionId_fkey/);
    });

    it("미션을 지우면 완료 기록은 남고 missionId만 NULL이 된다", async () => {
      await db.exec(`DELETE FROM "missions" WHERE "id" = '${DAILY_1}'`);
      const result = await rows<{ missionId: string | null }>(
        db,
        `SELECT "missionId" FROM "mission_logs" WHERE "id" = '${LOG_DAILY}'`,
      );
      expect(result).toEqual([{ missionId: null }]);
    });
  });
});

describe("20261117010000_drop_redundant_columns", () => {
  const TARGET = "20261117010000_drop_redundant_columns";
  const SNAPSHOT_TS = "2026-11-17T06:35:00.000Z";
  let db: PGlite;

  const columns = async (table: string) =>
    (
      await rows<{ column_name: string }>(
        db,
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' ORDER BY 1`,
      )
    ).map((c) => c.column_name);

  beforeAll(async () => {
    db = new PGlite();
    await applyUntil(db, TARGET);

    // 삭제 전 형태의 데이터
    await db.exec(`
      INSERT INTO "guilds" ("id", "regionCode", "displayName", "seasonScore")
        VALUES ('${GUILD}', '11680', '강남구', 350);
      INSERT INTO "leaderboard_cache" ("id", "topGuilds", "updatedAt")
        VALUES ('global', '[]', now());
      INSERT INTO "world_snapshots" ("ts", "carbonIntensity", "supplyReserveRate", "supplyCapacity", "currentLoad", "fuelMix")
        VALUES ('${SNAPSHOT_TS}', 461.72, 33.25, 97002, 72796, '{"coal": 29249.1}');
    `);

    await apply(db, TARGET);
  }, 60_000);

  it("leaderboard_cache 테이블을 지운다", async () => {
    const tables = await rows<{ tablename: string }>(
      db,
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leaderboard_cache'`,
    );
    expect(tables).toEqual([]);
  });

  it("guilds에서 점수 사본 컬럼만 지우고 행은 그대로 둔다", async () => {
    expect(await columns("guilds")).toEqual([
      "createdAt",
      "displayName",
      "id",
      "regionCode",
    ]);
    expect(
      await rows(db, `SELECT "id", "regionCode", "displayName" FROM "guilds"`),
    ).toEqual([{ id: GUILD, regionCode: "11680", displayName: "강남구" }]);
  });

  it("world_snapshots에서 isFallback·temperature만 지우고 수집 데이터는 그대로 둔다", async () => {
    expect(await columns("world_snapshots")).toEqual([
      "carbonIntensity",
      "createdAt",
      "currentLoad",
      "fuelMix",
      "supplyCapacity",
      "supplyReserveRate",
      "ts",
    ]);
    const result = await rows<{
      carbonIntensity: string;
      currentLoad: number;
      fuelMix: { coal: number };
    }>(
      db,
      `SELECT "carbonIntensity", "currentLoad", "fuelMix" FROM "world_snapshots"`,
    );
    expect(result).toEqual([
      { carbonIntensity: "461.72", currentLoad: 72796, fuelMix: { coal: 29249.1 } },
    ]);
  });

  it("ts의 중복 인덱스는 지우고 PK는 남긴다 — 같은 ts는 여전히 거부", async () => {
    const indexes = await rows<{ indexname: string }>(
      db,
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'world_snapshots' ORDER BY 1`,
    );
    expect(indexes).toEqual([{ indexname: "world_snapshots_pkey" }]);

    await expect(
      db.exec(`
        INSERT INTO "world_snapshots" ("ts", "carbonIntensity", "supplyReserveRate", "supplyCapacity", "currentLoad", "fuelMix")
        VALUES ('${SNAPSHOT_TS}', 1, 1, 1, 1, '{}')
      `),
    ).rejects.toThrow(/world_snapshots_pkey/);
  });
});

describe("20261124000000_snapshot_forecast_load", () => {
  const TARGET = "20261124000000_snapshot_forecast_load";
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await applyUntil(db, TARGET);
    await db.exec(`
      INSERT INTO "world_snapshots" ("ts", "carbonIntensity", "supplyReserveRate", "supplyCapacity", "currentLoad", "fuelMix")
        VALUES ('2026-11-24T06:00:00.000Z', 461.72, 33.25, 97002, 72796, '{}');
    `);
    await apply(db, TARGET);
  }, 60_000);

  it("기존 행은 그대로 두고 forecastLoad를 NULL로 채운다", async () => {
    expect(
      await rows(db, `SELECT "currentLoad", "forecastLoad" FROM "world_snapshots"`),
    ).toEqual([{ currentLoad: 72796, forecastLoad: null }]);
  });

  it("이전 코드처럼 forecastLoad 없이도 기록할 수 있다", async () => {
    await db.exec(`
      INSERT INTO "world_snapshots" ("ts", "carbonIntensity", "supplyReserveRate", "supplyCapacity", "currentLoad", "fuelMix")
        VALUES ('2026-11-24T06:20:00.000Z', 1, 1, 1, 1, '{}');
    `);
    await db.exec(`
      INSERT INTO "world_snapshots" ("ts", "carbonIntensity", "supplyReserveRate", "supplyCapacity", "currentLoad", "fuelMix", "forecastLoad")
        VALUES ('2026-11-24T06:40:00.000Z', 1, 1, 1, 1, '{}', 83456);
    `);
    expect(
      await rows(db, `SELECT "forecastLoad" FROM "world_snapshots" ORDER BY "ts"`),
    ).toEqual([{ forecastLoad: null }, { forecastLoad: null }, { forecastLoad: 83456 }]);
  });
});

describe("20261124010000_mission_log_guild", () => {
  const TARGET = "20261124010000_mission_log_guild";
  const OTHER_GUILD = id(2);
  const NO_GUILD_USER = id(11);
  const [LOG_A, LOG_B, LOG_C] = [id(61), id(62), id(63)];
  let db: PGlite;

  // missionId 없는 완료 기록 (더미 기록과 같은 형태)
  const log = (logId: string, userId: string) =>
    `('${logId}', '${userId}', '미션', 'DAILY', 'ETC', 10, 0.1, 5, 'EGG', 'EGG')`;
  const LOG_COLUMNS = `"id", "userId", "missionTitle", "missionType", "missionCategory", "cleanEnergyEarned", "co2ReducedKg", "intimacyEarned", "stageBefore", "stageAfter"`;

  beforeAll(async () => {
    db = new PGlite();
    await applyUntil(db, TARGET);
    await db.exec(`
      INSERT INTO "guilds" ("id", "regionCode", "displayName")
        VALUES ('${GUILD}', '11680', '강남구'), ('${OTHER_GUILD}', '11650', '서초구');
      INSERT INTO "users" ("id", "nickname", "regionCode", "guildId", "updatedAt")
        VALUES ('${USER}', '테스터', '11680', '${GUILD}', now()),
               ('${NO_GUILD_USER}', '무소속', '99999', NULL, now());
      INSERT INTO "mission_logs" (${LOG_COLUMNS})
        VALUES ${log(LOG_A, USER)}, ${log(LOG_B, USER)}, ${log(LOG_C, NO_GUILD_USER)};
    `);
    await apply(db, TARGET);
  }, 60_000);

  const guildOf = async (logId: string) =>
    (await rows<{ guildId: string | null }>(db, `SELECT "guildId" FROM "mission_logs" WHERE "id" = '${logId}'`))[0]
      ?.guildId;

  it("기존 기록에 사용자의 현재 길드를 채우고, 길드가 없던 사용자는 NULL로 둔다", async () => {
    expect(await guildOf(LOG_A)).toBe(GUILD);
    expect(await guildOf(LOG_B)).toBe(GUILD);
    expect(await guildOf(LOG_C)).toBeNull();
  });

  it("사용자가 길드를 옮겨도 기존 기록의 길드는 바뀌지 않는다", async () => {
    await db.exec(`UPDATE "users" SET "guildId" = '${OTHER_GUILD}' WHERE "id" = '${USER}'`);
    expect(await guildOf(LOG_A)).toBe(GUILD);
  });

  it("(guildId, completedAt) 인덱스가 있다", async () => {
    const indexes = await rows<{ indexname: string }>(
      db,
      `SELECT indexname FROM pg_indexes WHERE tablename = 'mission_logs' AND indexname = 'mission_logs_guildId_completedAt_idx'`,
    );
    expect(indexes).toHaveLength(1);
  });

  it("없는 길드는 가리킬 수 없고, 길드를 지우면 기록은 남고 guildId만 NULL이 된다", async () => {
    await expect(
      db.exec(`UPDATE "mission_logs" SET "guildId" = '${id(999)}' WHERE "id" = '${LOG_C}'`),
    ).rejects.toThrow(/mission_logs_guildId_fkey/);

    await db.exec(`UPDATE "users" SET "guildId" = NULL WHERE "guildId" = '${GUILD}'`);
    await db.exec(`DELETE FROM "guilds" WHERE "id" = '${GUILD}'`);
    expect(await guildOf(LOG_A)).toBeNull();
    expect(await rows(db, `SELECT "id" FROM "mission_logs" ORDER BY "id"`)).toHaveLength(3);
  });
});
