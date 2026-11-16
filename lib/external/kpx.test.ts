import { describe, expect, it } from "vitest";
import type { FuelMix } from "@/lib/types/fuel-mix";
import { calcCarbonIntensity } from "./kpx";

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

describe("calcCarbonIntensity", () => {
  it("단일 발전원이면 그 배출계수 그대로", () => {
    expect(calcCarbonIntensity({ ...ZERO, coal: 1000 })).toBe(820);
    expect(calcCarbonIntensity({ ...ZERO, nuclear: 1000 })).toBe(12);
  });

  it("발전량 가중평균", () => {
    // (1000×820 + 1000×12) / 2000 = 416
    expect(calcCarbonIntensity({ ...ZERO, coal: 1000, nuclear: 1000 })).toBe(
      416,
    );
    // (3000×490 + 1000×12) / 4000 = 370.5
    expect(calcCarbonIntensity({ ...ZERO, gas: 3000, nuclear: 1000 })).toBe(
      370.5,
    );
  });

  it("음수 항목(양수발전 충전)은 분자·분모에서 모두 제외", () => {
    expect(
      calcCarbonIntensity({ ...ZERO, coal: 1000, nuclear: 1000, pumped: -500 }),
    ).toBe(416);
  });

  it("발전량이 전혀 없으면 0", () => {
    expect(calcCarbonIntensity(ZERO)).toBe(0);
    expect(calcCarbonIntensity({ ...ZERO, pumped: -300 })).toBe(0);
  });
});
