// 전장(Battlefield)별 적 메타데이터
// SC-07 전투 결과 화면의 적 시각화에 사용
//
// 전장 → 적 매핑:
//   PURIFIED  → 미세먼지 구름 (옅은 잿빛, 흩어지는 형태)
//   NORMAL    → 검은 운석 (와이어프레임 기본)
//   POLLUTED  → 화염구 (붉은 빛, 강렬한 형태)

import type { Battlefield } from "@/lib/missions/reward-calculator";

export interface EnemyMeta {
  // 표시명 (SC-07 헤더에서 "{공룡}이 {적}을 물리쳤습니다")
  name: string;
  // SVG 식별자 (enemy-display.tsx에서 분기)
  variant: "dust" | "meteor" | "flame";
  // 본체 색상
  color: string;
  // 글로우 색상 (애니메이션용)
  glow: string;
}

export const ENEMY_META: Record<Battlefield, EnemyMeta> = {
  PURIFIED: {
    name: "미세먼지 구름",
    variant: "dust",
    color: "#a8a29e",
    glow: "#d6d3d1",
  },
  NORMAL: {
    name: "검은 운석",
    variant: "meteor",
    color: "#44403c",
    glow: "#78716c",
  },
  POLLUTED: {
    name: "화염구",
    variant: "flame",
    color: "#dc2626",
    glow: "#f97316",
  },
};
