"use client";

// 공룡 단계 select + 누적 클린에너지 input
// - 각 필드 독립적으로 변경 후 "적용" 버튼 한 번에 PATCH
// - 변경된 필드만 body에 포함 (변경 없으면 disabled)

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DinoStage } from "@/lib/dino/types";

interface InitialDino {
  name: string;
  stage: DinoStage;
  totalCleanEnergy: number;
}

interface Props {
  initialDino: InitialDino;
}

const STAGE_OPTIONS: { value: DinoStage; label: string }[] = [
  { value: "EGG", label: "EGG (알)" },
  { value: "HATCHLING", label: "HATCHLING (유년기)" },
  { value: "ADULT", label: "ADULT (성체)" },
];

export function DinoControl({ initialDino }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [stage, setStage] = useState<DinoStage>(initialDino.stage);
  const [energy, setEnergy] = useState<number>(initialDino.totalCleanEnergy);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const stageChanged = stage !== initialDino.stage;
  const energyChanged = energy !== initialDino.totalCleanEnergy;
  const dirty = stageChanged || energyChanged;

  async function apply() {
    setError(null);
    setMessage(null);

    const body: { stage?: DinoStage; totalCleanEnergy?: number } = {};
    if (stageChanged) body.stage = stage;
    if (energyChanged) body.totalCleanEnergy = energy;

    try {
      const res = await fetch("/api/admin/dino", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "적용 실패");

      setMessage("적용 완료");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "적용 실패");
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-stone-500">공룡: {initialDino.name}</div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium">단계</span>
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value as DinoStage)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        >
          {STAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium">
          누적 클린에너지 (0 ~ 100,000)
        </span>
        <input
          type="number"
          value={energy}
          min={0}
          max={100_000}
          onChange={(e) => setEnergy(Number(e.target.value))}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-[10px] text-stone-400">
          임계값: HATCHLING 100 / ADULT 500
        </span>
      </label>

      <button
        onClick={apply}
        disabled={!dirty || isPending}
        className="w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        적용
      </button>

      {message && <p className="text-xs text-emerald-600">{message}</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
