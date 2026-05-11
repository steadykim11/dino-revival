import type { DisplayFuelSlice } from "@/lib/world/fuel-mix-display";

interface Props {
  slices: DisplayFuelSlice[];
}

export function FuelMixBar({ slices }: Props) {
  const labeled = slices.filter((s) => s.key !== "other");

  return (
    <div className="space-y-1.5">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
        {slices.map((s) => (
          <div
            key={s.key}
            style={{
              width: `${s.percent * 100}%`,
              backgroundColor: s.color,
            }}
            aria-label={`${s.label} ${(s.percent * 100).toFixed(1)}%`}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-stone-600">
        {labeled.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            <span>{s.label}</span>
            <span className="tabular-nums">{Math.round(s.percent * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
