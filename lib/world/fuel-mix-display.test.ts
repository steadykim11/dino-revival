import { describe, expect, it } from "vitest";
import type { FuelMix } from "@/lib/types/fuel-mix";
import { buildDisplayFuelMix } from "./fuel-mix-display";

const ZERO: FuelMix = {
  hydro: 0,
  oil: 0,
  coal: 0,
  nuclear: 0,
  pumped: 0,
  gas: 0,
  coalDomestic: 0,
  solarMarket: 0,
  wind: 0,
  renewable: 0,
  ppa: 0,
  btm: 0,
};

function toMap(percent: FuelMix) {
  return Object.fromEntries(
    buildDisplayFuelMix(percent).map((s) => [s.key, s.percent]),
  );
}

describe("buildDisplayFuelMix", () => {
  it("12종을 6개 표시 그룹으로 묶는다", () => {
    const m = toMap({
      ...ZERO,
      coal: 0.2,
      coalDomestic: 0.05,
      gas: 0.25,
      nuclear: 0.3,
      renewable: 0.02,
      solarMarket: 0.03,
      wind: 0.01,
      btm: 0.04,
      hydro: 0.02,
      pumped: 0.01,
      oil: 0.03,
      ppa: 0.04,
    });
    expect(m.coal).toBeCloseTo(0.25);
    expect(m.gas).toBeCloseTo(0.25);
    expect(m.nuclear).toBeCloseTo(0.3);
    expect(m.renewable).toBeCloseTo(0.1);
    expect(m.hydro).toBeCloseTo(0.03);
    expect(m.other).toBeCloseTo(0.07);
  });

  it("그룹 순서는 고정", () => {
    expect(buildDisplayFuelMix(ZERO).map((s) => s.key)).toEqual([
      "coal",
      "gas",
      "nuclear",
      "renewable",
      "hydro",
      "other",
    ]);
  });

  it("합이 1보다 작으면 잔차를 기타에 흡수해 합이 1이 된다", () => {
    const slices = buildDisplayFuelMix({ ...ZERO, coal: 0.4, gas: 0.3 });
    const sum = slices.reduce((s, x) => s + x.percent, 0);
    expect(sum).toBeCloseTo(1);
    expect(slices.find((s) => s.key === "other")!.percent).toBeCloseTo(0.3);
  });

  it("음수 pumped는 수력에 더하지 않는다", () => {
    const m = toMap({ ...ZERO, hydro: 0.1, pumped: -0.2, nuclear: 0.9 });
    expect(m.hydro).toBeCloseTo(0.1);
  });
});
