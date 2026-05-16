// SC-06 미션 완료 모달
// - 보상 계산 박스: 클라이언트에서 calculateReward로 미리 계산 (서버는 POST 시 재계산하여 검토)
// - "완료" → POST /api/missions/complete → 결과 콜백
// - 자가 신고 안내문 (정직성 환기)

"use client";

import { useState } from "react";
import { calculateReward } from "@/lib/missions/reward-calculator";
import type { MissionItem } from "./missions-bottom-sheet";
import { useRouter } from "next/navigation";

export interface MissionCompleteModalProps {
  mission: MissionItem;
  carbonIntensity: number | null;
  onClose: () => void;
}

export function MissionCompleteModal({
  mission,
  carbonIntensity,
  onClose,
}: MissionCompleteModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // 보상 미리보기. carbonIntensity가 null이면 baseReward만 표시.
  const preview =
    carbonIntensity !== null
      ? calculateReward({
        baseReward: mission.baseReward,
        carbonIntensity,
        missionType: mission.type,
      })
      : null;

  const handleComplete = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/missions/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missionId: mission.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "완료 처리에 실패했습니다.");
        setSubmitting(false);
        return;
      }
      // 결과 페이지로 라우팅
      // 메인의 미션 리스트 갱신은 결과 페이지 "계속하기" 클릭 후 router.push("/")에서 자동으로 일어남
      // Server Component re-fetch + missions-section의 useEffect 재실행
      router.push(`/battle/${json.missionLogId}`);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 px-4 pb-8 pt-16 lg:items-center lg:pb-16"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[392px] rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* 라벨 */}
        <div className="mb-2 flex items-center gap-1">
          <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">
            {CATEGORY_LABEL[mission.category]}
          </span>
          <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">
            {TIMESLOT_LABEL[mission.timeSlot]}
          </span>
        </div>

        {/* 제목·설명 */}
        <h2 className="text-base font-semibold text-stone-900">
          {mission.title}
        </h2>
        <p className="mt-1 text-sm text-stone-600">{mission.description}</p>

        {/* 보상 계산 박스 */}
        <div className="mt-4 rounded-xl bg-stone-50 p-3">
          <div className="text-[11px] font-medium text-stone-500">보상 계산</div>
          <div className="mt-1.5 space-y-1 text-xs">
            <Row label="기본 보상" value={`${mission.baseReward}`} />
            {preview && (
              <>
                <Row
                  label={`탄소 가중치 (${battlefieldKo(preview.battlefield)})`}
                  value={`× ${preview.carbonWeight.toFixed(1)}`}
                />
                {preview.isDungeon && (
                  <Row label="던전 배율" value={`× ${preview.dungeonMultiplier.toFixed(1)}`} />
                )}
                <div className="my-1.5 border-t border-stone-200" />
                <div className="flex items-baseline justify-between">
                  <span className="text-stone-700">최종 보상</span>
                  <span className="text-base font-semibold tabular-nums text-amber-700">
                    +{preview.finalReward}
                  </span>
                </div>
              </>
            )}
            {!preview && (
              <p className="text-[11px] text-stone-400">
                탄소 시계 데이터 로딩 중...
              </p>
            )}
          </div>
        </div>

        {/* 자가 신고 안내 */}
        <p className="mt-3 text-[11px] text-stone-500">
          자가 신고 미션입니다. 정직하게 체크해주세요.
        </p>

        {error && (
          <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
            {error}
          </p>
        )}

        {/* 버튼 */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-lg border border-stone-300 bg-white py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleComplete}
            disabled={submitting || !!mission.completedAt}
            className="flex-1 rounded-lg bg-amber-600 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {submitting ? "처리 중..." : "완료"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-stone-600">{label}</span>
      <span className="tabular-nums text-stone-800">{value}</span>
    </div>
  );
}

const CATEGORY_LABEL = {
  COOLING: "냉방",
  HEATING: "난방",
  LIGHTING: "조명",
  STANDBY: "대기전력",
  LAUNDRY: "세탁",
  KITCHEN: "주방",
  ETC: "기타",
} as const;

const TIMESLOT_LABEL = {
  DAY: "낮",
  EVENING: "저녁",
  ANYTIME: "종일",
} as const;

function battlefieldKo(b: "PURIFIED" | "NORMAL" | "POLLUTED"): string {
  return b === "PURIFIED" ? "정화" : b === "NORMAL" ? "보통" : "오염";
}