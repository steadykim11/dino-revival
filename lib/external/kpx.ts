import { fetchKpxD1 } from "./kpx-d1";
import { fetchKpxD2 } from "./kpx-d2";
import { WorldSnapshotData } from "@/lib/types/world-snapshot";
import { FuelMix } from "@/lib/types/fuel-mix";

/**
 * 탄소 배출계수 (gCO2/kWh)
 * 임시 추정치, D9에 환경부 공시값으로 교체
 *
 * 양수발전(pumped): 충전 시 음수, 방전 시 양수. 계수는 충전 전력의 평균을 가정
 * 여기선 hydro와 동일 처리. 정밀 모델링은 후순위
 * PPA: 자가발전 발전원 미상 → 평균값(전국 평균 추정 400) 적용
 * BTM: 태양광이라 신재생과 동일 처리
 */
const EMISSION_FACTOR: Record<keyof FuelMix, number> = {
  coal: 820,
  coalDomestic: 970,
  gas: 490,
  oil: 650,
  nuclear: 12,
  hydro: 24,
  pumped: 24,
  solarMarket: 41,
  wind: 11,
  renewable: 41,
  btm: 41,
  ppa: 400, // 자가발전 평균 추정
};

/**
 * 평균 탄소강도 (gCO2/kWh) = Σ(발전량 × 계수) / Σ(발전량)
 * 음수 발전(양수 충전)은 분모에서 제외 (음의 발전 x, 부하)
 */
export function calcCarbonIntensity(mix: FuelMix): number {
  let weighted = 0;
  let total = 0;
  for (const [key, mw] of Object.entries(mix) as [keyof FuelMix, number][]) {
    if (mw <= 0) continue; // 충전 중인 양수 등 제외
    weighted += mw * EMISSION_FACTOR[key];
    total += mw;
  }
  return total > 0 ? weighted / total : 0;
}

// KPX D1·D2를 병렬 호출하고 통합 스냅샷으로 반환
export async function fetchWorldSnapshot(): Promise<WorldSnapshotData> {
  const [d1, d2] = await Promise.all([fetchKpxD1(), fetchKpxD2()]);

  const carbonIntensity = calcCarbonIntensity(d2.fuelMix);

  // ts는 D1·D2 중 더 최근값을 5분 정규화
  const latestTs = d1.ts > d2.ts ? d1.ts : d2.ts;

  return {
    ts: normalizeTo5Min(latestTs),
    carbonIntensity: Math.round(carbonIntensity * 100) / 100,
    supplyReserveRate: Math.round(d1.supplyReserveRate * 100) / 100,
    supplyCapacity: Math.round(d1.supplyCapacity),
    currentLoad: Math.round(d1.currentLoad),
    temperature: null,
    fuelMix: d2.fuelMix,
  };
}

// 5분 단위로 내림 정규화 (UTC)
function normalizeTo5Min(d: Date): Date {
  const ms = d.getTime();
  const fiveMin = 5 * 60 * 1000;
  return new Date(Math.floor(ms / fiveMin) * fiveMin);
}
