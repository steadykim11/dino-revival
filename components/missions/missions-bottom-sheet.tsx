// SC-05 메인 화면의 미션 시트 (vaul 미사용 자체 구현)
//
// 두 상태:
// - 접힘 (collapsed): 헤더 + 우선순위 미션 1개. 높이 약 184px
// - 펼침 (expanded): 헤더 + 미션 3개 전체. 높이 약 388px
//
// 항상 화면 하단 fixed. 헤더 탭으로 토글. 부드러운 max-height 트랜지션.
//
// 우선순위 결정:
// 1. 활성 던전 미션 중 미완료 우선
// 2. 일반 미션 중 미완료 첫 번째
// 3. 모두 완료면 안내 메시지

"use client";

import { useState } from "react";
import { ChevronUp } from "lucide-react";
import { MissionCard } from "./mission-card";
import { MissionCompleteModal } from "./mission-complete-modal";
import type {
  MissionCategory,
  MissionTimeSlot,
  MissionType,
} from "@prisma/client";

export interface MissionItem {
  id: string;
  title: string;
  description: string;
  category: MissionCategory;
  timeSlot: MissionTimeSlot;
  type: MissionType;
  baseReward: number;
  estimatedKwh: string;
  completedAt: string | null;
}

export interface MissionsBottomSheetProps {
  missions: MissionItem[];
  /** 현재 carbonIntensity (보상 미리보기 표시에 사용) */
  carbonIntensity: number | null;
  /** 완료 후 미션 목록 새로고침을 트리거 */
  onMissionCompleted: () => void;
}

export function MissionsBottomSheet({
  missions,
  carbonIntensity,
  onMissionCompleted,
}: MissionsBottomSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedMission, setSelectedMission] = useState<MissionItem | null>(
    null,
  );

  const completedCount = missions.filter((m) => m.completedAt).length;
  const priorityMission = pickPriorityMission(missions);
  const allDone = completedCount === missions.length && missions.length > 0;

  return (
    <>
      <div
        role="region"
        aria-label="오늘의 미션"
        className={[
          // 위치
          "fixed inset-x-0 bottom-14 z-10 mx-auto w-full max-w-[420px]",
          // 데스크톱: 사이드바(240px)와의 사이에 약간의 여백
          "lg:right-[260px] lg:bottom-0 lg:left-auto lg:w-[420px]",
          // 카드 스타일
          "rounded-t-3xl border-t border-stone-200 bg-white shadow-xl",
          // 양방향 부드러운 max-height 트랜지션
          "overflow-hidden transition-[max-height] duration-300 ease-out",
          expanded ? "max-h-[440px]" : "max-h-[184px]",
        ].join(" ")}
      >
        {/* 헤더 — 탭으로 펼침 토글 */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="missions-list"
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div>
            <p className="text-sm font-semibold text-stone-800">오늘의 미션</p>
            <p className="text-xs text-stone-500">
              {completedCount}/{missions.length} 완료 ·{" "}
              {expanded ? "접기" : "펼치기"}
            </p>
          </div>
          <ChevronUp
            className={[
              "h-5 w-5 text-stone-400 transition-transform",
              expanded ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>

        {/* 본문 */}
        <div
          id="missions-list"
          className="flex flex-col gap-2 overflow-y-auto px-4 pb-4"
        >
          {missions.length === 0 ? (
            <p className="py-4 text-center text-xs text-stone-500">
              미션을 불러오는 중...
            </p>
          ) : expanded ? (
            <>
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
              {allDone && (
                <p className="pt-2 text-center text-xs text-stone-500">
                  오늘 미션을 모두 완료했어요. 내일 새 미션이 옵니다.
                </p>
              )}
            </>
          ) : priorityMission ? (
            <MissionCard
              title={priorityMission.title}
              category={priorityMission.category}
              timeSlot={priorityMission.timeSlot}
              type={priorityMission.type}
              baseReward={priorityMission.baseReward}
              completed={!!priorityMission.completedAt}
              onClick={() => setSelectedMission(priorityMission)}
            />
          ) : (
            <p className="py-4 text-center text-xs text-stone-500">
              오늘 미션을 모두 완료했어요. 내일 새 미션이 옵니다.
            </p>
          )}
        </div>
      </div>

      {selectedMission && (
        <MissionCompleteModal
          mission={selectedMission}
          carbonIntensity={carbonIntensity}
          onClose={() => setSelectedMission(null)}
          onCompleted={() => {
            setSelectedMission(null);
            onMissionCompleted();
          }}
        />
      )}
    </>
  );
}

// 우선순위: 던전 미완료 > 일반 미완료 첫 번째 > null
function pickPriorityMission(missions: MissionItem[]): MissionItem | null {
  const incomplete = missions.filter((m) => !m.completedAt);
  const dungeon = incomplete.find((m) => m.type === "DUNGEON");
  return dungeon ?? incomplete[0] ?? null;
}