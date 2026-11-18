import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchWorldSnapshot } from "@/lib/external/kpx";
import { ExternalApiError } from "@/lib/external/http";
import type { WorldSnapshotData } from "@/lib/world/types";

export type WriteResult =
  | { kind: "success"; ts: Date; carbonIntensity: number }
  | { kind: "fallback"; reason: string; lastTs: Date | null };

/**
 * KPX에서 데이터를 가져와 WorldSnapshot에 UPSERT. 수집 작업(jobs/collect.ts)이 호출.
 *
 * 외부 API 실패 시에는 아무것도 기록하지 않는다 (kind: "fallback").
 * 직전 스냅샷이 그대로 최신값으로 남고, 오래되면 읽는 쪽에서
 * 지연으로 판정한다 (lib/world/staleness.ts).
 *
 * DB 오류는 throw.
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

    return { kind: "fallback", reason, lastTs: last?.ts ?? null };
  }

  const values = {
    carbonIntensity: new Prisma.Decimal(data.carbonIntensity),
    supplyReserveRate: new Prisma.Decimal(data.supplyReserveRate),
    supplyCapacity: data.supplyCapacity,
    currentLoad: data.currentLoad,
    fuelMix: data.fuelMix as unknown as Prisma.InputJsonValue,
  };

  // 같은 ts로 재호출되면 갱신 (idempotent)
  await prisma.worldSnapshot.upsert({
    where: { ts: data.ts },
    create: { ts: data.ts, ...values },
    update: values,
  });

  return {
    kind: "success",
    ts: data.ts,
    carbonIntensity: data.carbonIntensity,
  };
}
