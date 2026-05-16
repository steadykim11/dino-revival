// 미션 카드
// - 완료 상태에 따라 시각적 분기 (완료 시 dimmed + 체크)
// - 던전 미션은 액센트 색(rose 계열)으로 구분
// - 클릭 → SC-06 모달 띄움
//
// SC-05에서 미션 목록 펼친 상태 - 카드 3개 세로 스택

"use client";

import type {
  MissionCategory,
  MissionTimeSlot,
  MissionType,
} from "@prisma/client";
import { Check } from "lucide-react";

const CATEGORY_LABEL: Record<MissionCategory, string> = {
  COOLING: "냉방",
  HEATING: "난방",
  LIGHTING: "조명",
  STANDBY: "대기전력",
  LAUNDRY: "세탁",
  KITCHEN: "주방",
  ETC: "기타",
};

const TIMESLOT_LABEL: Record<MissionTimeSlot, string> = {
  DAY: "낮",
  EVENING: "저녁",
  ANYTIME: "종일",
};

export interface MissionCardProps {
  title: string;
  category: MissionCategory;
  timeSlot: MissionTimeSlot;
  type: MissionType;
  baseReward: number;
  completed: boolean;
  onClick: () => void;
}

export function MissionCard({
  title,
  category,
  timeSlot,
  type,
  baseReward,
  completed,
  onClick,
}: MissionCardProps) {
  const isDungeon = type === "DUNGEON";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={completed}
      className={[
        "flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-colors",
        completed
          ? "border-stone-200 bg-stone-50 opacity-60"
          : isDungeon
            ? "border-rose-200 bg-rose-50 hover:bg-rose-100"
            : "border-stone-200 bg-white hover:bg-stone-50",
      ].join(" ")}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1">
          {isDungeon && (
            <span className="rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
              던전
            </span>
          )}
          <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">
            {CATEGORY_LABEL[category]}
          </span>
          <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">
            {TIMESLOT_LABEL[timeSlot]}
          </span>
        </div>
        <p
          className={[
            "text-sm font-medium",
            completed ? "text-stone-500 line-through" : "text-stone-800",
          ].join(" ")}
        >
          {title}
        </p>
      </div>

      <div className="ml-3 flex shrink-0 items-center">
        {completed ? (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
            <Check className="h-4 w-4 text-emerald-700" strokeWidth={2.5} />
          </div>
        ) : (
          <div className="text-right">
            <div className="text-xs text-stone-500">보상</div>
            <div
              className={[
                "text-sm font-semibold tabular-nums",
                isDungeon ? "text-rose-700" : "text-amber-700",
              ].join(" ")}
            >
              +{baseReward}
            </div>
          </div>
        )}
      </div>
    </button>
  );
}