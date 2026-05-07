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
