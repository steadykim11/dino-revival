// 수집 작업(jobs/collect.ts)이 5분마다 스냅샷 기록 직후 호출하는 던전 모니터링.
//
// - 만료된 활성 던전 청소 (sweep) — DB row 정리 목적
// - 활성 던전 없고 예비율 < 10%면 자동 발령 + 미션 발급
// - 최신 스냅샷이 지연 상태면 발령하지 않는다

import { prisma } from "@/lib/prisma";
import { isSnapshotStale } from "@/lib/world/staleness";
import {
  activateDungeon,
  sweepExpiredDungeons,
  getCurrentActiveDungeon,
} from "./lifecycle";
import { issueDungeonMissions } from "./missions";

/** 자동 발령 임계 예비율 (요약본) */
const AUTO_TRIGGER_THRESHOLD = 10;

export type MonitorResult = {
  swept: number;
  triggered: boolean;
  reason:
    | "TRIGGERED"
    | "ALREADY_ACTIVE"
    | "NO_SNAPSHOT"
    | "STALE_SNAPSHOT"
    | "ABOVE_THRESHOLD"
    | "ERROR";
  dungeonId?: string;
  issuedMissions?: number;
  reserveRate?: number;
};

export async function monitorDungeon(
  now: Date = new Date(),
): Promise<MonitorResult> {
  // 1) 만료된 던전 정리
  const swept = await sweepExpiredDungeons(prisma, now);

  // 2) 이미 활성이면 발령 스킵
  const active = await getCurrentActiveDungeon(prisma, now);
  if (active) {
    return { swept, triggered: false, reason: "ALREADY_ACTIVE" };
  }

  // 3) 최신 snapshot 확인
  const snapshot = await prisma.worldSnapshot.findFirst({
    orderBy: { ts: "desc" },
    select: { ts: true, supplyReserveRate: true, carbonIntensity: true },
  });
  if (!snapshot) {
    return { swept, triggered: false, reason: "NO_SNAPSHOT" };
  }
  // 수집이 멈춘 상태의 오래된 예비율로는 발령하지 않는다
  if (isSnapshotStale(snapshot.ts, now)) {
    return { swept, triggered: false, reason: "STALE_SNAPSHOT" };
  }

  const reserveRate = Number(snapshot.supplyReserveRate);
  if (reserveRate >= AUTO_TRIGGER_THRESHOLD) {
    return { swept, triggered: false, reason: "ABOVE_THRESHOLD", reserveRate };
  }

  // 4) 자동 발령
  const { dungeon, created } = await activateDungeon(prisma, {
    reason: "auto",
    triggerReserveRate: reserveRate,
    triggerCarbonIntensity: Number(snapshot.carbonIntensity),
    now,
  });

  let issued = 0;
  if (created) {
    issued = await issueDungeonMissions(prisma, dungeon.id, now);
  }

  return {
    swept,
    triggered: created,
    reason: "TRIGGERED",
    dungeonId: dungeon.id,
    issuedMissions: issued,
    reserveRate,
  };
}
