// 미션 완료 → 전투 컷씬 사이의 인터스티셜 (1.8초)
// 다크 배경 + 적 실루엣 + "전투 발생" 카피
//
// 시퀀스:
//   0.0~0.3s: 페이드 인, 적 실루엣 등장
//   0.3~1.5s: 동심원 펄스, 카피 노출
//   1.5~1.8s: 페이드 아웃
//   1.8s 종료 → onComplete 호출

"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { EnemyDisplay } from "./enemy-display";
import type { EnemyMeta } from "@/lib/battle/enemy-types";

export interface BattleIntroProps {
  missionTitle: string;
  enemy: EnemyMeta;
  battlefieldLabel: string; // "PURIFIED" | "NORMAL" | "POLLUTED"
  onComplete: () => void;
}

const TOTAL_DURATION_MS = 1800;

export function BattleIntro({
  missionTitle,
  enemy,
  battlefieldLabel,
  onComplete,
}: BattleIntroProps) {
  useEffect(() => {
    const t = setTimeout(onComplete, TOTAL_DURATION_MS);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div className="relative flex h-[60vh] w-full items-center justify-center overflow-hidden rounded-2xl bg-stone-900">
      {/* 배경 동심원 펄스 */}
      <motion.div
        className="absolute rounded-full border border-orange-500/15"
        style={{ width: 380, height: 380 }}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: [0.95, 1.05, 0.95], opacity: [0, 1, 0.7] }}
        transition={{ duration: 1.8, times: [0, 0.5, 1] }}
      />
      <motion.div
        className="absolute rounded-full border border-orange-500/25"
        style={{ width: 260, height: 260 }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
      />

      {/* 상단 미션명 */}
      <motion.div
        className="absolute top-12 text-center"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: [0, 1, 1, 0], y: 0 }}
        transition={{ duration: 1.8, times: [0, 0.2, 0.85, 1] }}
      >
        <div className="text-[11px] tracking-[0.2em] text-white/40">
          MISSION COMPLETE
        </div>
        <div className="mt-1 text-sm text-white/70">{missionTitle}</div>
      </motion.div>

      {/* 적 실루엣 (중앙 위쪽) */}
      <motion.div
        className="absolute -translate-y-12"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.7, 1, 1, 1.1] }}
        transition={{ duration: 1.8, times: [0, 0.2, 0.85, 1] }}
      >
        <EnemyDisplay meta={enemy} size={100} />
      </motion.div>

      {/* 메인 카피 (중앙 아래쪽) */}
      <motion.div
        className="absolute translate-y-20 text-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: [0, 1, 1, 0], y: [30, 20, 20, 20] }}
        transition={{ duration: 1.8, times: [0, 0.25, 0.85, 1] }}
      >
        <div className="text-[11px] font-medium tracking-[0.3em] text-orange-300">
          BATTLE
        </div>
        <div className="mt-2 text-3xl font-semibold leading-tight text-white">
          전투 발생
        </div>
        <div className="mt-3 text-xs text-white/60">
          탄소 농도 {battlefieldLabel}
        </div>
      </motion.div>

      {/* 하단 진행 표시 (3단계 중 1단계) */}
      <div className="absolute bottom-8 flex gap-1.5">
        <div className="h-0.5 w-6 bg-orange-300" />
        <div className="h-0.5 w-6 bg-white/20" />
        <div className="h-0.5 w-6 bg-white/20" />
      </div>
    </div>
  );
}
