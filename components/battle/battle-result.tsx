// SC-07 전투 결과 화면
// 컷씬 종료 후 표시. 보상 카운트업 + 진척도 바 차오르는 모션

"use client";

import { useRouter } from "next/navigation";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { useEffect, useState } from "react";
import { DinoDisplay } from "@/components/dino/dino-display";
import { EnemyDisplay } from "./enemy-display";
import { SPECIES_META } from "@/lib/dino/species";
import { getEvolutionProgress } from "@/lib/dino/evolution";
import type { EnemyMeta } from "@/lib/battle/enemy-types";
import type { DinoSpecies, DinoStage } from "@prisma/client";

export interface BattleResultProps {
  dino: {
    name: string;
    species: DinoSpecies;
    // 컷씬 직전 (=완료 직전) 상태. 진척도 바의 시작값 계산에 사용
    stageBefore: DinoStage;
    cleanEnergyBefore: number;
    // 완료 직후 상태. 진척도 바의 종료값 계산에 사용
    stageAfter: DinoStage;
    cleanEnergyAfter: number;
  };
  reward: {
    cleanEnergyEarned: number;
    co2ReducedKg: number;
    intimacyEarned: number;
  };
  enemy: EnemyMeta;
}

export function BattleResult({ dino, reward, enemy }: BattleResultProps) {
  const router = useRouter();
  const dinoMeta = SPECIES_META[dino.species];

  // 진척도 바는 stageAfter 기준으로 계산. 진화한 경우 새 단계의 0부터 시작
  const progressAfter = getEvolutionProgress(dino.stageAfter, dino.cleanEnergyAfter);
  const progressBefore = getEvolutionProgress(dino.stageAfter, dino.cleanEnergyBefore);

  const fromPercent = Math.max(0, Math.min(100, progressBefore.percent));
  const toPercent = progressAfter.percent;

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="text-center">
        <p className="text-xs text-stone-500">전투 승리</p>
        <h1 className="mt-1 text-lg font-bold text-stone-900">
          {dino.name}이(가) 이겼습니다
        </h1>
      </div>

      {/* 공룡 vs 적 — 적은 흐려진 처리 */}
      <div className="flex items-center justify-center gap-4 rounded-2xl bg-white py-4 shadow-sm">
        <div className="flex flex-col items-center">
          <DinoDisplay
            species={dino.species}
            stage={dino.stageAfter}
            size="sm"
          />
          <p className="mt-1 text-xs text-stone-600">{dino.name}</p>
        </div>
        <p className="text-xs text-stone-400">VS</p>
        <div className="flex flex-col items-center opacity-30">
          <EnemyDisplay meta={enemy} size={80} />
          <p className="mt-1 text-xs text-stone-500">{enemy.name}</p>
        </div>
      </div>

      {/* 보상 박스 (카운트업) */}
      <div className="rounded-xl bg-stone-50 p-4">
        <p className="mb-2 text-xs font-medium text-stone-500">획득 보상</p>
        <div className="space-y-1.5 text-sm">
          <RewardRow
            label="클린에너지"
            value={reward.cleanEnergyEarned}
            prefix="+"
            color="text-amber-700"
          />
          <RewardRow
            label="탄소 감축"
            value={reward.co2ReducedKg}
            suffix=" kg CO₂"
            decimals={2}
            color="text-emerald-700"
          />
          <RewardRow
            label="친밀도"
            value={reward.intimacyEarned}
            prefix="+"
            color="text-rose-700"
          />
        </div>
      </div>

      {/* 진척도 바 */}
      {progressAfter.target !== null && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-stone-600">{dino.name} 누적 클린에너지</span>
            <AnimatedNumber
              from={dino.cleanEnergyBefore}
              to={dino.cleanEnergyAfter}
              className="font-medium tabular-nums text-stone-800"
            />
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
            <motion.div
              className="h-full rounded-full bg-amber-600"
              initial={{ width: `${fromPercent}%` }}
              animate={{ width: `${toPercent}%` }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-stone-500">
            {nextStageLabel(dino.stageAfter)}까지{" "}
            {Math.max(0, (progressAfter.target ?? 0) - dino.cleanEnergyAfter)} 남음
          </p>
        </div>
      )}

      {/* 계속하기 버튼 */}
      <motion.button
        type="button"
        onClick={() => router.push("/")}
        className="rounded-lg bg-amber-600 py-3 text-sm font-medium text-white hover:bg-amber-700"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.4 }}
      >
        계속하기
      </motion.button>
    </div>
  );
}

// 보상 한 행 — 라벨 + 카운트업 숫자
function RewardRow({
  label,
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  color,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  color: string;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-stone-600">{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>
        {prefix}
        <AnimatedNumber from={0} to={value} decimals={decimals} />
        {suffix}
      </span>
    </div>
  );
}

// motion useMotionValue + useTransform 으로 카운트업 처리
function AnimatedNumber({
  from,
  to,
  decimals = 0,
  className,
}: {
  from: number;
  to: number;
  decimals?: number;
  className?: string;
}) {
  const count = useMotionValue(from);
  const rounded = useTransform(count, (v) =>
    decimals === 0
      ? Math.round(v).toString()
      : v.toFixed(decimals),
  );
  const [display, setDisplay] = useState(rounded.get());

  useEffect(() => {
    const controls = animate(count, to, {
      duration: 1.2,
      ease: "easeOut",
      delay: 0.3,
    });
    const unsub = rounded.on("change", (v) => setDisplay(v));
    return () => {
      controls.stop();
      unsub();
    };
  }, [count, rounded, to]);

  return <span className={className}>{display}</span>;
}

function nextStageLabel(stage: DinoStage): string {
  if (stage === "EGG") return "부화";
  if (stage === "HATCHLING") return "성체";
  return "최대";
}