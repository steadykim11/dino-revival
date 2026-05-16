// 사용자 1명에게 오늘의 미션 3개를 선정하는 도메인 로직.
// 시간대 분산: DAY 1개 + EVENING 1개 + ANYTIME 1개 (슬롯 기반)
//
// 알고리즘:
//  1) 풀을 시간대별로 분리 (DAY / EVENING / ANYTIME)
//  2) 직전일 사용한 풀 ID 제외
//  3) 각 슬롯에서 무작위 1개씩 뽑되, 이미 뽑힌 카테고리는 회피
//  4) 슬롯이 비면 ANYTIME으로 폴백 → 그래도 비면 제약 완화 (카테고리 중복 허용)

import type {
  MissionPool,
  MissionCategory,
  MissionTimeSlot,
} from "@prisma/client";

export interface SelectInput {
  // isActive=true 미션 풀 전체
  pool: Pick<MissionPool, "id" | "category" | "timeSlot">[];
  // 어제 사용자가 받았던 미션의 poolId 목록 (중복 회피용)
  previousPoolIds: string[];
  // 테스트 주입용 RNG (0~1). 기본 Math.random
  rng?: () => number;
}

export interface SelectResult {
  // 선정된 풀 ID 3개 (slot 순: DAY, EVENING, ANYTIME)
  selectedPoolIds: string[];
  // 디버깅용: 어떤 제약이 완화됐는지
  relaxations: string[];
}

const SLOT_ORDER: MissionTimeSlot[] = ["DAY", "EVENING", "ANYTIME"];

export function selectDailyMissions(input: SelectInput): SelectResult {
  const { pool, previousPoolIds, rng = Math.random } = input;
  const relaxations: string[] = [];

  // 직전일 제외 + 활성만
  let candidates = pool.filter((m) => !previousPoolIds.includes(m.id));
  if (candidates.length < 3) {
    // 풀이 너무 작아 직전일 제외 못함 → 제약 완화
    candidates = [...pool];
    relaxations.push("previous_day_filter_relaxed");
  }

  const selected: typeof candidates = [];
  const usedCategories = new Set<MissionCategory>();

  for (const slot of SLOT_ORDER) {
    let slotCandidates = candidates.filter(
      (m) =>
        m.timeSlot === slot &&
        !usedCategories.has(m.category) &&
        !selected.includes(m),
    );

    // 슬롯에 후보 없으면 ANYTIME으로 폴백
    if (slotCandidates.length === 0 && slot !== "ANYTIME") {
      slotCandidates = candidates.filter(
        (m) =>
          m.timeSlot === "ANYTIME" &&
          !usedCategories.has(m.category) &&
          !selected.includes(m),
      );
      if (slotCandidates.length > 0) {
        relaxations.push(`${slot}_fallback_to_anytime`);
      }
    }

    // 그래도 비면 카테고리 중복 허용 (전체 후보에서 선정)
    if (slotCandidates.length === 0) {
      slotCandidates = candidates.filter((m) => !selected.includes(m));
      if (slotCandidates.length > 0) {
        relaxations.push(`${slot}_category_dedup_relaxed`);
      }
    }

    if (slotCandidates.length === 0) {
      // 풀에 3개 미만이라 발생. 호출자가 사전 검증해야 함
      throw new Error(`Mission pool too small to fill slot ${slot}`);
    }

    const picked = slotCandidates[Math.floor(rng() * slotCandidates.length)];
    selected.push(picked);
    usedCategories.add(picked.category);
  }

  return {
    selectedPoolIds: selected.map((m) => m.id),
    relaxations,
  };
}
