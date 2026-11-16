import { describe, expect, it } from "vitest";
import { MISSIONS } from "@/prisma/seeds/mission-pool";
import { selectDailyMissions, type SelectInput } from "./daily-selector";

type PoolItem = SelectInput["pool"][number];

/** 재현 가능한 난수 (mulberry32) */
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 시드 데이터로 만든 실제 미션 풀 */
const SEED_POOL: PoolItem[] = MISSIONS.map((m, i) => ({
  id: `pool-${i}`,
  category: m.category,
  timeSlot: m.timeSlot,
}));

const byId = new Map(SEED_POOL.map((p) => [p.id, p]));

describe("selectDailyMissions — 시드 풀", () => {
  it("시드 풀은 세 시간대를 모두 갖고 있다", () => {
    for (const slot of ["DAY", "EVENING", "ANYTIME"] as const) {
      expect(SEED_POOL.some((p) => p.timeSlot === slot)).toBe(true);
    }
  });

  it("1000회 시뮬레이션: 항상 DAY·EVENING·ANYTIME 1개씩, 중복 없음", () => {
    const rng = seededRng(42);
    for (let i = 0; i < 1000; i++) {
      const { selectedPoolIds, relaxations } = selectDailyMissions({
        pool: SEED_POOL,
        previousPoolIds: [],
        rng,
      });
      const picked = selectedPoolIds.map((id) => byId.get(id)!);

      expect(picked.map((p) => p.timeSlot)).toEqual([
        "DAY",
        "EVENING",
        "ANYTIME",
      ]);
      expect(new Set(selectedPoolIds).size).toBe(3);
      expect(new Set(picked.map((p) => p.category)).size).toBe(3);
      expect(relaxations).toEqual([]);
    }
  });

  it("직전일에 받은 미션은 다시 나오지 않는다", () => {
    const rng = seededRng(7);
    let previous: string[] = [];
    for (let day = 0; day < 200; day++) {
      const { selectedPoolIds } = selectDailyMissions({
        pool: SEED_POOL,
        previousPoolIds: previous,
        rng,
      });
      for (const id of selectedPoolIds) {
        expect(previous).not.toContain(id);
      }
      previous = selectedPoolIds;
    }
  });
});

describe("selectDailyMissions — 제약 완화", () => {
  it("슬롯에 후보가 없으면 ANYTIME으로 폴백한다", () => {
    const pool: PoolItem[] = [
      { id: "a", category: "COOLING", timeSlot: "DAY" },
      { id: "b", category: "LIGHTING", timeSlot: "ANYTIME" },
      { id: "c", category: "KITCHEN", timeSlot: "ANYTIME" },
    ];
    const { selectedPoolIds, relaxations } = selectDailyMissions({
      pool,
      previousPoolIds: [],
      rng: seededRng(1),
    });
    expect([...selectedPoolIds].sort()).toEqual(["a", "b", "c"]);
    expect(relaxations).toContain("EVENING_fallback_to_anytime");
  });

  it("카테고리가 겹칠 수밖에 없으면 중복을 허용한다", () => {
    const pool: PoolItem[] = [
      { id: "a", category: "COOLING", timeSlot: "DAY" },
      { id: "b", category: "COOLING", timeSlot: "EVENING" },
      { id: "c", category: "COOLING", timeSlot: "ANYTIME" },
    ];
    const { selectedPoolIds, relaxations } = selectDailyMissions({
      pool,
      previousPoolIds: [],
      rng: seededRng(1),
    });
    expect(new Set(selectedPoolIds).size).toBe(3);
    expect(relaxations).toContain("EVENING_category_dedup_relaxed");
    expect(relaxations).toContain("ANYTIME_category_dedup_relaxed");
  });

  it("직전일 제외 후 3개 미만이면 직전일 필터를 완화한다", () => {
    const pool: PoolItem[] = [
      { id: "a", category: "COOLING", timeSlot: "DAY" },
      { id: "b", category: "LIGHTING", timeSlot: "EVENING" },
      { id: "c", category: "KITCHEN", timeSlot: "ANYTIME" },
    ];
    const { selectedPoolIds, relaxations } = selectDailyMissions({
      pool,
      previousPoolIds: ["a", "b", "c"],
      rng: seededRng(1),
    });
    expect(selectedPoolIds).toEqual(["a", "b", "c"]);
    expect(relaxations).toContain("previous_day_filter_relaxed");
  });

  it("풀이 3개 미만이면 throw", () => {
    const pool: PoolItem[] = [
      { id: "a", category: "COOLING", timeSlot: "DAY" },
      { id: "b", category: "LIGHTING", timeSlot: "EVENING" },
    ];
    expect(() =>
      selectDailyMissions({ pool, previousPoolIds: [], rng: seededRng(1) }),
    ).toThrow();
  });
});
