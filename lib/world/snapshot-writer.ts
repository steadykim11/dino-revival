import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchWorldSnapshot } from "@/lib/external/kpx";
import { ExternalApiError } from "@/lib/external/http";
import type { WorldSnapshotData } from "@/lib/types/world-snapshot";

export type WriteResult =
  | { kind: "success"; ts: Date; carbonIntensity: number }
  | { kind: "fallback"; reason: string; lastTs: Date | null }
  | { kind: "failed"; reason: string };

/**
 * KPX에서 데이터 가져와 WorldSnapshot에 UPSERT.
 *
 * 외부 API 실패 시 fallback 정책:
 *   직전 스냅샷이 있으면 새로 INSERT 하지 않음 (직전값이 그대로 유효).
 *   "isFallback 플래그를 유지"한다는 의미는 직전 스냅샷의 값이 계속 노출된다는 뜻.
 *   별도의 fallback 레코드를 만들지 않음 — DB가 깔끔하게 유지됨.
 */
export async function captureWorldSnapshot(): Promise<WriteResult> {
  let data: WorldSnapshotData;

  try {
    data = await fetchWorldSnapshot();
  } catch (err) {
    const reason =
      err instanceof ExternalApiError
        ? `${err.kind}: ${err.message}`
        : err instanceof Error
          ? err.message
          : "unknown";

    const last = await prisma.worldSnapshot.findFirst({
      orderBy: { ts: "desc" },
      select: { ts: true },
    });

    console.warn(`[snapshot] external fetch failed (${reason}). Falling back.`);
    return { kind: "fallback", reason, lastTs: last?.ts ?? null };
  }

  // UPSERT — 같은 ts로 재호출되면 갱신 (idempotent).
  await prisma.worldSnapshot.upsert({
    where: { ts: data.ts },
    create: {
      ts: data.ts,
      carbonIntensity: new Prisma.Decimal(data.carbonIntensity),
      supplyReserveRate: new Prisma.Decimal(data.supplyReserveRate),
      supplyCapacity: data.supplyCapacity,
      currentLoad: data.currentLoad,
      temperature:
        data.temperature !== null ? new Prisma.Decimal(data.temperature) : null,
      fuelMix: data.fuelMix as unknown as Prisma.InputJsonValue,
      isFallback: false,
    },
    update: {
      carbonIntensity: new Prisma.Decimal(data.carbonIntensity),
      supplyReserveRate: new Prisma.Decimal(data.supplyReserveRate),
      supplyCapacity: data.supplyCapacity,
      currentLoad: data.currentLoad,
      temperature:
        data.temperature !== null ? new Prisma.Decimal(data.temperature) : null,
      fuelMix: data.fuelMix as unknown as Prisma.InputJsonValue,
      isFallback: false,
    },
  });

  return {
    kind: "success",
    ts: data.ts,
    carbonIntensity: data.carbonIntensity,
  };
}
