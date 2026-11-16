// 상단 누적 카드 3개 — 클린에너지·CO2·완료 미션 수
// 와이어프레임 SC-10 상단 영역. 3열 그리드.

import type { MeStats } from "@/lib/stats/me-stats.server";

interface Props {
  stats: MeStats;
}

export function SummaryCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Card
        label="클린에너지"
        value={stats.totalCleanEnergy.toLocaleString()}
        unit=""
      />
      <Card
        label="CO₂ 감축"
        value={stats.totalCo2ReducedKg.toFixed(1)}
        unit="kg"
      />
      <Card
        label="완료 미션"
        value={stats.completedMissionsCount.toLocaleString()}
        unit="회"
      />
    </div>
  );
}

function Card({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
      <p className="text-[10px] text-stone-500">{label}</p>
      <p className="mt-1 text-base font-bold tabular-nums text-stone-900">
        {value}
        {unit && (
          <span className="ml-0.5 text-[10px] font-normal text-stone-400">
            {unit}
          </span>
        )}
      </p>
    </div>
  );
}
