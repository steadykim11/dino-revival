"use client";

import { useNow, useWorldState } from "./world-state-provider";
import { buildDisplayFuelMix } from "@/lib/world/fuel-mix-display";
import { battlefieldLabel } from "@/lib/world/battlefield";
import { relativeTimeKo } from "@/lib/time/relative";
import { FuelMixBar } from "./fuel-mix-bar";
import { ForecastLevel } from "@/lib/world/types";

export function CarbonClock() {
  const { data } = useWorldState();

  // "방금 전" → "1분 전" 자동 갱신용
  const now = useNow(60_000);

  // 스냅샷이 아직 하나도 없음
  if (!data) {
    return <CarbonClockSkeleton message="데이터 준비 중입니다" />;
  }

  const { world, ts, todayForecast } = data;
  const slices = buildDisplayFuelMix(world.fuelMixPercent);

  return (
    <section
      className="rounded-2xl bg-stone-50 p-4 shadow-sm"
      aria-label="탄소 시계"
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-medium text-stone-700">
          탄소 시계 — {battlefieldLabel(world.battlefield)}
        </h2>
        <span
          className={`text-[11px] ${world.isStale ? "font-medium text-amber-600" : "text-stone-500"}`}
        >
          {world.isStale && "데이터 지연 · "}
          {relativeTimeKo(ts, new Date(now))}
        </span>
      </div>

      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tabular-nums text-stone-900">
            {Math.round(world.carbonIntensity)}
          </span>
          <span className="text-xs text-stone-500">gCO₂/kWh</span>
        </div>
        <div className="text-xs text-stone-600">
          예비율{" "}
          <span className="font-medium tabular-nums text-stone-800">
            {world.supplyReserveRate.toFixed(1)}%
          </span>
        </div>
      </div>

      <FuelMixBar slices={slices} />

      {todayForecast && (
        <div className="mt-2.5 border-t border-stone-200 pt-2 text-[11px] text-stone-600">
          예상 최대부하{" "}
          <span
            className={`font-medium tabular-nums ${forecastLevelColor(todayForecast.level)}`}
          >
            {todayForecast.peakLoadGW.toFixed(1)}GW
          </span>
        </div>
      )}
    </section>
  );
}

function forecastLevelColor(level: ForecastLevel | null): string {
  switch (level) {
    case null:
      return "text-stone-800"; // 비교할 과거 기록이 아직 모자람
    case "LOW":
      return "text-emerald-700";
    case "MEDIUM":
      return "text-amber-700";
    case "HIGH":
      return "text-rose-700";
  }
}

function CarbonClockSkeleton({ message }: { message: string }) {
  return (
    <section
      className="rounded-2xl bg-stone-50 p-4 shadow-sm"
      aria-label="탄소 시계"
      aria-busy="true"
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-medium text-stone-500">탄소 시계</h2>
        <span className="text-[11px] text-stone-400">—</span>
      </div>
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tabular-nums text-stone-300">
            ---
          </span>
          <span className="text-xs text-stone-400">gCO₂/kWh</span>
        </div>
        <div className="text-xs text-stone-400">예비율 --%</div>
      </div>
      <div className="h-2.5 w-full rounded-full bg-stone-200" />
      <p className="mt-2 text-[11px] text-stone-400">{message}</p>
    </section>
  );
}
