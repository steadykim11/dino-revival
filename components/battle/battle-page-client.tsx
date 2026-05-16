// /battle/[missionLogId] 페이지의 클라이언트 컨테이너
// cutscene → result 두 phase를 useState로 전환

"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BattleCutscene } from "./battle-cutscene";
import { BattleResult } from "./battle-result";
import type { DinoSpecies, DinoStage } from "@prisma/client";
import type { EnemyMeta } from "@/lib/battle/enemy-types";

type Phase = "cutscene" | "result";

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
}

export function BattlePageClient({ dino, reward, enemy }: BattlePageClientProps) {
  const [phase, setPhase] = useState<Phase>("cutscene");

  return (
    <div className="px-4 py-6">
      <AnimatePresence mode="wait">
        {phase === "cutscene" ? (
          <motion.div
            key="cutscene"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <BattleCutscene
              dino={{ species: dino.species, stage: dino.stageAfter }}
              enemy={enemy}
              onComplete={() => setPhase("result")}
            />
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <BattleResult dino={dino} reward={reward} enemy={enemy} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}