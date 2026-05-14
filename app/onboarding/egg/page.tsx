// SC-04 알 선택 - D10 작업 예정
// D9에서는 placeholder만

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function EggPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignout() {
    setLoading(true);
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/signin");
    router.refresh();
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      {/* 진행 단계 */}
      <div className="mb-6">
        <p className="mb-2 text-xs text-stone-500">2단계 중 2</p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-stone-200">
          <div className="h-full w-full rounded-full bg-amber-600" />
        </div>
      </div>

      <h1 className="mb-3 text-lg font-semibold">알 선택 (D10 예정)</h1>
      <p className="mb-6 text-sm text-stone-600">
        SC-04 화면 - 알 카드 3개 + 부화 CTA
      </p>
      <button
        onClick={handleSignout}
        disabled={loading}
        className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 disabled:opacity-50"
      >
        {loading ? "처리 중..." : "로그아웃 (테스트용)"}
      </button>
    </div>
  );
}