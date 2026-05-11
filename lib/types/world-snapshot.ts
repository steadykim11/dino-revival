import { FuelMix } from "./fuel-mix";

/**
 * 5분 단위 전력망 상태 = DB(WorldSnapshot)와 1:1 매핑되는 도메인 타입
 * Decimal 컬럼은 number로 변환된 상태
 */

export type WorldSnapshotData = {
  ts: Date; // 5분 단위 정규화된 시각 (UTC)
  carbonIntensity: number; // gCO2/kWh
  supplyReserveRate: number; // %
  supplyCapacity: number; // MW
  currentLoad: number; // MW
  temperature: number | null; // °C (응답에 없으면 null)
  fuelMix: FuelMix;
};

/**
 * GET /api/world/state 응답 타입
 *
 * - 도메인 타입(WorldSnapshotData)과 달리 ts가 ISO string
 * - 던전 상태 포함
 * - fuelMixPercent의 분모는 "mw > 0인 항목 합" (kpx.ts의 탄소강도 계산과 동일 기준)
 */

export type Battlefield = "PURIFIED" | "NORMAL" | "POLLUTED";

export interface WorldStateResponse {
  ts: string; // ISO
  world: {
    carbonIntensity: number;
    supplyReserveRate: number;
    supplyCapacity: number;
    currentLoad: number;
    temperature: number | null;
    fuelMix: FuelMix; // 12종, MW (양수충전 시 pumped 음수 가능)
    fuelMixPercent: FuelMix; // 12종, 0~1. 분모는 mw>0 항목 합
    battlefield: Battlefield;
    isFallback: boolean;
  };
  dungeon:
    | { active: false; instance: null }
    | {
        active: true;
        instance: {
          id: string;
          type: "PEAK";
          activatedAt: string;
          expiresAt: string;
          remainingSec: number;
          triggerReserveRate: number | null;
          triggerCarbonIntensity: number | null;
        };
      };
}
