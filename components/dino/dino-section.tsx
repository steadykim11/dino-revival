// components/dino/dino-section.tsx
// SC-05 메인 화면의 공룡 영역.
//
// 표시:
// - 일러스트 (DinoDisplay)
// - 이름 + 종·단계 라벨
// - 진화 진행도 바 (EGG·HATCHLING). ADULT는 진행도 없음.

import type { DinoSpecies, DinoStage } from "@prisma/client";
import { DinoDisplay } from "./dino-display";
import { SPECIES_META } from "@/lib/dino/species";
import { getEvolutionProgress } from "@/lib/dino/evolution";

export interface DinoSectionProps {
  name: string;
  species: DinoSpecies;
  stage: DinoStage;
  totalCleanEnergy: number;
}

const STAGE_LABEL: Record<DinoStage, string> = {
  EGG: "알",
  HATCHLING: "유년기",
  ADULT: "성체",
};

const NEXT_STAGE_LABEL: Record<DinoStage, string> = {
  EGG: "부화까지",
  HATCHLING: "성체까지",
  ADULT: "",
};

export function DinoSection({
  name,
  species,
  stage,
  totalCleanEnergy,
}: DinoSectionProps) {
  const meta = SPECIES_META[species];
  const subtitle = `${meta.displayName} · ${STAGE_LABEL[stage]}`;
  const progress = getEvolutionProgress(stage, totalCleanEnergy);

  const showProgress = progress.target !== null;

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <DinoDisplay species={species} stage={stage} size="lg" />

      <div className="mt-3 text-center">
        <p className="text-base font-semibold">{name}</p>
        <p className="text-xs text-stone-500">{subtitle}</p>
      </div>

      {showProgress && (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-stone-500">{NEXT_STAGE_LABEL[stage]}</span>
            <span className="text-stone-700">
              {progress.current} / {progress.target}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-amber-600 transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
