// D8 시점 placeholder만 구현

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignout() {
    setLoading(true);
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/signin");
    router.refresh();
  }

  return (
    <div className="text-center">
      <h1 className="mb-3 text-lg font-semibold">프로필 등록 (D9 구현 예정)</h1>
      <p className="mb-6 text-sm text-stone-600">
        SC-03 화면 - 닉네임·동네 입력 폼
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
