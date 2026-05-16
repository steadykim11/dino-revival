// 공룡 vs 적 충돌 컷씬 (2.5초)
//
// 시퀀스:
//   0.0~0.4s: 공룡(왼쪽), 적(오른쪽) 양쪽에서 등장
//   0.4~1.5s: 가운데로 돌진
//   1.5~1.8s: 충돌 플래시
//   1.8~2.5s: 적 흩어짐, 공룡 가운데에서 포즈
//   2.5s 종료 → onComplete 호출

"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { DinoDisplay } from "@/components/dino/dino-display";
import { EnemyDisplay } from "./enemy-display";
import type { EnemyMeta } from "@/lib/battle/enemy-types";
import type { DinoSpecies, DinoStage } from "@prisma/client";

export interface BattleCutsceneProps {
  dino: { species: DinoSpecies; stage: DinoStage };
  enemy: EnemyMeta;
  onComplete: () => void;
}

const TOTAL_DURATION_MS = 2500;

export function BattleCutscene({ dino, enemy, onComplete }: BattleCutsceneProps) {
  useEffect(() => {
    const t = setTimeout(onComplete, TOTAL_DURATION_MS);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div className="relative flex h-[60vh] w-full items-center justify-center overflow-hidden">
      {/* 충돌 플래시 */}
      <motion.div
        className="absolute inset-0 bg-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0.8, 0] }}
        transition={{ duration: 2.5, times: [0, 0.6, 0.7, 0.8] }}
      />

      {/* 공룡 — 왼쪽 등장 → 가운데 돌진 → 포즈 */}
      <motion.div
        className="absolute"
        initial={{ x: -200, opacity: 0 }}
        animate={{
          x: [-200, -200, 0, 0],
          opacity: [0, 1, 1, 1],
        }}
        transition={{
          duration: 2.5,
          times: [0, 0.16, 0.6, 1],
          ease: ["easeOut", "linear", "easeIn"],
        }}
      >
        <DinoDisplay species={dino.species} stage={dino.stage} size="md" />
      </motion.div>

      {/* 적 — 오른쪽 등장 → 가운데 돌진 → 흩어짐 */}
      <motion.div
        className="absolute"
        initial={{ x: 200, opacity: 0, scale: 1 }}
        animate={{
          x: [200, 200, 0, 0],
          opacity: [0, 1, 1, 0],
          scale: [1, 1, 1, 1.4],
        }}
        transition={{
          duration: 2.5,
          times: [0, 0.16, 0.6, 0.8],
          ease: ["easeOut", "linear", "easeIn", "easeOut"],
        }}
      >
        <EnemyDisplay meta={enemy} size={100} />
      </motion.div>

      {/* 하단 상태 텍스트 */}
      <motion.p
        className="absolute bottom-8 text-sm font-medium text-stone-700"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 0] }}
        transition={{ duration: 2.5, times: [0, 0.7, 0.85, 1] }}
      >
        {enemy.name}을(를) 물리쳤다!
      </motion.p>
    </div>
  );
}