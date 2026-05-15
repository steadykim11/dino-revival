// app/onboarding/name/page.tsx
// SC-04b 이름 짓기 — 알을 받기 전 이름 입력.
//
// query param: ?species=TYRANNO
// 없거나 잘못된 값이면 /onboarding/egg로 다시.
//
// 흐름:
//   1. species에 따른 디폴트 이름 채워서 시작 (사용자가 자유롭게 수정)
//   2. PUT /api/me/dino → Dino row 생성 (stage=EGG)
//   3. /로 이동 → 메인에서 알 상태로 시작, 미션 완료해서 부화시키기

"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DinoSpecies } from "@prisma/client";
import { SPECIES_META } from "@/lib/dino/species";
import { DinoDisplay } from "@/components/dino/dino-display";

const NAME_REGEX = /^[가-힣a-zA-Z0-9]{2,12}$/;

function isValidSpecies(value: string | null): value is DinoSpecies {
  return value === "TYRANNO" || value === "BRACHIO" || value === "TRICERA";
}

export default function NamingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const speciesParam = params.get("species");

  useEffect(() => {
    if (!isValidSpecies(speciesParam)) {
      router.replace("/onboarding/egg");
      return;
    }
    if (!SPECIES_META[speciesParam].isAvailable) {
      router.replace("/onboarding/egg");
    }
  }, [speciesParam, router]);

  if (!isValidSpecies(speciesParam)) {
    return null;
  }

  return <NamingForm species={speciesParam} />;
}

function NamingForm({ species }: { species: DinoSpecies }) {
  const router = useRouter();
  const meta = SPECIES_META[species];

  const [name, setName] = useState(meta.defaultName);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const trimmed = name.trim();
  const isValid = NAME_REGEX.test(trimmed);
  const canSubmit = isValid && !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/me/dino", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ species, name: trimmed }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error?.message ?? "처리에 실패했습니다.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      {/* 진행 단계 */}
      <div className="mb-6">
        <p className="mb-2 text-xs text-stone-500">3단계 중 3</p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-stone-200">
          <div className="h-full w-full rounded-full bg-amber-600" />
        </div>
      </div>

      <h1 className="mb-1 text-lg font-semibold">
        곧 만날 친구의 이름을 지어주세요
      </h1>
      <p className="mb-6 text-sm text-stone-600">
        알 안에서 당신을 기다리고 있어요.
      </p>

      {/* 알 미리보기 */}
      <div className="mb-6 flex justify-center">
        <DinoDisplay species={species} stage="EGG" size="md" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs text-stone-600">이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="2~12자, 한글·영문·숫자"
            maxLength={12}
            required
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
          {!isValid && trimmed !== "" && (
            <p className="mt-1 text-xs text-rose-600">
              한글·영문·숫자 2~12자만 가능합니다.
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-2 w-full rounded-lg bg-amber-600 py-3 text-sm font-semibold text-white disabled:bg-stone-300"
        >
          {submitting ? "처리 중..." : "함께하기"}
        </button>
      </form>
    </div>
  );
}
