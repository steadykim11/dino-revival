// 메인 페이지 미션 영역
// 클라이언트 컴포넌트로 분리해 page.tsx(server)에서 데이터 페칭·새로고침 로직을 격리
//
// 동작 방식:
// - /api/missions/today fetch
// - useWorldState로 carbonIntensity 가져와 모달에 전달
// - 완료 후 missions 재조회 + 페이지 router.refresh (Dino 상태 갱신용)

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorldState } from "@/lib/hooks/use-world-state";
import {
  MissionsBottomSheet,
  type MissionItem,
} from "./missions-bottom-sheet";

interface TodayResponse {
  missions: MissionItem[];
  generatedAt: string;
}

export function MissionsSection() {
  const router = useRouter();
  const { data: worldData } = useWorldState();
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [mounted, setMounted] = useState(false);

  const fetchMissions = useCallback(async () => {
    try {
      const res = await fetch("/api/missions/today");
      if (!res.ok) {
        console.error("[missions/today] fetch failed:", res.status);
        return;
      }
      const json: TodayResponse = await res.json();
      setMissions(json.missions);
    } catch (err) {
      console.error("[missions/today] network error:", err);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchMissions();
  }, [fetchMissions]);

  const handleCompleted = useCallback(async () => {
    await fetchMissions();
    // Dino 상태(클린에너지·진화 등)가 변경됐을 수 있어 server component 재실행
    router.refresh();
  }, [fetchMissions, router]);

  // 첫 마운트 전엔 아무것도 렌더하지 않음 - SSR/CSR 차이로 인한 hydration 미스매치 방지
  if (!mounted) return null;

  return (
    <MissionsBottomSheet
      missions={missions}
      carbonIntensity={
        worldData ? Math.round(worldData.world.carbonIntensity) : null
      }
      onMissionCompleted={handleCompleted}
    />
  );
}