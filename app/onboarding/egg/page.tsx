// app/onboarding/egg/page.tsx
// SC-04 알 선택 — TYRANNO만 선택 가능. 나머지 2종 잠금.
//
// 흐름:
//   1. 알 카드 3개 표시 → TYRANNO 선택
//   2. "이 알로 결정하기" → /onboarding/name?species=TYRANNO
//
// 부화는 메인 진입 후 미션 완료로 클린에너지 100 도달 시 (D14).

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DinoSpecies } from "@prisma/client";
import { SPECIES_META, ALL_SPECIES } from "@/lib/dino/species";
import { DinoDisplay } from "@/components/dino/dino-display";

export default function EggSelectionPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<DinoSpecies>("TYRANNO");

  function handleSelect() {
    router.push(`/onboarding/name?species=${selected}`);
  }

  const meta = SPECIES_META[selected];

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      {/* 진행 단계 */}
      <div className="mb-6">
        <p className="mb-2 text-xs text-stone-500">3단계 중 2</p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-stone-200">
          <div className="h-full w-2/3 rounded-full bg-amber-600" />
        </div>
      </div>

      <h1 className="mb-1 text-lg font-semibold">함께할 알을 선택하세요</h1>
      <p className="mb-6 text-sm text-stone-600">
        멸종을 겪어본 그들이 당신을 기다립니다.
      </p>

      {/* 알 카드 3개 */}
      <div className="mb-5 grid grid-cols-3 gap-2">
        {ALL_SPECIES.map((sp) => (
          <EggCard
            key={sp}
            species={sp}
            isSelected={selected === sp}
            onSelect={() => SPECIES_META[sp].isAvailable && setSelected(sp)}
          />
        ))}
      </div>

      {/* 선택된 종 설명 */}
      <div className="mb-6 rounded-lg bg-amber-50 p-3">
        <p className="text-xs font-semibold text-amber-900">
          {meta.displayName}
        </p>
        <p className="mt-1 text-xs text-amber-800">{meta.description}</p>
      </div>

      <button
        onClick={handleSelect}
        disabled={!meta.isAvailable}
        className="w-full rounded-lg bg-amber-600 py-3 text-sm font-semibold text-white disabled:bg-stone-300"
      >
        이 알로 결정하기
      </button>
    </div>
  );
}

function EggCard({
  species,
  isSelected,
  onSelect,
}: {
  species: DinoSpecies;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const meta = SPECIES_META[species];

  const baseClass =
    "flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition";
  const stateClass = !meta.isAvailable
    ? "border-stone-200 bg-stone-50 opacity-50 cursor-not-allowed"
    : isSelected
      ? "border-amber-600 bg-amber-50 cursor-pointer"
      : "border-stone-200 bg-white hover:border-stone-300 cursor-pointer";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!meta.isAvailable}
      className={`${baseClass} ${stateClass}`}
    >
      <div className="w-full flex justify-center overflow-hidden">
        <DinoDisplay species={species} stage="EGG" size="sm" />
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold text-stone-700">
          {meta.displayName}
        </p>
        <p className="mt-0.5 text-[10px] text-stone-500">
          {meta.isAvailable ? "선택 가능" : (meta.lockedReason ?? "잠금")}
        </p>
      </div>
    </button>
  );
}
