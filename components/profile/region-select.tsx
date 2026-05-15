// 시·도별 optgroup으로 그룹화된 동네 select

"use client";

import { REGIONS_BY_PROVINCE } from "@/lib/static-data/regions";

export interface RegionSelectProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function RegionSelect({
  value,
  onChange,
  disabled,
  placeholder = "시·군·구 선택",
}: RegionSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required
      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 disabled:bg-stone-50 disabled:text-stone-400"
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {Array.from(REGIONS_BY_PROVINCE.entries()).map(([province, regions]) => (
        <optgroup key={province} label={province}>
          {regions.map((r) => (
            <option key={r.code} value={r.code}>
              {r.displayName}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
