// 메인 페이지 미션 영역
//
// - 오늘의 미션은 서버(홈 페이지)가 읽어 props로 넘긴다.
// - 보상 미리보기용 탄소강도는 WorldStateProvider에서 받는다.
// - 미션을 완료하면 전투 화면으로 이동하고, 돌아올 때 홈이 서버에서 다시 그려져 목록이 갱신된다.

"use client";

import { useWorldState } from "@/components/world/world-state-provider";
import type { MissionItem } from "@/lib/missions/types";
import { MissionsBottomSheet } from "./missions-bottom-sheet";

export function MissionsSection({ missions }: { missions: MissionItem[] }) {
  const { data: worldData } = useWorldState();

  return (
    <MissionsBottomSheet
      missions={missions}
      carbonIntensity={
        worldData ? Math.round(worldData.world.carbonIntensity) : null
      }
    />
  );
}
