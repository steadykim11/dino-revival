"use client";

// SC-08 진화 연출 — D14
//
// battle 페이지의 evolution phase에서 렌더링.
// 호출자: app/battle/[missionLogId]/page.tsx (D14에서 phase 분기 추가 예정)
//
// 시각 구성 (와이어프레임):
//   "— 진화 —" 캡션
//   "{dinoName}가 {STAGE_LABEL[to]}로 진화합니다" 헤드라인
//   [이전 단계 흐림] → [현재 단계 선명·펄스]
//   타이핑되는 대사 (species.evolutionLines)
//   "계속하기" 버튼 → 메인으로

import type { DinoSpecies, DinoStage } from "@/lib/dino/types";
import { motion } from "motion/react";
import { DinoDisplay } from "@/components/dino/dino-display";
import { SPECIES_META, STAGE_LABEL } from "@/lib/dino/species";

interface EvolutionSceneProps {
  dinoName: string;
  species: DinoSpecies;
  /** 진화 전 단계 (MissionLog.stageBefore) */
  from: DinoStage;
  /** 진화 후 단계 (MissionLog.stageAfter, Dino.stage와 동일) */
  to: DinoStage;
  /** 계속하기 클릭 핸들러 — 보통 router.push('/') */
  onContinue: () => void;
}

export function EvolutionScene({
  dinoName,
  species,
  from,
  to,
  onContinue,
}: EvolutionSceneProps) {
  const meta = SPECIES_META[species];

  // 어떤 진화인지에 따라 대사 분기.
  // EGG→HATCHLING: hatched 대사 / HATCHLING→ADULT: evolved 대사
  const line =
    to === "HATCHLING"
      ? meta.evolutionLines.hatched
      : meta.evolutionLines.evolved;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-neutral-50 px-6 py-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex w-full max-w-[420px] flex-col items-center gap-8"
      >
        {/* "— 진화 —" 캡션 */}
        <p className="text-sm tracking-[0.3em] text-neutral-500">— 진화 —</p>

        {/* 헤드라인 */}
        <h1 className="text-center text-2xl font-bold leading-snug text-neutral-900">
          {dinoName}가 {STAGE_LABEL[to]}로 진화합니다
        </h1>

        {/* 이전 단계 흐림 → 화살표 → 현재 단계 선명·펄스 */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-2 opacity-40">
            <DinoDisplay
              species={species}
              stage={from}
              size="md"
              animated={false}
              showBackground={false}
            />
            <span className="text-xs text-neutral-500">
              {STAGE_LABEL[from]}
            </span>
          </div>

          <span className="text-2xl text-neutral-400" aria-hidden>
            →
          </span>

          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{
              scale: 1,
              opacity: 1,
              filter: [
                "drop-shadow(0 0 0px rgba(224,122,95,0))",
                "drop-shadow(0 0 24px rgba(224,122,95,0.5))",
                "drop-shadow(0 0 8px rgba(224,122,95,0.3))",
              ],
            }}
            transition={{
              scale: { duration: 0.6, delay: 0.3, ease: "backOut" },
              opacity: { duration: 0.4, delay: 0.3 },
              filter: {
                duration: 1.6,
                delay: 0.3,
                repeat: Infinity,
                repeatType: "reverse",
              },
            }}
            className="flex flex-col items-center gap-2"
          >
            <DinoDisplay species={species} stage={to} size="md" animated={false} showBackground={false} />
            <span className="text-xs font-semibold text-neutral-700">
              {STAGE_LABEL[to]}
            </span>
          </motion.div>
        </div>

        {/* 대사 — 타이핑 효과 (글자별 stagger) */}
        {line ? (
          <motion.p
            initial="hidden"
            animate="visible"
            transition={{ staggerChildren: 0.05, delayChildren: 1.2 }}
            className="text-center text-base italic leading-relaxed text-neutral-700"
          >
            &ldquo;
            {Array.from(line).map((char, i) => (
              <motion.span
                key={i}
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1 },
                }}
              >
                {char}
              </motion.span>
            ))}
            &rdquo;
          </motion.p>
        ) : null}

        {/* 계속하기 */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: 1.2 + Array.from(line ?? "").length * 0.05 + 0.4,
            duration: 0.3,
          }}
          onClick={onContinue}
          className="mt-2 w-full rounded-lg bg-neutral-900 px-6 py-3 text-base font-semibold text-white transition hover:bg-neutral-800"
        >
          계속하기
        </motion.button>
      </motion.div>
    </div>
  );
}
