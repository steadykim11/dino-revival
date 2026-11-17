// 메인 화면 SC-05의 던전 배너
// 활성 던전이 있을 때만 노출. 진입 버튼 → /dungeon
//
// 던전 상태는 WorldStateProvider가 받아온 값을 쓴다 (직접 폴링하지 않는다).
// 남은 시간은 서버가 준 remainingSec에서 받은 뒤 흐른 시간을 빼서 1초마다 갱신한다.

"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useNow, useWorldState } from "@/components/world/world-state-provider";
import { formatCountdown, remainingSecondsAt } from "@/lib/time/countdown";

export function DungeonBanner() {
  const { data, receivedAtMs } = useWorldState();
  const dungeon = data?.dungeon;
  const isActive = dungeon?.active === true;

  // 활성 던전이 있을 때만 1초마다 다시 그린다
  const now = useNow(isActive ? 1000 : null);

  if (!dungeon?.active) return null;

  const remainingSec = remainingSecondsAt(
    dungeon.instance.remainingSec,
    receivedAtMs,
    now,
  );
  // 다음 폴링 전에 시간이 다 됐으면 먼저 숨긴다
  if (remainingSec <= 0) return null;

  return (
    <Link
      href="/dungeon"
      className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 shadow-sm hover:bg-rose-100"
      aria-label="피크 던전 진입"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-rose-700">
            피크 던전 발령
          </div>
          <div className="text-xs text-rose-600 tabular-nums">
            남은 시간 {formatCountdown(remainingSec)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 text-xs font-medium text-rose-700">
        진입
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </div>
    </Link>
  );
}
