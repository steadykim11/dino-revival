// 전장별 적 SVG 3종
// dino-display.tsx와 동일하게 placeholder. D21에서 정식 일러스트 교체 가능

import type { EnemyMeta } from "@/lib/battle/enemy-types";

export interface EnemyDisplayProps {
  meta: EnemyMeta;
  size?: number;
}

export function EnemyDisplay({ meta, size = 120 }: EnemyDisplayProps) {
  if (meta.variant === "dust") return <DustSvg meta={meta} size={size} />;
  if (meta.variant === "meteor") return <MeteorSvg meta={meta} size={size} />;
  return <FlameSvg meta={meta} size={size} />;
}

function DustSvg({ meta, size }: { meta: EnemyMeta; size: number }) {
  // 미세먼지 구름 — 겹쳐진 흐릿한 원들
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="35" cy="50" r="22" fill={meta.color} opacity="0.6" />
      <circle cx="55" cy="45" r="24" fill={meta.color} opacity="0.7" />
      <circle cx="65" cy="55" r="18" fill={meta.color} opacity="0.5" />
      <circle cx="45" cy="58" r="15" fill={meta.glow} opacity="0.4" />
    </svg>
  );
}

function MeteorSvg({ meta, size }: { meta: EnemyMeta; size: number }) {
  // 검은 운석 — 거친 다각형 + 균열
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <polygon
        points="50,15 75,30 80,55 65,80 35,82 20,60 22,32"
        fill={meta.color}
      />
      <polygon
        points="50,15 75,30 80,55 65,80 35,82 20,60 22,32"
        fill="none"
        stroke={meta.glow}
        strokeWidth="1.5"
        opacity="0.6"
      />
      {/* 균열 */}
      <path
        d="M 40 35 L 55 50 L 48 65"
        stroke={meta.glow}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 60 30 L 65 48"
        stroke={meta.glow}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FlameSvg({ meta, size }: { meta: EnemyMeta; size: number }) {
  // 화염구 — 원 + 위로 솟는 화염 모양
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="60" r="28" fill={meta.color} />
      <circle cx="50" cy="60" r="18" fill={meta.glow} opacity="0.7" />
      {/* 위로 솟는 불꽃 */}
      <path
        d="M 35 40 Q 40 20 50 25 Q 55 15 60 25 Q 65 18 65 35 Q 65 45 50 45 Q 35 45 35 40 Z"
        fill={meta.color}
        opacity="0.85"
      />
      <path
        d="M 45 35 Q 48 22 52 28 Q 55 22 56 35"
        fill={meta.glow}
        opacity="0.8"
      />
    </svg>
  );
}