"use client";

import { useEffect, useState } from "react";
import { useWorldState } from "@/lib/hooks/use-world-state";
import { buildDisplayFuelMix } from "@/lib/world/fuel-mix-display";
import { battlefieldLabel } from "@/lib/world/battlefield";
import { relativeTimeKo } from "@/lib/time/relative";
import { FuelMixBar } from "./fuel-mix-bar";

export function CarbonClock() {
  const { data, status } = useWorldState();

  // "방금 전" → "1분 전" 자동 갱신용
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (status === "unavailable" || (status === "loading" && !data) || !data) {
    return (
      <CarbonClockSkeleton
        message={
          status === "unavailable"
            ? "데이터 준비 중입니다"
            : "데이터 불러오는 중…"
        }
      />
    );
  }

  const { world, ts } = data;
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
        <span className="text-[11px] text-stone-500">{relativeTimeKo(ts)}</span>
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
    </section>
  );
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
