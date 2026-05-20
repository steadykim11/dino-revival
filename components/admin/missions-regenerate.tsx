"use client";

// 오늘 일일 미션 재생성
// - 한 번 누르면 확인 다이얼로그 (실수 방지)
// - 성공 시 deleted 수와 issueStatus 표시

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function MissionsRegenerate() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function regenerate() {
    if (
      !confirm(
        "오늘 발급된 일일 미션을 모두 삭제하고 재발급합니다. 진행할까요?",
      )
    ) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/missions/regenerate", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "재생성 실패");

      setMessage(
        `완료 — ${data.deleted}개 삭제, ${data.missionIds.length}개 발급 (${data.issueStatus})`,
      );
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "재생성 실패");
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={regenerate}
        disabled={isPending}
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
      >
        오늘 미션 재생성
      </button>
      <p className="text-[10px] text-stone-400">
        던전 미션은 영향 받지 않습니다.
      </p>

      {message && <p className="text-xs text-emerald-600">{message}</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
