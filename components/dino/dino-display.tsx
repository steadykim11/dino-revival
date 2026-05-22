// 공룡 표시 — 배경 + 일러스트(또는 SVG placeholder)
//
// D22 수정:
// - HATCHLING·ADULT에 state machine 적용 (standing/walking/sitting × 2프레임)
// - SVG는 /public/dino/*.svg에서 로드
// - animated prop으로 상태 머신 ON/OFF (메인=ON, 컷씬/결과=OFF)
// - EGG는 기존 egg-wobble CSS 유지

"use client";

import Image from "next/image";
import type { DinoSpecies, DinoStage } from "@prisma/client";
import { SPECIES_COLOR_HEX, SPECIES_META } from "@/lib/dino/species";
import { useIdleStateMachine } from "@/lib/dino/idle-state-machine";

export interface DinoDisplayProps {
  species: DinoSpecies;
  stage: DinoStage;
  /** 크기 옵션 — 메인은 'lg', 카드 미리보기는 'sm' */
  size?: "sm" | "md" | "lg";
  /**
   * idle 상태 머신 활성화 (HATCHLING·ADULT만 해당).
   * 메인 화면=true, 컷씬·결과 화면=false. 기본 true.
   */
  animated?: boolean;
}

const SIZE_MAP = {
  sm: { container: "h-32 w-32", svg: 64 },
  md: { container: "h-40 w-40", svg: 96 },
  lg: { container: "h-52 w-full max-w-[280px]", svg: 120 },
} as const;

export function DinoDisplay({
  species,
  stage,
  size = "lg",
  animated = true,
}: DinoDisplayProps) {
  const meta = SPECIES_META[species];
  const color = SPECIES_COLOR_HEX[meta.color];
  const dim = SIZE_MAP[size];

  // HACHLING, ADULT만 동작 hook 사용
  const useStateMachine = animated && stage !== "EGG";
  const idleState = useIdleStateMachine(useStateMachine);

  return (
    <div
      className={`relative mx-auto overflow-hidden rounded-2xl ${dim.container}`}
      style={{
        background: `linear-gradient(160deg, ${color}22 0%, ${color}11 70%, transparent 100%)`,
      }}
    >
      {/* 배경 패턴 (간단한 점선으로 깊이감) */}
      <div className="absolute inset-0 opacity-30">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="dots"
              x="0"
              y="0"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1" fill={color} opacity="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      {/* 바닥 그림자 */}
      <div
        className="absolute left-1/2 h-2 w-20 -translate-x-1/2 rounded-full bg-stone-900/15 blur-sm"
        style={{ bottom: "18%" }}
      />

      {/* 공룡 본체 */}
      {stage === "EGG" ? (
        // EGG: 기존 인라인 SVG + egg-wobble
        <div
          className="absolute left-1/2 -translate-x-1/2 animate-egg-wobble"
          style={{ bottom: "20%" }}
        >
          <EggSvg color={color} size={dim.svg} />
        </div>
      ) : (
        // HATCHLING·ADULT: 파일 SVG + 상태 머신
        <DinoFrames
          stage={stage}
          color={color}
          size={dim.svg}
          idle={idleState}
        />
      )}
    </div>
  );
}

/**
 * HATCHLING·ADULT 프레임 렌더링.
 * - 12장 모두 미리 마운트하고 opacity 토글로 즉시 전환 (프리로드 + 깜빡임 방지)
 * - walking facing은 scaleX(-1)
 * - walking offsetX는 transform translateX
 */
function DinoFrames({
  stage,
  color,
  size,
  idle,
}: {
  stage: "HATCHLING" | "ADULT";
  color: string;
  size: number;
  idle: ReturnType<typeof useIdleStateMachine>;
}) {
  const stageKey = stage.toLowerCase(); // 'hatchling' | 'adult'
  const poses = ["standing", "walking", "sitting"] as const;

  const renderSize = stage === "ADULT" ? size * 1.3 : size;

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2"
      style={{
        bottom: "20%",
        transform: `translateX(calc(-50% + ${idle.offsetX}px))`,
        color,
      }}
    >
      <div
        style={{
          transform: idle.facing === "left" ? "scaleX(-1)" : undefined,
          transition: "transform 0.15s linear",
          width: renderSize,
          height: renderSize,
          position: "relative",
        }}
      >
        {poses.map((pose) =>
          [1, 2].map((frameNum) => {
            const isActive = idle.pose === pose && idle.frame === frameNum;
            return (
              <Image
                key={`${pose}-${frameNum}`}
                src={`/dino/dino_${stageKey}_${pose}_0${frameNum}.svg`}
                alt=""
                width={renderSize}
                height={renderSize}
                priority
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: isActive ? 1 : 0,
                }}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}

/**
 * EGG placeholder SVG - 기존과 동일
 */
function EggSvg({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <ellipse cx="50" cy="55" rx="32" ry="40" fill={color} opacity="0.9" />
      <ellipse cx="42" cy="40" rx="6" ry="4" fill="white" opacity="0.4" />
      <circle cx="58" cy="65" r="3" fill={color} opacity="0.5" />
      <circle cx="40" cy="70" r="2" fill={color} opacity="0.5" />
    </svg>
  );
}
