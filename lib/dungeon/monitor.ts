// 5분 단위 realtime cron이 호출하는 던전 모니터링.
//
// - 만료된 활성 던전 청소 (sweep) — DB row 정리 목적
// - 활성 던전 없고 예비율 < 10%면 자동 발령 + 미션 발급
// - vercel.json schedule 별도 등록은 안 함. 기존 cron/realtime이
//   이미 5분마다 돌고 있어 여기에 얹는 비용이 거의 0이라 통합.
// - 실패 시 throw 대신 결과 객체 반환 — cron 메인 흐름(snapshot capture)을
//   막지 않기 위함. 호출자(route)가 .catch로 한 번 더 가드.

import { prisma } from "@/lib/prisma";
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
    select: { supplyReserveRate: true, carbonIntensity: true },
  });
  if (!snapshot) {
    return { swept, triggered: false, reason: "NO_SNAPSHOT" };
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
