import { z } from "zod";

/**
 * 발전원별 발전량 (MW)
 *
 * 양수발전(pumped)은 충전 중 음수가 될 수 있음 (전력 소비에 의해)
 * BTM(btm)은 시장 거래 외 자가소비 태양광 추정치
 * PPA(ppa)는 자가발전 추정치 (발전원 미상이라 탄소강도 계산은 가중평균 적용)
 */

export const FuelMixSchema = z.object({
  hydro: z.number(),
  oil: z.number(),
  coal: z.number(), // 유연탄
  nuclear: z.number(),
  pumped: z.number(), // 양수 (음수 가능)
  gas: z.number(),
  coalDomestic: z.number(), // 국내탄 (무연탄)
  solarMarket: z.number(), // 태양광(시장)
  wind: z.number(),
  renewable: z.number(), // 신재생 (기타)
  ppa: z.number(), // PPA 자가발전
  btm: z.number(), // BTM 자가소비 태양광
});

export type FuelMix = z.infer<typeof FuelMixSchema>;

// 시장수요(현재) — KPX의 fuelPwrTot. 합계 아님!!
export type MarketDemand = number;
