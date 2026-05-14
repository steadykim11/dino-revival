// SC-03 프로필 등록 - 닉네임, 동네 입력
// User row 없는 사용자가 진입 (layout에서 dino 가드, 페이지에서 user 가드)

"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { REGIONS_BY_PROVINCE } from "@/lib/static-data/regions";

const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]{2,12}$/;

type NicknameStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "invalid_format" }
  | { kind: "taken" }
  | { kind: "available" };

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

  // 닉네임 debounce 검증
  useEffect(() => {
    const trimmed = nickname.trim();
    if (trimmed === "") {
      setNicknameStatus({ kind: "idle" });
      return;
    }
    if (!NICKNAME_REGEX.test(trimmed)) {
      setNicknameStatus({ kind: "invalid_format" });
      return;
    }

    setNicknameStatus({ kind: "checking" });

    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/me/check-nickname?nickname=${encodeURIComponent(trimmed)}`,
        );
        const json = await res.json();
        if (json.available) {
          setNicknameStatus({ kind: "available" });
        } else if (json.reason === "INVALID_FORMAT") {
          setNicknameStatus({ kind: "invalid_format" });
        } else {
          setNicknameStatus({ kind: "taken" });
        }
      } catch {
        // 네트워크 오류는 조용히 idle로 — 제출 시점에 검증
        setNicknameStatus({ kind: "idle" });
      }
    }, 400);

    return () => clearTimeout(handle);
  }, [nickname]);

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
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="2~12자, 한글·영문·숫자"
            maxLength={12}
            required
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
          <NicknameStatusMessage status={nicknameStatus} nickname={nickname} />
        </div>

        {/* 동네 */}
        <div>
          <label className="mb-1 block text-xs text-stone-600">동네</label>
          <select
            value={regionCode}
            onChange={(e) => setRegionCode(e.target.value)}
            required
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
          >
            <option value="" disabled>
              시·군·구 선택
            </option>
            {Array.from(REGIONS_BY_PROVINCE.entries()).map(
              ([province, regions]) => (
                <optgroup key={province} label={province}>
                  {regions.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.displayName}
                    </option>
                  ))}
                </optgroup>
              ),
            )}
          </select>
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

function NicknameStatusMessage({
  status,
  nickname,
}: {
  status: NicknameStatus;
  nickname: string;
}) {
  if (nickname.trim() === "") {
    return <p className="mt-1 text-xs text-stone-400">30일 후 변경 가능</p>;
  }
  switch (status.kind) {
    case "checking":
      return <p className="mt-1 text-xs text-stone-500">확인 중...</p>;
    case "invalid_format":
      return (
        <p className="mt-1 text-xs text-rose-600">
          한글·영문·숫자 2~12자만 가능합니다.
        </p>
      );
    case "taken":
      return (
        <p className="mt-1 text-xs text-rose-600">
          이미 사용 중인 닉네임입니다.
        </p>
      );
    case "available":
      return (
        <p className="mt-1 text-xs text-emerald-600">
          사용 가능한 닉네임입니다.
        </p>
      );
    default:
      return <p className="mt-1 text-xs text-stone-400">30일 후 변경 가능</p>;
  }
}