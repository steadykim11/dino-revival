// 메인 화면 SC-05의 던전 배너
// 활성 시에만 노출. 진입 버튼 → /dungeon
// 자체 /api/world/state 폴링 (5초) — CarbonClock과 독립
// useWorldState 훅과 컨텍스트 공유 - Phase 2 메인 페이지 리팩토링 계획

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { DungeonState } from "@/lib/types/dungeon";
import type { WorldStateResponse } from "@/lib/types/world-snapshot";

const POLL_INTERVAL_MS = 5000;

export function DungeonBanner() {
  const [dungeon, setDungeon] = useState<DungeonState | null>(null);
  const [remainingSec, setRemainingSec] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce() {
      try {
        const res = await fetch("/api/world/state", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as WorldStateResponse;
        if (!cancelled) return;
        setDungeon(data.dungeon);
        if (data.dungeon.active) {
          // 서버 기준 remainingSec으로 동기화 - 클라이언트 시계 오차 보정
          setRemainingSec(data.dungeon.instance.remainingSec);
        }
      } catch {
        // 네트워크 실패 무시 후 다음 폴링에서 회복
      }
    }

    fetchOnce();
    const id = setInterval(fetchOnce, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!dungeon?.active) return;
    const id = setInterval(() => {
      setRemainingSec((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [dungeon?.active]);

  // 활성 던전 없으면 렌더 안 함
  if (!dungeon || !dungeon.active) return null;

  const mm = Math.floor(remainingSec / 60)
    .toString()
    .padStart(2, "0");
  const ss = (remainingSec % 60).toString().padStart(2, "0");

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
            남은 시간 {mm}:{ss}
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
