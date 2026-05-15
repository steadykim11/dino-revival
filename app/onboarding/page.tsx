// SC-03 프로필 등록 - 닉네임, 동네 입력
// User row 없는 사용자가 진입 (layout에서 dino 가드, 페이지에서 user 가드)

"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { NicknameInput } from "@/components/profile/nickname-input";
import { RegionSelect } from "@/components/profile/region-select";
import type { NicknameStatus } from "@/components/profile/use-nickname-check";

export default function OnboardingPage() {
  const router = useRouter();

  // 이미 User row가 있으면 알 선택 화면으로 이동.
  // (layout이 User+Dino 둘 다 있으면 /로 보내지만, User만 있는 경우는 여기서 처리)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me");
        const json = await res.json();
        if (!cancelled && json.profile) {
          router.replace("/onboarding/egg");
        }
      } catch {
        // 무시 — 폼 그대로 표시
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const [nickname, setNickname] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>({
    kind: "idle",
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    nicknameStatus.kind === "available" && regionCode !== "" && !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), regionCode }),
      });
      const json = await res.json();

      if (!res.ok) {
        setSubmitError(json.error?.message ?? "프로필 등록에 실패했습니다.");
        return;
      }

      router.push("/onboarding/egg");
      router.refresh();
    } catch {
      setSubmitError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      {/* 진행 단계 */}
      <div className="mb-6">
        <p className="mb-2 text-xs text-stone-500">2단계 중 1</p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-stone-200">
          <div className="h-full w-1/2 rounded-full bg-amber-600" />
        </div>
      </div>

      <h1 className="mb-1 text-lg font-semibold">먼저 알려주세요</h1>
      <p className="mb-6 text-sm text-stone-600">
        동네 길드에 자동으로 합류합니다.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* 닉네임 */}
        <div>
          <label className="mb-1 block text-xs text-stone-600">닉네임</label>
          <NicknameInput
            value={nickname}
            onChange={setNickname}
            onStatusChange={setNicknameStatus}
            helperText="30일 후 변경 가능"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-stone-600">동네</label>
          <RegionSelect value={regionCode} onChange={setRegionCode} />
          <p className="mt-1 text-xs text-stone-400">90일 후 변경 가능</p>
        </div>

        {submitError && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-2 w-full rounded-lg bg-amber-600 py-3 text-sm font-semibold text-white disabled:bg-stone-300"
        >
          {submitting ? "등록 중..." : "다음 — 알 선택하기"}
        </button>
      </form>
    </div>
  );
}
