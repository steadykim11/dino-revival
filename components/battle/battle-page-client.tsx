// /battle/[missionLogId] 페이지의 클라이언트 컨테이너
// D14: cutscene → result → evolution 3-phase로 확장
// evolution은 진화가 발생한 경우에만 진입, 없으면 result에서 바로 메인으로

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { BattleCutscene } from "./battle-cutscene";
import { BattleResult } from "./battle-result";
import { EvolutionScene } from "./evolution-scene";
import type { DinoSpecies, DinoStage } from "@/lib/dino/types";
import type { EnemyMeta } from "@/lib/battle/enemy-types";
import { BattleIntro } from "./battle-intro";

type Phase = "intro" | "cutscene" | "result" | "evolution";

export interface BattlePageClientProps {
  dino: {
    name: string;
    species: DinoSpecies;
    stageBefore: DinoStage;
    stageAfter: DinoStage;
    cleanEnergyBefore: number;
    cleanEnergyAfter: number;
  };
  reward: {
    cleanEnergyEarned: number;
    co2ReducedKg: number;
    intimacyEarned: number;
  };
  enemy: EnemyMeta;
  missionTitle: string;
  battlefieldLabel: string;
  /**
   * 진화 발생 정보 (D14 추가)
   * MissionLog.stageBefore !== stageAfter일 때만 비-null
   * null이면 result에서 "계속하기" 클릭 시 바로 메인으로
   */
  evolved: { from: DinoStage; to: DinoStage } | null;
}

export function BattlePageClient({
  dino,
  reward,
  enemy,
  missionTitle,
  battlefieldLabel,
  evolved,
}: BattlePageClientProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const router = useRouter();

  // result에서 "계속하기" — 진화 있으면 evolution phase, 없으면 메인
  const handleResultContinue = () => {
    if (evolved) {
      setPhase("evolution");
    } else {
      router.replace("/");
    }
  };

  // evolution에서 "계속하기" — 항상 메인 (replace로 히스토리 제거)
  const handleEvolutionContinue = () => {
    router.replace("/");
  };

  return (
    <div className="px-4 py-6">
      <AnimatePresence mode="wait">
        {phase === "intro" && (
          <motion.div
            key="intro"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <BattleIntro
              missionTitle={missionTitle}
              enemy={enemy}
              battlefieldLabel={battlefieldLabel}
              onComplete={() => setPhase("cutscene")}
            />
          </motion.div>
        )}

        {phase === "cutscene" && (
          <motion.div
            key="cutscene"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <BattleCutscene
              dino={{ species: dino.species, stage: dino.stageBefore }}
              enemy={enemy}
              onComplete={() => setPhase("result")}
            />
          </motion.div>
        )}

        {phase === "result" && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <BattleResult
              dino={dino}
              reward={reward}
              enemy={enemy}
              onContinue={handleResultContinue}
            />
          </motion.div>
        )}

        {phase === "evolution" && evolved && (
          <motion.div
            key="evolution"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <EvolutionScene
              dinoName={dino.name}
              species={dino.species}
              from={evolved.from}
              to={evolved.to}
              onContinue={handleEvolutionContinue}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
