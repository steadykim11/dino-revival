// SC-09 던전 페이지 클라이언트 컨테이너
//
// - 1초 단위 카운트다운 (초기값은 서버 remainingSec, 클라이언트 자체 감소)
// - 카운트다운 0 도달 시 toast + router.replace('/')
// - 미션 클릭 → SC-06 모달 (MissionCompleteModal 재사용)
// - 미션 완료 후 router.refresh() — 서버 컴포넌트 재페치로 진행도 반영
//
// 서버 컴포넌트(page.tsx)가 활성 던전 존재 확인 + 데이터 fetch.
// 이 클라이언트는 표시·인터랙션만 담당.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { MissionCard } from "@/components/missions/mission-card";
import { MissionCompleteModal } from "@/components/missions/mission-complete-modal";
import type { MissionItem } from "@/components/missions/missions-bottom-sheet";

interface DungeonPageClientProps {
  dungeonId: string;
  initialRemainingSec: number;
  missions: MissionItem[];
  carbonIntensity: number;
  contribution: {
    guildDisplayName: string;
    totalMembers: number;
    contributedMembers: number;
    percent: number; // 0~100
  };
}

export function DungeonPageClient({
  initialRemainingSec,
  missions,
  carbonIntensity,
  contribution,
}: DungeonPageClientProps) {
  const router = useRouter();
  const [remainingSec, setRemainingSec] = useState(initialRemainingSec);
  const [selectedMission, setSelectedMission] = useState<MissionItem | null>(
    null,
  );
  const [endedToast, setEndedToast] = useState(false);

  // 1초 간격 카운트다운
  useEffect(() => {
    if (remainingSec <= 0) return;
    const id = setInterval(() => {
      setRemainingSec((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [remainingSec]);

  // 카운트다운 종료 → toast 후 메인으로 (제안 3-A)
  useEffect(() => {
    if (remainingSec > 0) return;
    setEndedToast(true);
    const id = setTimeout(() => router.replace("/"), 1500);
    return () => clearTimeout(id);
  }, [remainingSec, router]);

  const mm = Math.floor(remainingSec / 60)
    .toString()
    .padStart(2, "0");
  const ss = (remainingSec % 60).toString().padStart(2, "0");

  return (
    <div className="flex flex-col gap-3">
      {/* 카운트다운만 보여주는 작은 헤더 — 페이지 헤더(뒤로가기/타이틀)는 layout 책임 */}
      <div className="flex items-center justify-end gap-1.5 text-sm text-stone-700">
        <Clock className="h-4 w-4 text-stone-400" aria-hidden />
        <span className="font-medium tabular-nums">
          {mm}:{ss}
        </span>
        <span className="text-xs text-stone-500">남음</span>
      </div>

      {/* 미션 섹션 */}
      <section className="rounded-2xl border border-stone-200 bg-white p-3">
        <div className="mb-2.5 flex items-baseline gap-1.5 px-1">
          <span className="text-sm font-semibold text-stone-800">
            던전 미션
          </span>
          <span className="text-xs text-stone-500">— 보상 2배</span>
        </div>

        <div className="flex flex-col gap-2">
          {missions.map((m) => (
            <MissionCard
              key={m.id}
              title={m.title}
              category={m.category}
              timeSlot={m.timeSlot}
              type={m.type}
              baseReward={m.baseReward}
              completed={!!m.completedAt}
              onClick={() => setSelectedMission(m)}
            />
          ))}
        </div>
      </section>

      {/* 우리 동네 기여도 */}
      <section className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
        <div className="mb-1.5 text-xs text-stone-500">우리 동네 기여도</div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-semibold text-stone-800">
            {contribution.guildDisplayName} {contribution.contributedMembers} /{" "}
            {contribution.totalMembers}명 참여
          </span>
          <span className="text-sm font-semibold tabular-nums text-emerald-700">
            {contribution.percent}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
            style={{ width: `${contribution.percent}%` }}
          />
        </div>
      </section>

      {/* 종료 toast */}
      {endedToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-stone-900 px-4 py-2 text-xs font-medium text-white shadow-lg"
        >
          던전이 종료됐어요. 메인으로 돌아갑니다.
        </div>
      )}

      {/* SC-06 모달 — 미션 완료 흐름은 기존 컴포넌트 재사용 */}
      {selectedMission && (
        <MissionCompleteModal
          mission={selectedMission}
          carbonIntensity={carbonIntensity}
          onClose={() => {
            setSelectedMission(null);
            router.refresh(); // 완료 반영
          }}
        />
      )}
    </div>
  );
}
