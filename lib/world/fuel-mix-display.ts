// lib/world/fuel-mix-display.ts
import type { FuelMix } from "@/lib/types/fuel-mix";

export type DisplayFuelKey =
  | "coal" // 석탄 = coal + coalDomestic
  | "gas" // 가스
  | "nuclear" // 원자력
  | "renewable" // 신재생 = renewable + solarMarket + wind + btm
  | "hydro" // 수력 = hydro + max(0, pumped)
  | "other"; // 기타 = oil + ppa + 잔차 (라벨 노출 X)

export interface DisplayFuelSlice {
  key: DisplayFuelKey;
  label: string;
  percent: number; // 0~1
  color: string;
}

const LABELS: Record<DisplayFuelKey, string> = {
  coal: "석탄",
  gas: "가스",
  nuclear: "원자력",
  renewable: "신재생",
  hydro: "수력",
  other: "기타",
};

// 색상은 임시 — D21 폴리싱 단계에서 토큰화 권장
const COLORS: Record<DisplayFuelKey, string> = {
  coal: "#6b6258",
  gas: "#c9a16b",
  nuclear: "#a8b5c4",
  renewable: "#7fb069",
  hydro: "#6ba4c4",
  other: "#d4cfc4",
};

/**
 * 12종 raw 비율을 표시용 5+1종으로 그룹화.
 * 입력 percent는 snapshot-reader의 computePercent 결과(분모 = mw>0 항목 합).
 *
 * 음수 처리:
 * - pumped는 충전 중 음수 가능. percent 단계에서 이미 0으로 처리되어 들어옴.
 *   여기선 max(0, ...) 한 번 더 가드해 시각화 깨짐 방지.
 * - 합이 1보다 작으면(반올림 등) 잔차를 other에 흡수.
 */
export function buildDisplayFuelMix(percent: FuelMix): DisplayFuelSlice[] {
  const grouped: Record<DisplayFuelKey, number> = {
    coal: (percent.coal ?? 0) + (percent.coalDomestic ?? 0),
    gas: percent.gas ?? 0,
    nuclear: percent.nuclear ?? 0,
    renewable:
      (percent.renewable ?? 0) +
      (percent.solarMarket ?? 0) +
      (percent.wind ?? 0) +
      (percent.btm ?? 0),
    hydro: (percent.hydro ?? 0) + Math.max(0, percent.pumped ?? 0),
    other: (percent.oil ?? 0) + (percent.ppa ?? 0),
  };

  const sum = Object.values(grouped).reduce((s, v) => s + v, 0);
  const residual = Math.max(0, 1 - sum);
  grouped.other += residual;

  return (Object.keys(grouped) as DisplayFuelKey[]).map((key) => ({
    key,
    label: LABELS[key],
    percent: grouped[key],
    color: COLORS[key],
  }));
}
