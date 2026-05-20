// SC-09 던전 페이지의 적 시각화 배너
// EnemyDisplay는 components/battle 재사용

import type { EnemyMeta } from "@/lib/battle/enemy-types";
import { EnemyDisplay } from "@/components/battle/enemy-display";

interface DungeonEnemyBannerProps {
  enemy: EnemyMeta;
  carbonIntensity: number;
  supplyReserveRate: number;
}

export function DungeonEnemyBanner({
  enemy,
  carbonIntensity,
  supplyReserveRate,
}: DungeonEnemyBannerProps) {
  return (
    <section
      className="rounded-2xl border border-stone-200 bg-white px-4 py-5 text-center"
      aria-label="던전 적 정보"
    >
      {/* 위기 상황 pill */}
      <div className="mb-4 inline-block rounded-full bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700">
        위기 상황 — 예비율 {supplyReserveRate.toFixed(1)}%
      </div>

      {/* 큰 적 SVG */}
      <div className="mb-3 flex justify-center">
        <EnemyDisplay meta={enemy} size={140} />
      </div>

      {/* 적 이름·탄소강도 */}
      <div className="text-base font-semibold text-stone-900">{enemy.name}</div>
      <div className="mt-1 text-xs text-stone-500 tabular-nums">
        탄소강도 {Math.round(carbonIntensity)} gCO₂/kWh
      </div>
    </section>
  );
}
