// 최근 7일 탄소강도 — 시간별 평균으로 다운샘플
// - 원본: 5분 단위 × 7일 = 2,016행
// - 다운샘플: 시간별 평균 × 7일 = 168행 (라인차트 적정)
// - DB 측 집계: Prisma raw $queryRaw로 date_trunc + avg

import type { PrismaClient } from "@prisma/client";

export interface CarbonIntensityPoint {
  /** ISO 시각 (UTC, 시간 단위로 truncated) */
  ts: string;
  /** 시간 평균 탄소강도 (gCO2/kWh) */
  carbonIntensity: number;
}

interface CarbonIntensityRow {
  hour: Date;
  avg_intensity: number;
}

export async function getCarbonIntensityHistory(
  prisma: PrismaClient,
  days = 7,
): Promise<CarbonIntensityPoint[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.$queryRaw<CarbonIntensityRow[]>`
    SELECT
      date_trunc('hour', ts) AS hour,
      AVG("carbonIntensity")::float AS avg_intensity
    FROM world_snapshots
    WHERE ts >= ${since}
    GROUP BY hour
    ORDER BY hour ASC
  `;

  return rows.map((r) => ({
    ts: r.hour.toISOString(),
    carbonIntensity: r.avg_intensity,
  }));
}
