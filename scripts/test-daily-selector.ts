// 자정 선정 알고리즘 콘솔 검증.
// 풀에서 100회 시뮬레이션 돌려 카테고리·시간대 분포가 예상대로 나오는지 확인.
//
// 실행: pnpm tsx scripts/test-daily-selector.ts

import { prisma } from "../lib/prisma";
import { selectDailyMissions } from "../lib/missions/daily-selector";

async function main() {
  const pool = await prisma.missionPool.findMany({
    where: { isActive: true },
    select: { id: true, category: true, timeSlot: true, title: true },
  });
  console.log(`Pool size: ${pool.length}`);
  console.log(
    `  DAY=${pool.filter((p) => p.timeSlot === "DAY").length} ` +
      `EVENING=${pool.filter((p) => p.timeSlot === "EVENING").length} ` +
      `ANYTIME=${pool.filter((p) => p.timeSlot === "ANYTIME").length}`,
  );

  const N = 1000;
  const slotCounts = { DAY: 0, EVENING: 0, ANYTIME: 0 };
  const categoryDupes = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const allRelaxations: Record<string, number> = {};
  const titleFreq: Record<string, number> = {};

  for (let i = 0; i < N; i++) {
    const { selectedPoolIds, relaxations } = selectDailyMissions({
      pool,
      previousPoolIds: [],
    });
    const picked = selectedPoolIds.map((id) => pool.find((p) => p.id === id)!);

    for (const p of picked) {
      slotCounts[p.timeSlot]++;
      titleFreq[p.title] = (titleFreq[p.title] ?? 0) + 1;
    }
    const uniqueCats = new Set(picked.map((p) => p.category)).size;
    const dupes = 3 - uniqueCats;
    categoryDupes[dupes as 0 | 1 | 2 | 3]++;
    for (const r of relaxations) {
      allRelaxations[r] = (allRelaxations[r] ?? 0) + 1;
    }
  }

  console.log(`\n[${N}회 시뮬레이션]`);
  console.log(`Slot picks (각 ${N}이어야):`, slotCounts);
  console.log(`Category duplicates (0이 ${N}이어야 이상적):`, categoryDupes);
  console.log(`Relaxations (적을수록 좋음):`, allRelaxations);
  console.log(`\nTitle frequency (편향 체크):`);
  Object.entries(titleFreq)
    .sort((a, b) => b[1] - a[1])
    .forEach(([t, c]) => console.log(`  ${c.toString().padStart(4)} - ${t}`));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
