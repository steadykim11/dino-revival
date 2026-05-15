// 공룡 표시 — 배경 + 움직이는 placeholder SVG.
//
// 디자인 정책 (D10):
// - 컨테이너 고정 280×200 (모바일 420px 폭 안에 안전)
// - 배경: species color 기반 그라데이션 (정화/오염 전장은 D14 이후 연동)
// - 단계별 다른 placeholder + 다른 animation
//   · EGG: 알 모양, 가끔 흔들림 (wobble)
//   · HATCHLING: 작은 활발한 형태, 좌우 + 위아래 bobbing
//   · ADULT: 큰 묵직한 형태, 천천히 좌우
//
// D21에 정식 일러스트로 교체 — props 인터페이스 유지하면 호환.

import type { DinoSpecies, DinoStage } from "@prisma/client";
import { SPECIES_COLOR_HEX, SPECIES_META } from "@/lib/dino/species";

export interface DinoDisplayProps {
  species: DinoSpecies;
  stage: DinoStage;
  /** 크기 옵션 — 메인은 'lg', 카드 미리보기는 'sm' */
  size?: "sm" | "md" | "lg";
}

const SIZE_MAP = {
  sm: { container: "h-32 w-32", svg: 64 },
  md: { container: "h-40 w-40", svg: 96 },
  lg: { container: "h-52 w-full max-w-[280px]", svg: 120 },
} as const;

export function DinoDisplay({ species, stage, size = "lg" }: DinoDisplayProps) {
  const meta = SPECIES_META[species];
  const color = SPECIES_COLOR_HEX[meta.color];
  const dim = SIZE_MAP[size];

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
      <div
        className={`absolute left-1/2 -translate-x-1/2 ${getAnimationClass(stage)}`}
        style={{ bottom: "20%" }}
      >
        <DinoSvg stage={stage} color={color} size={dim.svg} />
      </div>
    </div>
  );
}

function getAnimationClass(stage: DinoStage): string {
  switch (stage) {
    case "EGG":
      return "animate-egg-wobble";
    case "HATCHLING":
      return "animate-hatchling-bob";
    case "ADULT":
      return "animate-adult-sway";
  }
}

/**
 * placeholder SVG — D21에 정식 일러스트로 교체 예정.
 * 단계별로 모양과 크기가 다름.
 */
function DinoSvg({
  stage,
  color,
  size,
}: {
  stage: DinoStage;
  color: string;
  size: number;
}) {
  if (stage === "EGG") {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* 알 — 타원 + 얼룩 */}
        <ellipse cx="50" cy="55" rx="32" ry="40" fill={color} opacity="0.9" />
        <ellipse cx="42" cy="40" rx="6" ry="4" fill="white" opacity="0.4" />
        <circle cx="58" cy="65" r="3" fill={color} opacity="0.5" />
        <circle cx="40" cy="70" r="2" fill={color} opacity="0.5" />
      </svg>
    );
  }
  if (stage === "HATCHLING") {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* 작은 새끼 — 둥근 몸 + 다리 + 작은 꼬리 */}
        <ellipse cx="50" cy="60" rx="28" ry="22" fill={color} />
        {/* 머리 */}
        <circle cx="68" cy="48" r="14" fill={color} />
        {/* 눈 */}
        <circle cx="72" cy="46" r="2" fill="white" />
        <circle cx="73" cy="46" r="1" fill="#222" />
        {/* 다리 */}
        <rect x="38" y="78" width="6" height="10" rx="2" fill={color} />
        <rect x="54" y="78" width="6" height="10" rx="2" fill={color} />
        {/* 꼬리 */}
        <path
          d="M 24 60 Q 16 56 14 50"
          stroke={color}
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  // ADULT — 더 크고 강한 실루엣
  return (
    <svg width={size * 1.3} height={size * 1.1} viewBox="0 0 130 110">
      {/* 큰 몸체 */}
      <ellipse cx="60" cy="70" rx="38" ry="26" fill={color} />
      {/* 큰 머리 */}
      <ellipse cx="92" cy="55" rx="22" ry="18" fill={color} />
      {/* 눈 */}
      <circle cx="100" cy="52" r="3" fill="white" />
      <circle cx="101" cy="52" r="1.5" fill="#222" />
      {/* 입 */}
      <path
        d="M 86 62 L 108 60"
        stroke="#222"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* 다리 */}
      <rect x="40" y="90" width="8" height="14" rx="2" fill={color} />
      <rect x="58" y="90" width="8" height="14" rx="2" fill={color} />
      <rect x="72" y="90" width="8" height="14" rx="2" fill={color} />
      {/* 꼬리 */}
      <path
        d="M 24 72 Q 8 65 4 50"
        stroke={color}
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
      />
      {/* 등 능선 */}
      <path
        d="M 35 56 L 45 50 L 55 54 L 65 48 L 75 52"
        stroke={color}
        strokeWidth="2"
        fill="none"
        opacity="0.5"
      />
    </svg>
  );
}
