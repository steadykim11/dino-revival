"use client";

// 던전 수동 트리거 / 강제 종료
// - 현재 활성 상태를 props로 받음 (서버 컴포넌트가 fetch)
// - 액션 직후 router.refresh()로 서버 컴포넌트 재렌더 → 상태 갱신

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface ActiveDungeon {
  id: string;
  activatedAt: string;
  expiresAt: string;
}

interface Props {
  initialDungeon: ActiveDungeon | null;
}

export function DungeonControl({ initialDungeon }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function trigger() {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/dungeon/trigger", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "발령 실패");

      setMessage(
        data.created
          ? `발령 완료 — 미션 ${data.issuedMissions}개 발급`
          : `이미 활성 중인 던전 있음`,
      );
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "발령 실패");
    }
  }

  async function end() {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/dungeon/end", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "종료 실패");

      setMessage(data.ended ? "종료 완료" : "활성 던전 없음");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "종료 실패");
    }
  }

  return (
    <div className="space-y-3">
      {/* 현재 상태 */}
      <div className="rounded-lg bg-stone-50 p-3 text-xs">
        {initialDungeon ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
              <span className="font-medium">활성 던전 있음</span>
            </div>
            <div className="text-stone-500">
              만료: {new Date(initialDungeon.expiresAt).toLocaleString("ko-KR")}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-stone-300" />
            <span className="text-stone-500">활성 던전 없음</span>
          </div>
        )}
      </div>

      {/* 버튼 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={trigger}
          disabled={isPending}
          className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          던전 발령
        </button>
        <button
          onClick={end}
          disabled={isPending || !initialDungeon}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          강제 종료
        </button>
      </div>

      {message && <p className="text-xs text-emerald-600">{message}</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
