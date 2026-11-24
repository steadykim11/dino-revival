import { describe, expect, it } from "vitest";
import { planDummyActivity, type ActivityPoolEntry, type DummyActor } from "./dummy-activity";
import { toKstDateString } from "@/lib/time/kst";

const ACTORS: DummyActor[] = Array.from({ length: 30 }, (_, i) => ({
  userId: `user-${i}`,
  guildId: `guild-${i % 3}`,
  stage: "HATCHLING",
}));

const POOL: ActivityPoolEntry[] = [
  { id: "p2", title: "에어컨 끄기", category: "COOLING", baseReward: 60, estimatedKwh: 1 },
  { id: "p1", title: "대기전력 차단", category: "STANDBY", baseReward: 30, estimatedKwh: 0.2 },
];

// KST 2026-11-24 15:00
const NOW = new Date("2026-11-24T06:00:00.000Z");

describe("planDummyActivity", () => {
  it("같은 입력이면 같은 결과 (pool 순서와 무관)", () => {
    const a = planDummyActivity(ACTORS, POOL, NOW);
    const b = planDummyActivity(ACTORS, [...POOL].reverse(), NOW);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("어제와 오늘 기록만, 모두 now 이전", () => {
    const logs = planDummyActivity(ACTORS, POOL, NOW);
    const days = new Set(logs.map((l) => toKstDateString(l.completedAt)));
    expect([...days].sort()).toEqual(["2026-11-23", "2026-11-24"]);
    expect(logs.every((l) => l.completedAt <= NOW)).toBe(true);
  });

  it("시간이 지나면 기록이 늘기만 하고, 이미 계획된 기록은 그대로다", () => {
    const earlier = planDummyActivity(ACTORS, POOL, NOW);
    const later = planDummyActivity(ACTORS, POOL, new Date("2026-11-24T14:00:00.000Z")); // KST 23:00
    const laterById = new Map(later.map((l) => [l.id, l]));
    for (const log of earlier) {
      if (toKstDateString(log.completedAt) === "2026-11-24") {
        expect(laterById.get(log.id)).toEqual(log);
      }
    }
    expect(later.filter((l) => toKstDateString(l.completedAt) === "2026-11-24").length).toBeGreaterThan(
      earlier.filter((l) => toKstDateString(l.completedAt) === "2026-11-24").length,
    );
  });

  it("한 사용자는 하루 최대 3건, ID는 겹치지 않는다", () => {
    const logs = planDummyActivity(ACTORS, POOL, new Date("2026-11-24T14:59:00.000Z"));
    const perUserDay = new Map<string, number>();
    for (const l of logs) {
      const key = `${l.userId}-${toKstDateString(l.completedAt)}`;
      perUserDay.set(key, (perUserDay.get(key) ?? 0) + 1);
    }
    expect(Math.max(...perUserDay.values())).toBeLessThanOrEqual(3);
    expect(new Set(logs.map((l) => l.id)).size).toBe(logs.length);
  });

  it("기록은 사용자의 길드·단계와 pool의 미션 정보를 쓴다", () => {
    const [log] = planDummyActivity(ACTORS.slice(0, 5), POOL, new Date("2026-11-24T14:59:00.000Z"));
    const actor = ACTORS.find((a) => a.userId === log.userId)!;
    expect(log).toMatchObject({
      guildId: actor.guildId,
      missionId: null,
      missionType: "DAILY",
      stageBefore: "HATCHLING",
      stageAfter: "HATCHLING",
      intimacyEarned: 1,
    });
    const picked = POOL.find((p) => p.title === log.missionTitle)!;
    expect(log.missionCategory).toBe(picked.category);
    expect(log.cleanEnergyEarned).toBeGreaterThanOrEqual(picked.baseReward - 3);
    expect(log.cleanEnergyEarned).toBeLessThanOrEqual(picked.baseReward + 5);
  });

  it("pool이 비면 아무것도 만들지 않는다", () => {
    expect(planDummyActivity(ACTORS, [], NOW)).toEqual([]);
  });
});
