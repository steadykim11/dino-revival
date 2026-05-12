// lib/world/snapshot-reader.ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FuelMixSchema, type FuelMix } from "@/lib/types/fuel-mix";
import type {
  WorldStateResponse,
  Battlefield,
} from "@/lib/types/world-snapshot";
import { classifyBattlefield } from "./battlefield";
import { getTodayForecast } from "./peak-forecast";

/**
 * Prisma Decimal | string | number | null 을 number로.
 */
function toNum(v: Prisma.Decimal | string | number | null): number;
function toNum(
  v: Prisma.Decimal | string | number | null,
  fallback: number,
): number;
function toNum(
  v: Prisma.Decimal | string | number | null,
  fallback?: number,
): number {
  if (v === null || v === undefined) return fallback ?? 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return v.toNumber();
}

/**
 * DB의 fuelMix JSON을 Zod로 검증해 FuelMix로 변환.
 * 스키마 위반 시 throw — 적재 단계에서 이미 통과한 데이터이므로 정상 흐름에선 발생 X.
 */
function parseFuelMix(raw: unknown): FuelMix {
  return FuelMixSchema.parse(raw);
}

/**
 * 발전믹스 비율 계산.
 * 분모는 mw > 0인 항목 합 (kpx.ts의 calcCarbonIntensity와 동일 기준).
 * 음수 항목(양수발전 충전 중)은 비율 0으로.
 */
function computePercent(mix: FuelMix): FuelMix {
  const keys = Object.keys(mix) as (keyof FuelMix)[];
  let total = 0;
  for (const k of keys) {
    if (mix[k] > 0) total += mix[k];
  }
  const out = {} as FuelMix;
  for (const k of keys) {
    out[k] = total > 0 && mix[k] > 0 ? mix[k] / total : 0;
  }
  return out;
}

/**
 * /world/state 응답을 빌드.
 * snapshot 없으면 null 반환 (라우트가 503 처리).
 */
export async function readWorldState(): Promise<WorldStateResponse | null> {
  const now = new Date();

  const [snapshot, dungeon] = await Promise.all([
    prisma.worldSnapshot.findFirst({ orderBy: { ts: "desc" } }),
    prisma.dungeon.findFirst({
      where: { isActive: true, expiresAt: { gt: now } },
      orderBy: { activatedAt: "desc" },
    }),
  ]);

  if (!snapshot) return null;

  const fuelMix = parseFuelMix(snapshot.fuelMix);
  const fuelMixPercent = computePercent(fuelMix);
  const carbonIntensity = toNum(snapshot.carbonIntensity);
  const battlefield: Battlefield = classifyBattlefield(carbonIntensity);

  const todayForecast = getTodayForecast(now);

  return {
    ts: snapshot.ts.toISOString(),
    world: {
      carbonIntensity,
      supplyReserveRate: toNum(snapshot.supplyReserveRate),
      supplyCapacity: snapshot.supplyCapacity,
      currentLoad: snapshot.currentLoad,
      temperature:
        snapshot.temperature === null ? null : toNum(snapshot.temperature),
      fuelMix,
      fuelMixPercent,
      battlefield,
      isFallback: snapshot.isFallback,
    },
    dungeon: dungeon
      ? {
          active: true,
          instance: {
            id: dungeon.id,
            type: "PEAK", // MVP는 단일 종류, Phase 2에서 컬럼화
            activatedAt: dungeon.activatedAt.toISOString(),
            expiresAt: dungeon.expiresAt.toISOString(),
            remainingSec: Math.max(
              0,
              Math.floor((dungeon.expiresAt.getTime() - now.getTime()) / 1000),
            ),
            triggerReserveRate:
              dungeon.triggerReserveRate === null
                ? null
                : toNum(dungeon.triggerReserveRate),
            triggerCarbonIntensity:
              dungeon.triggerCarbonIntensity === null
                ? null
                : toNum(dungeon.triggerCarbonIntensity),
          },
        }
      : { active: false, instance: null },
    todayForecast,
  };
}
