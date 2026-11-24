// 더미 사용자의 일상 활동 (ADR 44). 순수 함수.
//
// 시드는 과거 21일치 기록만 만들어, 시즌(월)이 바뀌면 더미 길드 점수가 0이 된다.
// 수집 작업이 20분마다 "지금까지 끝냈어야 할" 더미 완료 기록을 계획하고 넣는다.
// 기록 ID가 (사용자, 날짜, 슬롯)으로 정해지므로 몇 번을 다시 돌려도 같은 기록은 한 번만 들어간다.

import type { DinoStage } from "@/lib/dino/types";
import type { MissionCategory } from "@/lib/missions/types";
import { calculateCo2Reduced } from "@/lib/missions/reward-calculator";
import { kstDateStringDaysAgo, kstDateTime } from "@/lib/time/kst";
import { hashInt, hashRangeOf, hashToUuid } from "./dummy-hash";

export interface DummyActor {
  userId: string;
  guildId: string;
  stage: DinoStage;
}

export interface ActivityPoolEntry {
  id: string;
  title: string;
  category: MissionCategory;
  baseReward: number;
  estimatedKwh: number;
}

export interface DummyActivityLog {
  id: string;
  userId: string;
  guildId: string;
  missionId: null;
  missionTitle: string;
  missionType: "DAILY";
  missionCategory: MissionCategory;
  carbonIntensityAtCompletion: number;
  cleanEnergyEarned: number;
  co2ReducedKg: number;
  intimacyEarned: number;
  stageBefore: DinoStage;
  stageAfter: DinoStage;
  completedAt: Date;
}

/** 하루 미션 슬롯 (KST 시작 시각, 최대 지연 시간) — 일일 미션 3개와 같은 수 */
const SLOTS = [
  { hour: 8, spread: 3 },
  { hour: 13, spread: 3 },
  { hour: 19, spread: 4 },
] as const;

/** 오늘과 어제를 계획한다 — 수집이 밤사이 건너뛰어도 다음 실행이 어제 몫을 채운다 */
export const PLAN_DAYS = 2;

/** 사용자별 활동률 (%) — 슬롯마다 이 확률로 미션을 완료한다 */
export function dummyActivityRate(userId: string): number {
  return hashRangeOf(`activity-rate-${userId}`, 20, 90);
}

/**
 * now까지 완료됐어야 할 더미 기록 (오늘·어제, KST).
 * 같은 입력이면 항상 같은 결과다. pool이 비면 빈 배열.
 */
export function planDummyActivity(
  actors: DummyActor[],
  pool: ActivityPoolEntry[],
  now: Date,
): DummyActivityLog[] {
  if (pool.length === 0) return [];
  const sortedPool = [...pool].sort((a, b) => a.id.localeCompare(b.id));

  const logs: DummyActivityLog[] = [];
  for (let daysAgo = PLAN_DAYS - 1; daysAgo >= 0; daysAgo--) {
    const date = kstDateStringDaysAgo(now, daysAgo);
    for (const actor of actors) {
      const rate = dummyActivityRate(actor.userId);
      SLOTS.forEach((slot, s) => {
        const seed = `${actor.userId}-${date}-${s}`;
        if (hashInt(`activity-done-${seed}`) % 100 >= rate) return;

        const completedAt = kstDateTime(
          date,
          slot.hour + hashRangeOf(`activity-hour-${seed}`, 0, slot.spread),
          hashRangeOf(`activity-minute-${seed}`, 0, 59),
        );
        if (completedAt > now) return;

        const picked =
          sortedPool[hashRangeOf(`activity-pool-${seed}`, 0, sortedPool.length - 1)];
        logs.push({
          id: hashToUuid(`dummy-activity-${seed}`),
          userId: actor.userId,
          guildId: actor.guildId,
          missionId: null,
          missionTitle: picked.title,
          missionType: "DAILY",
          missionCategory: picked.category,
          carbonIntensityAtCompletion: hashRangeOf(`activity-carbon-${seed}`, 250, 600),
          cleanEnergyEarned: Math.max(
            1,
            picked.baseReward + hashRangeOf(`activity-jitter-${seed}`, -3, 5),
          ),
          co2ReducedKg: calculateCo2Reduced(picked.estimatedKwh),
          intimacyEarned: 1,
          stageBefore: actor.stage,
          stageAfter: actor.stage,
          completedAt,
        });
      });
    }
  }
  return logs;
}
